"""Single-process demo sessions. Restarting the API invalidates every session."""

from __future__ import annotations
import hashlib
import hmac
import os
import re
import secrets
import time

COOKIE = "care_demo"
LIFETIME = 8 * 60 * 60
MAX_SESSIONS = 1024
sessions: dict[bytes, float] = {}


def password_hash(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=1)


def credentials():
    value = os.getenv("CARE_DEMO_PASSWORD_HASH", "")
    if not re.fullmatch(r"[0-9a-f]{32}:[0-9a-f]{128}", value):
        return None
    salt, digest = value.split(":")
    return bytes.fromhex(salt), bytes.fromhex(digest)


def secure_transport(request) -> bool:
    # Both shipped nginx configurations overwrite this header. The backend
    # container is not published, and the local launcher binds only to loopback.
    return request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"


def local_http() -> bool:
    return os.getenv("CARE_DEMO_LOCAL_HTTP") == "1"


def token_digest(token: str) -> bytes:
    return hashlib.sha256(token.encode()).digest()


def authenticated(request) -> bool:
    if not credentials() or not (secure_transport(request) or local_http()):
        return False
    token = request.cookies.get(COOKIE, "")
    return bool(token and sessions.get(token_digest(token), 0) > time.monotonic())


def issue_session() -> str | None:
    now = time.monotonic()
    for digest, deadline in list(sessions.items()):
        if deadline <= now:
            del sessions[digest]
    if len(sessions) >= MAX_SESSIONS:
        return None
    token = secrets.token_urlsafe(32)
    sessions[token_digest(token)] = now + LIFETIME
    return token


def revoke(request):
    token = request.cookies.get(COOKIE)
    if token:
        sessions.pop(token_digest(token), None)


if __name__ == "__main__":
    from getpass import getpass

    password = getpass("새 데모 비밀번호 (16~128자): ")
    if not 16 <= len(password) <= 128 or password != getpass("비밀번호 확인: "):
        raise SystemExit("비밀번호 길이 또는 확인 값을 다시 확인해 주세요.")
    salt = secrets.token_bytes(16)
    print(f"CARE_DEMO_PASSWORD_HASH={salt.hex()}:{password_hash(password, salt).hex()}")
