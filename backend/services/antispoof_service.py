"""
Anti-spoof liveness detection using OpenCV eye detection (no MediaPipe dependency).
MediaPipe-based EAR detection can be added later for better accuracy.
"""
import numpy as np
import base64
import cv2
from datetime import datetime

try:
    import mediapipe as mp
    from scipy.spatial.distance import euclidean
    MEDIAPIPE_AVAILABLE = True
    print("[antispoof] MediaPipe available — using EAR blink detection")
except ImportError:
    MEDIAPIPE_AVAILABLE = False
    print("[antispoof] MediaPipe NOT available — using OpenCV eye detection fallback")

# OpenCV eye cascade (fallback)
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
eye_cascade  = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_eye.xml")

REQUIRED_BLINKS = 2

# ── MediaPipe constants ──────────────────────────────────────────────────────
if MEDIAPIPE_AVAILABLE:
    mp_face_mesh = mp.solutions.face_mesh
    LEFT_EYE  = [362, 385, 387, 263, 373, 380]
    RIGHT_EYE = [33,  160, 158, 133, 153, 144]
    EAR_THRESHOLD = 0.25

    def _ear(landmarks, indices, w, h):
        pts = [(int(landmarks[i].x * w), int(landmarks[i].y * h)) for i in indices]
        v1 = euclidean(pts[1], pts[5])
        v2 = euclidean(pts[2], pts[4])
        hd = euclidean(pts[0], pts[3])
        return (v1 + v2) / (2.0 * hd) if hd > 0 else 0.0


class LivenessSession:
    def __init__(self):
        self.blink_count = 0
        self.frames_processed = 0
        self.eye_was_closed = False
        self.last_eye_count = 2
        self.no_eye_frames = 0
        self._mesh = None

        if MEDIAPIPE_AVAILABLE:
            self._mesh = mp_face_mesh.FaceMesh(
                max_num_faces=1,
                refine_landmarks=True,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5
            )

    def _process_mediapipe(self, frame) -> dict:
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        h, w = frame.shape[:2]
        result = self._mesh.process(rgb)

        if not result.multi_face_landmarks:
            return self._result(False, "no_face")

        lm = result.multi_face_landmarks[0].landmark
        left_ear  = _ear(lm, LEFT_EYE,  w, h)
        right_ear = _ear(lm, RIGHT_EYE, w, h)
        avg_ear   = (left_ear + right_ear) / 2.0

        if avg_ear < EAR_THRESHOLD:
            self.eye_was_closed = True
        else:
            if self.eye_was_closed:
                self.blink_count += 1
            self.eye_was_closed = False

        self.frames_processed += 1
        return {
            "is_live": self.blink_count >= REQUIRED_BLINKS,
            "blink_count": self.blink_count,
            "frames": self.frames_processed,
            "ear": round(avg_ear, 4),
            "status": "live" if self.blink_count >= REQUIRED_BLINKS else "checking"
        }

    def _process_opencv(self, frame) -> dict:
        """Fallback: count open eyes. If eyes disappear & reappear → blink."""
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(60, 60))

        if len(faces) == 0:
            return self._result(False, "no_face")

        x, y, w, h = faces[0]
        roi = gray[y:y+h, x:x+w]
        eyes = eye_cascade.detectMultiScale(roi, 1.1, 3)
        current_eye_count = len(eyes)

        # Blink: had eyes → lost eyes → got eyes back
        if self.last_eye_count >= 2 and current_eye_count == 0:
            self.eye_was_closed = True
        elif self.eye_was_closed and current_eye_count >= 1:
            self.blink_count += 1
            self.eye_was_closed = False

        self.last_eye_count = current_eye_count
        self.frames_processed += 1
        is_live = self.blink_count >= REQUIRED_BLINKS

        return {
            "is_live": is_live,
            "blink_count": self.blink_count,
            "frames": self.frames_processed,
            "ear": 0.0,
            "status": "live" if is_live else "checking"
        }

    def process_frame(self, frame_b64: str) -> dict:
        if ',' in frame_b64:
            frame_b64 = frame_b64.split(',')[1]
        arr = np.frombuffer(base64.b64decode(frame_b64), dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)

        if frame is None:
            return self._result(False, "decode_error")

        if MEDIAPIPE_AVAILABLE and self._mesh:
            return self._process_mediapipe(frame)
        return self._process_opencv(frame)

    def _result(self, is_live, status):
        return {
            "is_live": is_live,
            "blink_count": self.blink_count,
            "frames": self.frames_processed,
            "ear": 0.0,
            "status": status
        }

    def reset(self):
        self.blink_count = 0
        self.frames_processed = 0
        self.eye_was_closed = False
        self.last_eye_count = 2


_sessions: dict = {}

def get_session(session_id: str) -> LivenessSession:
    if session_id not in _sessions:
        _sessions[session_id] = LivenessSession()
    return _sessions[session_id]

def clear_session(session_id: str):
    _sessions.pop(session_id, None)
