from flask import Blueprint, request, jsonify
from db import get_db
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
            {"id": user_id},
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
    # Trigger verification
    result = fingerprint_service.verify()
    
    if result["success"]:
        finger_id = result["fingerprint_id"]
        db = get_db()
        user = db["users"].find_one({"fingerprint_id": finger_id})
        
        if user:
            # Mark attendance
            now = datetime.now()
            today = now.strftime("%Y-%m-%d")
            time = now.strftime("%H:%M:%S")
            
            # Check if already marked
            existing = db["attendance"].find_one({
                "employee_id": user["employee_id"],
                "date": today
            })
            
            if not existing:
                db["attendance"].insert_one({
                    "employee_id": user["employee_id"],
                    "name": user["name"],
                    "department": user["department"],
                    "date": today,
                    "time": time,
                    "method": "fingerprint"
                })
                return jsonify({
                    "success": True, 
                    "message": f"Attendance marked for {user['name']}",
                    "user": {
                        "name": user["name"],
                        "employee_id": user["employee_id"]
                    }
                })
            else:
                return jsonify({"success": True, "message": "Attendance already marked today", "already_marked": True})
        else:
            return jsonify({"error": "Fingerprint recognized but user not found in database"}), 404
    else:
        return jsonify({"error": result["message"]}), 401
