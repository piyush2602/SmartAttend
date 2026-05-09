from flask import Blueprint, request, jsonify
from bson import ObjectId
from datetime import datetime, date
from db import get_db
from utils.auth_middleware import require_auth
from services.face_service import recognize_all_faces, detect_faces_b64
from services.antispoof_service import get_session, clear_session

attendance_bp = Blueprint("attendance", __name__)


def serialize_record(r):
    return {
        "id": str(r["_id"]),
        "user_id": str(r.get("user_id", "")),
        "name": r.get("name", ""),
        "employee_id": r.get("employee_id", ""),
        "department": r.get("department", ""),
        "date": r.get("date", ""),
        "time": r.get("time", ""),
        "status": r.get("status", ""),
        "profile_photo": r.get("profile_photo", ""),
    }


# ── Face detection endpoint (for overlay only, no marking) ─────────────────
@attendance_bp.route("/detect", methods=["POST"])
@require_auth
def detect_faces_endpoint():
    data = request.get_json(silent=True) or {}
    frame_b64 = data.get("frame", "")
    if not frame_b64:
        return jsonify({"faces": [], "width": 0, "height": 0}), 200
    try:
        return jsonify(detect_faces_b64(frame_b64)), 200
    except Exception as e:
        return jsonify({"faces": [], "error": str(e)}), 200


# ── Combined: recognize all faces + optionally mark attendance ─────────────
@attendance_bp.route("/recognize", methods=["POST"])
@require_auth
def recognize_live():
    """
    Main live-attendance endpoint.
    Detects ALL faces, recognizes each, and optionally marks attendance.
    Returns face boxes with name labels for frontend canvas drawing.
    """
    db = get_db()
    data = request.get_json(silent=True) or {}
    frame_b64 = data.get("frame", "")
    auto_mark = data.get("auto_mark", True)
    session_id = data.get("session_id", "default")

    if not frame_b64:
        return jsonify({"faces": []}), 200

    try:
        face_results = recognize_all_faces(frame_b64, db)
    except Exception as e:
        return jsonify({"faces": [], "error": str(e)}), 200

    today = date.today().isoformat()
    now_str = datetime.utcnow().strftime("%H:%M:%S")

    for face in face_results:
        if not face["recognized"]:
            continue

        uid = face["user_id"]
        face["just_marked"] = False
        face["already_marked"] = False

        if auto_mark and uid:
            existing = db["attendance"].find_one({
                "user_id": ObjectId(uid), "date": today
            })
            if existing:
                face["already_marked"] = True
            else:
                user = db["users"].find_one({"_id": ObjectId(uid)})
                record = {
                    "user_id": ObjectId(uid),
                    "name": face["name"],
                    "employee_id": face["employee_id"],
                    "department": face.get("department", ""),
                    "date": today,
                    "time": now_str,
                    "status": "present",
                    "session_id": session_id,
                    "confidence": face["confidence"],
                    "profile_photo": user.get("profile_photo", "") if user else ""
                }
                db["attendance"].insert_one(record)
                face["just_marked"] = True

    return jsonify({"faces": face_results}), 200


# ── Liveness check ──────────────────────────────────────────────────────────
@attendance_bp.route("/liveness", methods=["POST"])
@require_auth
def check_liveness():
    data = request.get_json()
    frame_b64 = data.get("frame")
    session_id = data.get("session_id", "default")
    if not frame_b64:
        return jsonify({"error": "Frame required"}), 400
    session = get_session(session_id)
    return jsonify(session.process_frame(frame_b64)), 200


# ── Manual mark attendance ──────────────────────────────────────────────────
@attendance_bp.route("/mark", methods=["POST"])
@require_auth
def mark_attendance():
    db = get_db()
    data = request.get_json()
    frame_b64 = data.get("frame")
    session_id = data.get("session_id", "default")

    if not frame_b64:
        return jsonify({"error": "Frame required"}), 400

    # Liveness
    session = get_session(session_id)
    liveness = session.process_frame(frame_b64)
    if not liveness["is_live"]:
        return jsonify({
            "success": False,
            "message": f"Blink to verify liveness ({liveness['blink_count']}/2 blinks)",
            "liveness": liveness
        }), 200

    # Recognize
    try:
        faces = recognize_all_faces(frame_b64, db)
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 200

    recognized = [f for f in faces if f["recognized"]]
    if not recognized:
        return jsonify({"success": False, "message": "No registered face found in frame"}), 200

    face = recognized[0]
    uid = face["user_id"]
    today = date.today().isoformat()

    existing = db["attendance"].find_one({"user_id": ObjectId(uid), "date": today})
    if existing:
        return jsonify({
            "success": False, "already_marked": True,
            "message": f"{face['name']} already marked today",
            "record": serialize_record(existing)
        }), 200

    now = datetime.utcnow()
    user = db["users"].find_one({"_id": ObjectId(uid)})
    record = {
        "user_id": ObjectId(uid),
        "name": face["name"],
        "employee_id": face["employee_id"],
        "department": face.get("department", ""),
        "date": today,
        "time": now.strftime("%H:%M:%S"),
        "status": "present",
        "session_id": session_id,
        "confidence": face["confidence"],
        "profile_photo": user.get("profile_photo", "") if user else ""
    }
    result = db["attendance"].insert_one(record)
    record["_id"] = result.inserted_id
    clear_session(session_id)

    return jsonify({
        "success": True,
        "message": f"✅ {face['name']} — Attendance Marked",
        "record": serialize_record(record)
    }), 200


@attendance_bp.route("/reset-session", methods=["POST"])
@require_auth
def reset_session_ep():
    data = request.get_json()
    clear_session(data.get("session_id", "default"))
    return jsonify({"message": "Reset"}), 200


# ── History / Stats ──────────────────────────────────────────────────────────
@attendance_bp.route("/", methods=["GET"])
@require_auth
def get_attendance():
    db = get_db()
    date_filter = request.args.get("date")
    dept_filter = request.args.get("department")
    search = request.args.get("search", "").strip().lower()
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 50))

    query = {}
    if date_filter: query["date"] = date_filter
    if dept_filter: query["department"] = dept_filter

    records = list(db["attendance"].find(query).sort([("date", -1), ("time", -1)]))
    if search:
        records = [r for r in records if
                   search in r.get("name", "").lower() or
                   search in r.get("employee_id", "").lower()]

    total = len(records)
    records = records[(page-1)*limit : page*limit]
    return jsonify({"records": [serialize_record(r) for r in records], "total": total, "page": page, "limit": limit}), 200


@attendance_bp.route("/stats", methods=["GET"])
@require_auth
def get_stats():
    db = get_db()
    today = date.today().isoformat()
    from datetime import timedelta
    daily = []
    for i in range(6, -1, -1):
        d = (date.today() - timedelta(days=i)).isoformat()
        daily.append({"date": d, "count": db["attendance"].count_documents({"date": d})})
    dept_data = list(db["attendance"].aggregate([{"$group": {"_id": "$department", "count": {"$sum": 1}}}]))
    return jsonify({
        "total_users": db["users"].count_documents({}),
        "today_attendance": db["attendance"].count_documents({"date": today}),
        "registered_faces": db["users"].count_documents({"face_registered": True}),
        "attendance_rate": round(
            db["attendance"].count_documents({"date": today}) /
            max(db["users"].count_documents({}), 1) * 100, 1),
        "daily_trend": daily,
        "department_breakdown": [{"department": d["_id"], "count": d["count"]} for d in dept_data]
    }), 200


@attendance_bp.route("/today", methods=["GET"])
@require_auth
def today_attendance():
    db = get_db()
    records = list(db["attendance"].find({"date": date.today().isoformat()}).sort("time", -1))
    return jsonify([serialize_record(r) for r in records]), 200
