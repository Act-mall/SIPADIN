"""Auth utilities: bcrypt password hashing, JWT create/decode, FastAPI dependencies."""
from __future__ import annotations

import os
from datetime import datetime, timezone, timedelta
from typing import Optional

import bcrypt
import jwt
from fastapi import HTTPException
from mysql_db import MySQLDatabase as AsyncIOMotorDatabase

JWT_ALGORITHM = "HS256"


def get_jwt_secret() -> str:
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        raise RuntimeError("JWT_SECRET is not set")
    return secret


def get_jwt_expire_hours() -> int:
    try:
        return int(os.environ.get("JWT_EXPIRE_HOURS", "12"))
    except ValueError:
        return 12


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, nip: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "nip": nip,
        "role": role,
        "type": "access",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=get_jwt_expire_hours()),
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])


# ----- FastAPI dependency helpers -----

def _extract_bearer(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return None


async def get_current_user_from_db(
    db: AsyncIOMotorDatabase, token: Optional[str]
) -> dict:
    if not token:
        raise HTTPException(status_code=401, detail="Autentikasi diperlukan.")
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token kedaluwarsa.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid.")
    user = await db.pegawai.find_one({"id": payload.get("sub")}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Pengguna tidak ditemukan.")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Akun sudah dinonaktifkan.")
    return user
