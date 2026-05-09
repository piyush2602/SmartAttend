from flask import Flask, jsonify
from flask_cors import CORS
from config import CORS_ORIGINS
from db import init_db, ping_db
from routes.auth_routes import auth_bp
from routes.user_routes import user_bp
from routes.attendance_routes import attendance_bp
from routes.export_routes import export_bp


def create_app():
    app = Flask(__name__)
    CORS(app, origins=CORS_ORIGINS, supports_credentials=True)

    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(user_bp, url_prefix="/api/users")
    app.register_blueprint(attendance_bp, url_prefix="/api/attendance")
    app.register_blueprint(export_bp, url_prefix="/api/export")

    @app.route("/api/health", methods=["GET"])
    def health():
        db_ok = ping_db()
        return jsonify({
            "status": "ok",
            "service": "FaceAttend API",
            "database": "connected" if db_ok else "unreachable",
        }), 200 if db_ok else 503

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"error": "Internal server error", "detail": str(e)}), 500

    return app


# Initialize app and database for production
print("[APP] Connecting to MongoDB Atlas...")
try:
    init_db()
    print("[APP] MongoDB Atlas -- Connected [OK]")
except Exception as exc:
    print(f"[APP] WARNING: DB init failed -- {exc}")
    print("[APP] Server will start anyway; DB operations will retry on each request.")

app = create_app()

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)

