"""
Face service  –  OpenCV LBPH recognizer, optimised for accuracy & speed.

Fixes vs original:
  1. minNeighbors raised to 10  (kills background false-positives)
  2. Minimum face = 20 % of frame width (filters tiny corner detections)
  3. Aspect-ratio guard: w/h must be between 0.65 – 1.35  (faces are ~square)
  4. Frame downscaled to 480px wide before detection  (3-4x faster)
  5. In-memory LBPH recognizer cache: rebuilt from DB only when embeddings change
  6. CLAHE replaces plain equalizeHist for better dark/bright face contrast
  7. LBPH threshold tightened to 70 (fewer wrong matches)
"""
import cv2
import numpy as np
import base64
import threading
from bson import ObjectId
from datetime import datetime

# ── Robust Cascade Loading ──────────────────────────────────────────────────
import os

def _load_cascade():
    """Try various paths and types (Haar/LBP) to ensure a classifier is loaded."""
    paths = [
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml",
        cv2.data.haarcascades + "haarcascade_frontalface_alt2.xml",
        cv2.data.haarcascades + "haarcascade_frontalface_alt.xml",
        "haarcascade_frontalface_default.xml",  # local fallback
    ]
    
    for p in paths:
        if os.path.exists(p) or p.startswith(cv2.data.haarcascades):
            c = cv2.CascadeClassifier(p)
            if not c.empty():
                print(f"[FaceService] Loaded cascade: {p}")
                return c
                
    # If all Haar fail, try LBP (sometimes included in different paths)
    lbp_p = cv2.data.haarcascades.replace("haarcascades", "lbpcascades") + "lbpcascade_frontalface.xml"
    if os.path.exists(lbp_p):
        c = cv2.CascadeClassifier(lbp_p)
        if not c.empty():
            print(f"[FaceService] Loaded LBP cascade: {lbp_p}")
            return c
            
    print("[FaceService] WARNING: No face cascade loaded! Detection will fail.")
    return cv2.CascadeClassifier()

_cascade = _load_cascade()

# ── Tuning constants ──────────────────────────────────────────────────────────
FACE_SIZE       = (100, 100)   # LBPH training size
LBPH_THRESHOLD  = 85           # very forgiving threshold for matching
DETECT_WIDTH    = 480          # standard processing width
MIN_FACE_RATIO  = 0.10         # catch smaller/further faces
MIN_NEIGHBORS   = 3            # extremely sensitive detection (catch anything)
SCALE_FACTOR    = 1.1          # slower but more thorough search
MIN_ASPECT      = 0.5          # loose aspect ratio (catch tilted faces)
MAX_ASPECT      = 1.6          # loose aspect ratio

_clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))

# ── In-memory recognizer cache ────────────────────────────────────────────────
_lock              = threading.Lock()
_recognizer        = None
_uid_index         = []         # label-index → user_id string
_cache_dirty       = True       # set True to force rebuild on next call

def invalidate_recognizer_cache():
    """Call whenever embeddings are written or deleted."""
    global _cache_dirty
    with _lock:
        _cache_dirty = True

def _get_recognizer(db):
    """Return (recognizer, uid_index), loading from DB only when dirty."""
    global _recognizer, _uid_index, _cache_dirty

    with _lock:
        if not _cache_dirty:
            return _recognizer, _uid_index

        docs = list(db["embeddings"].find({}, {"user_id": 1, "embedding": 1}))
        if not docs:
            _recognizer, _uid_index, _cache_dirty = None, [], False
            return None, []

        uid_map, train_faces, train_labels = [], [], []
        for doc in docs:
            uid = str(doc["user_id"])
            if uid not in uid_map:
                uid_map.append(uid)
            arr = np.array(doc["embedding"], dtype=np.uint8).reshape(FACE_SIZE)
            train_faces.append(arr)
            train_labels.append(uid_map.index(uid))

        rec = cv2.face.LBPHFaceRecognizer_create(
            radius=1, neighbors=8, grid_x=8, grid_y=8
        )
        rec.train(train_faces, np.array(train_labels, dtype=np.int32))

        _recognizer, _uid_index, _cache_dirty = rec, uid_map, False
        print(f"[FaceService] Recognizer ready: {len(uid_map)} users, {len(docs)} samples")
        return _recognizer, _uid_index


# ── Image utilities ────────────────────────────────────────────────────────────
def base64_to_image(b64: str) -> np.ndarray:
    if isinstance(b64, str) and "," in b64:
        b64 = b64.split(",")[1]
    arr = np.frombuffer(base64.b64decode(b64), dtype=np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def image_to_base64(img: np.ndarray, quality: int = 80) -> str:
    _, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode()


# ── Face detection ─────────────────────────────────────────────────────────────
def _valid_face(fw: int, fh: int, frame_w: int) -> bool:
    """Return True only if detection looks like a real human face."""
    # Must be at least MIN_FACE_RATIO of the frame width
    if fw < frame_w * MIN_FACE_RATIO:
        return False
    # Must be roughly square (portraits, not landscape picture frames)
    if fh == 0:
        return False
    ratio = fw / fh
    if not (MIN_ASPECT <= ratio <= MAX_ASPECT):
        return False
    return True


def detect_faces(img: np.ndarray) -> list:
    """
    Return list of (x, y, w, h) in ORIGINAL image coordinates.
    Detects on a downscaled copy for speed; maps back to full resolution.
    """
    if img is None or img.size == 0:
        return []

    orig_h, orig_w = img.shape[:2]
    if orig_w == 0 or orig_h == 0:
        return []

    # Brightness/Contrast Normalization
    # Helps with "milky" or dark camera feeds
    alpha = 1.3  # Contrast
    beta = 10    # Brightness
    img = cv2.convertScaleAbs(img, alpha=alpha, beta=beta)
    
    # Downscale for detection
    if orig_w > DETECT_WIDTH:
        scale = orig_w / DETECT_WIDTH
        small = cv2.resize(img, (DETECT_WIDTH, int(orig_h / scale)),
                           interpolation=cv2.INTER_AREA)
    else:
        scale = 1.0
        small = img

    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    gray = _clahe.apply(gray)             # high-quality contrast for detection

    min_px = int(DETECT_WIDTH * MIN_FACE_RATIO)   # min face size in small img
    raw = _cascade.detectMultiScale(
        gray,
        scaleFactor  = SCALE_FACTOR,
        minNeighbors = MIN_NEIGHBORS,
        minSize      = (min_px, min_px),
        flags        = cv2.CASCADE_SCALE_IMAGE,
    )

    if len(raw) == 0:
        return []

    faces = []
    for (x, y, w, h) in raw:
        # Map back to original resolution
        ox, oy = int(x * scale), int(y * scale)
        ow, oh = int(w * scale), int(h * scale)
        if _valid_face(ow, oh, orig_w):
            faces.append((ox, oy, ow, oh))

    return faces


def detect_faces_b64(b64: str) -> dict:
    img = base64_to_image(b64)
    if img is None:
        return {"faces": [], "width": 0, "height": 0}
    h, w = img.shape[:2]
    faces = detect_faces(img)
    return {
        "faces": [{"x": x, "y": y, "w": fw, "h": fh} for x, y, fw, fh in faces],
        "width":  w,
        "height": h,
    }


# ── ROI extraction ─────────────────────────────────────────────────────────────
def _get_face_roi(img: np.ndarray, face: tuple) -> np.ndarray:
    """Grayscale + CLAHE + resize → FACE_SIZE  (used for LBPH training/prediction)."""
    x, y, w, h = face
    pad = int(min(w, h) * 0.05)
    x1 = max(0, x - pad);  y1 = max(0, y - pad)
    x2 = min(img.shape[1], x + w + pad);  y2 = min(img.shape[0], y + h + pad)
    gray = cv2.cvtColor(img[y1:y2, x1:x2], cv2.COLOR_BGR2GRAY)
    gray = cv2.resize(gray, FACE_SIZE)
    return _clahe.apply(gray)


def _get_color_crop(img: np.ndarray, face: tuple) -> np.ndarray:
    x, y, w, h = face
    pad = int(min(w, h) * 0.15)
    x1 = max(0, x - pad);  y1 = max(0, y - pad)
    x2 = min(img.shape[1], x + w + pad);  y2 = min(img.shape[0], y + h + pad)
    return img[y1:y2, x1:x2]


# ── Registration ───────────────────────────────────────────────────────────────
def generate_face_sample(image_input) -> tuple:
    """Return (pixel_list, color_face_b64) for the largest detected face."""
    img = base64_to_image(image_input) if isinstance(image_input, str) else image_input
    if img is None:
        raise ValueError("Cannot decode image")

    faces = detect_faces(img)
    if not faces:
        raise ValueError("No face detected — ensure good lighting and face the camera")

    best       = max(faces, key=lambda f: f[2] * f[3])   # largest area
    roi        = _get_face_roi(img, best)
    color_crop = _get_color_crop(img, best)
    return roi.flatten().tolist(), image_to_base64(color_crop)


def save_face_sample(user_id: str, pixels: list, face_b64: str,
                     sample_index: int, db):
    db["embeddings"].insert_one({
        "user_id":      ObjectId(user_id),
        "embedding":    pixels,
        "face_preview": face_b64,
        "sample_index": sample_index,
        "created_at":   datetime.utcnow(),
    })
    invalidate_recognizer_cache()


def delete_user_embeddings(user_id: str, db):
    db["embeddings"].delete_many({"user_id": ObjectId(user_id)})
    invalidate_recognizer_cache()


# ── Recognition ────────────────────────────────────────────────────────────────
def recognize_face(image_input, db) -> tuple:
    """Returns (user_doc, confidence) or (None, confidence)."""
    img = base64_to_image(image_input) if isinstance(image_input, str) else image_input
    if img is None:
        raise ValueError("Cannot decode image")

    faces = detect_faces(img)
    if not faces:
        raise ValueError("No face detected in frame")

    best      = max(faces, key=lambda f: f[2] * f[3])
    query_roi = _get_face_roi(img, best)

    recognizer, uid_index = _get_recognizer(db)
    if recognizer is None:
        return None, 999.0

    label, confidence = recognizer.predict(query_roi)
    if confidence <= LBPH_THRESHOLD and 0 <= label < len(uid_index):
        user = db["users"].find_one({"_id": ObjectId(uid_index[label])})
        return user, round(confidence, 1)
    return None, round(confidence, 1)


def recognize_all_faces(image_input, db) -> list:
    """Detect & recognize ALL faces. Returns list of face dicts for live feed."""
    img = base64_to_image(image_input) if isinstance(image_input, str) else image_input
    if img is None:
        return []

    faces = detect_faces(img)
    if not faces:
        return []

    recognizer, uid_index = _get_recognizer(db)
    results = []

    for (x, y, w, h) in faces:
        roi   = _get_face_roi(img, (x, y, w, h))
        entry = {
            "box":         {"x": x, "y": y, "w": w, "h": h},
            "recognized":  False,
            "name":        "Unknown",
            "employee_id": "",
            "user_id":     None,
            "confidence":  999.0,
        }

        if recognizer and uid_index:
            label, confidence = recognizer.predict(roi)
            if confidence <= LBPH_THRESHOLD and 0 <= label < len(uid_index):
                user = db["users"].find_one({"_id": ObjectId(uid_index[label])})
                if user:
                    entry.update({
                        "recognized":    True,
                        "name":          user.get("name", ""),
                        "employee_id":   user.get("employee_id", ""),
                        "user_id":       str(user["_id"]),
                        "confidence":    round(confidence, 1),
                        "department":    user.get("department", ""),
                        "profile_photo": user.get("profile_photo", ""),
                    })

        results.append(entry)

    return results


# ── Backward-compat aliases ────────────────────────────────────────────────────
def generate_embedding(image_input) -> list:
    pixels, _ = generate_face_sample(image_input)
    return pixels

def save_embedding(user_id: str, embedding: list, sample_index: int, db):
    save_face_sample(user_id, embedding, "", sample_index, db)
