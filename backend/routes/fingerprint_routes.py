from flask import Blueprint, request, jsonify
from db import get_db
from bson import ObjectId
from services.fingerprint_service import fingerprint_service
from utils.auth_middleware import require_auth
from datetime import datetime

fingerprint_bp = Blueprint("fingerprint", __name__)

@fingerprint_bp.route("/enroll", methods=["POST"])
@require_auth
def enroll_fingerprint():
    data = request.json
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "User ID is required"}), 400

    # Trigger enrollment
    result = fingerprint_service.enroll(user_id)
    
    if result["success"]:
        db = get_db()
        # Update user with fingerprint ID and template data
        db["users"].update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "fingerprint_id": result["fingerprint_id"], 
                    "fingerprint_template": result["template"],
                    "fingerprint_registered": True
                }
            }
        )
        return jsonify(result)
    else:
        return jsonify({"error": result["message"]}), 500

@fingerprint_bp.route("/verify", methods=["POST"])
@require_auth
def verify_fingerprint():
    data = request.json or {}
    target_user_id = data.get("user_id")
    print(f"[FingerprintRoute] Verify request for user_id: {target_user_id}")

    db = get_db()
    target_finger_id = None
    if target_user_id:
        user_doc = db["users"].find_one({"_id": ObjectId(target_user_id)})
        if user_doc:
            target_finger_id = user_doc.get("fingerprint_id")
            print(f"[FingerprintRoute] Found target user: {user_doc.get('name')}, finger_id: {target_finger_id}")

    # Trigger verification
    result = fingerprint_service.verify(target_id=target_finger_id)
    print(f"[FingerprintRoute] Service result: {result}")
    
    if result["success"]:
        finger_id = result["fingerprint_id"]
        
        # If target_user_id is provided, we check specifically for that user
        if target_user_id:
            user = db["users"].find_one({"_id": ObjectId(target_user_id)})
        else:
            # Fallback to general search (Identification mode)
            user = db["users"].find_one({"fingerprint_id": finger_id})
        
        if user:
            # Record attendance
            now = datetime.utcnow()
            today = now.strftime("%Y-%m-%d")
            time = now.strftime("%H:%M:%S")
            
            existing = db["attendance"].find_one({
                "user_id": user["_id"],
                "date": today
            })
            
            if not existing:
                record = {
                    "user_id": user["_id"],
                    "name": user.get("name", ""),
                    "employee_id": user.get("employee_id", ""),
                    "department": user.get("department", ""),
                    "date": today,
                    "time": time,
                    "status": "present",
                    "method": "fingerprint",
                    "profile_photo": user.get("profile_photo", "")
                }
                db["attendance"].insert_one(record)
                return jsonify({
                    "success": True, 
                    "message": f"✅ Attendance marked for {user['name']}",
                    "user": {
                        "name": user["name"],
                        "employee_id": user["employee_id"]
                    }
                }), 200
            else:
                return jsonify({
                    "success": True, 
                    "message": "Attendance already marked today", 
                    "already_marked": True,
                    "user": {
                        "name": user["name"],
                        "employee_id": user["employee_id"]
                    }
                }), 200
        else:
            return jsonify({"error": "Fingerprint recognized but user not found in database"}), 404
    else:
        return jsonify({"error": result["message"]}), 401
