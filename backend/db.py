from pymongo import MongoClient
from config import MONGO_URI, DB_NAME

_client = None


def get_client():
    global _client
    if _client is None:
        _client = MongoClient(
            MONGO_URI,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            socketTimeoutMS=10000,
            retryWrites=True,
            w="majority",
        )
    return _client


def get_db():
    return get_client()[DB_NAME]


def ping_db():
    """Return True if Atlas is reachable, False otherwise."""
    try:
        get_client().admin.command("ping")
        return True
    except Exception:
        return False


def init_db():
    """Initialize collections and indexes."""
    db = get_db()
    # Unique indexes
    db["users"].create_index("employee_id", unique=True)
    db["users"].create_index("email", unique=True)
    db["admins"].create_index("username", unique=True)
    db["attendance"].create_index([("user_id", 1), ("date", 1)])
    db["embeddings"].create_index("user_id")
    print("[DB] Indexes created successfully.")

