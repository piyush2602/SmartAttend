from flask import Blueprint, request, jsonify
from bson import ObjectId
from datetime import datetime
from db import get_db
from utils.auth_middleware import require_auth
from services.face_service import (
    generate_face_sample, save_face_sample, delete_user_embeddings, image_to_base64
)

user_bp = Blueprint("users", __name__)


def serialize_user(u):
    return {
        "id": str(u["_id"]),
        "name": u.get("name", ""),
        "employee_id": u.get("employee_id", ""),
        "department": u.get("department", ""),
        "email": u.get("email", ""),
        "face_registered": u.get("face_registered", False),
        "profile_photo": u.get("profile_photo", ""),   # base64 or ""
        "created_at": u.get("created_at", datetime.utcnow()).isoformat()
    }


@user_bp.route("/", methods=["GET"])
@require_auth
def list_users():
    db = get_db()
    users = list(db["users"].find().sort("created_at", -1))
    return jsonify([serialize_user(u) for u in users]), 200


@user_bp.route("/", methods=["POST"])
@require_auth
def create_user():
    data = request.get_json()
    name = data.get("name", "").strip()
    employee_id = data.get("employee_id", "").strip()
    department = data.get("department", "").strip()
    email = data.get("email", "").strip()

    if not all([name, employee_id, department, email]):
        return jsonify({"error": "All fields are required"}), 400

    db = get_db()
    if db["users"].find_one({"employee_id": employee_id}):
        return jsonify({"error": "Employee ID already exists"}), 409
    if db["users"].find_one({"email": email}):
        return jsonify({"error": "Email already exists"}), 409

    doc = {
        "name": name, "employee_id": employee_id,
        "department": department, "email": email,
        "face_registered": False, "profile_photo": "",
        "created_at": datetime.utcnow()
    }
    result = db["users"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return jsonify(serialize_user(doc)), 201


@user_bp.route("/<user_id>", methods=["GET"])
@require_auth
def get_user(user_id):
    db = get_db()
    u = db["users"].find_one({"_id": ObjectId(user_id)})
    if not u:
        return jsonify({"error": "Not found"}), 404
    return jsonify(serialize_user(u)), 200


@user_bp.route("/<user_id>", methods=["PUT"])
@require_auth
def update_user(user_id):
    data = request.get_json()
    db = get_db()
    update = {k: data[k] for k in ["name", "department", "email"] if k in data}
    if not update:
        return jsonify({"error": "Nothing to update"}), 400
    db["users"].update_one({"_id": ObjectId(user_id)}, {"$set": update})
    u = db["users"].find_one({"_id": ObjectId(user_id)})
    return jsonify(serialize_user(u)), 200


@user_bp.route("/<user_id>", methods=["DELETE"])
@require_auth
def delete_user(user_id):
    db = get_db()
    delete_user_embeddings(user_id, db)
    db["attendance"].delete_many({"user_id": ObjectId(user_id)})
    result = db["users"].delete_one({"_id": ObjectId(user_id)})
    if result.deleted_count == 0:
        return jsonify({"error": "Not found"}), 404
    return jsonify({"message": "Deleted"}), 200


@user_bp.route("/<user_id>/register-face", methods=["POST"])
@require_auth
def register_face(user_id):
    """
    Accept list of base64 frames.
    Extract face from each, store pixel data + preview in embeddings.
    Store best face as profile_photo in users collection.
    """
    db = get_db()
    u = db["users"].find_one({"_id": ObjectId(user_id)})
    if not u:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()
    frames = data.get("frames", [])
    if not frames:
        return jsonify({"error": "No frames provided"}), 400

    # Remove existing embeddings
    delete_user_embeddings(user_id, db)

    saved = 0
    errors = []
    best_photo = None

    for i, frame_b64 in enumerate(frames[:8]):
        try:
            pixels, face_b64 = generate_face_sample(frame_b64)
            save_face_sample(user_id, pixels, face_b64, i, db)
            if saved == 0:
                best_photo = face_b64  # use first good face as profile photo
            saved += 1
        except Exception as e:
            errors.append(f"Frame {i}: {str(e)}")

    if saved == 0:
        return jsonify({"error": "No valid face detected in any frame", "details": errors}), 422

    # Update user record
    db["users"].update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"face_registered": True, "profile_photo": best_photo or ""}}
    )

    return jsonify({
        "message": f"{saved} face samples registered successfully",
        "errors": errors,
        "profile_photo": best_photo or ""
    }), 200


@user_bp.route("/<user_id>/samples", methods=["GET"])
@require_auth
def get_face_samples(user_id):
    """Return face preview images for a user."""
    db = get_db()
    docs = list(db["embeddings"].find({"user_id": ObjectId(user_id)}, {"face_preview": 1, "sample_index": 1}))
    return jsonify([{"index": d["sample_index"], "preview": d.get("face_preview", "")} for d in docs]), 200
