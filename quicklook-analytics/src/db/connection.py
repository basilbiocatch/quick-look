"""Async MongoDB connection using Motor."""
import os
from motor.motor_asyncio import AsyncIOMotorClient

_client: AsyncIOMotorClient | None = None
_db = None


def get_client() -> AsyncIOMotorClient:
    """Return the singleton Motor client. Connects using QUICKLOOK_DB."""
    global _client
    if _client is None:
        uri = os.getenv("QUICKLOOK_DB", "").strip()
        if not uri or (not uri.startswith("mongodb://") and not uri.startswith("mongodb+srv://")):
            raise ValueError(
                "QUICKLOOK_DB is required and must start with mongodb:// or mongodb+srv://. "
                "Set it in .env or environment."
            )
        _client = AsyncIOMotorClient(
            uri,
            serverSelectionTimeoutMS=30000,
            socketTimeoutMS=45000,
            connectTimeoutMS=30000,
            maxPoolSize=10,
            minPoolSize=2,
            retryWrites=True,
            retryReads=True,
        )
    return _client


def get_database():
    """Return the database instance (same DB as quicklook-server)."""
    global _db
    if _db is None:
        client = get_client()
        # Use default db from URI (e.g. quicklook from mongodb+srv://.../quicklook)
        _db = client.get_default_database()
    return _db
