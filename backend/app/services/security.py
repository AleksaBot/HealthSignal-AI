from datetime import datetime, timedelta
import secrets

from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return pwd_context.verify(password, hashed_password)


def generate_session_token() -> str:
    return secrets.token_urlsafe(32)


def session_expiry(days: int = 7) -> datetime:
    return datetime.utcnow() + timedelta(days=days)
