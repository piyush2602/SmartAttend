from flask import Blueprint, request, jsonify
from db import get_db
from utils.jwt_utils import hash_password, verify_password, create_token
from utils.auth_middleware import require_auth

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    db = get_db()
    admin = db["admins"].find_one({"username": username})
    if not admin or not verify_password(password, admin["password_hash"]):
        return jsonify({"error": "Invalid credentials"}), 401

    token = create_token({"admin_id": str(admin["_id"]), "username": username})
    return jsonify({"token": token, "username": username}), 200


@auth_bp.route("/verify", methods=["GET"])
@require_auth
def verify():
    return jsonify({"valid": True, "admin": request.admin}), 200


@auth_bp.route("/setup", methods=["POST"])
def setup():
    """One-time admin seed — disabled if admin already exists."""
    db = get_db()
    if db["admins"].count_documents({}) > 0:
        return jsonify({"error": "Admin already exists. Use /login."}), 403
    data = request.get_json()
    username = data.get("username", "admin")
    password = data.get("password", "admin123")
    email = data.get("email", "admin@faceatten.com")
    db["admins"].insert_one({
        "username": username,
        "password_hash": hash_password(password),
        "email": email
    })
    return jsonify({"message": f"Admin '{username}' created."}), 201
