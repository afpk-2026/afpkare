"""Individual accounts and expiring sessions backed by SQLite."""

from __future__ import annotations
from contextlib import contextmanager
import hashlib
import hmac
import os
from pathlib import Path
import re
import secrets
import sqlite3
import time

COOKIE = "care_account"
LIFETIME = 8 * 60 * 60


def password_hash(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=1)


def normalize_username(username: str) -> str:
    value = username.strip().lower()
    if not re.fullmatch(r"[a-z0-9][a-z0-9_.-]{2,31}", value):
        raise ValueError("아이디는 영문 소문자·숫자·밑줄·점·하이픈으로 3~32자 입력하세요.")
    return value


@contextmanager
def database():
    path = Path(os.getenv("CARE_AUTH_DB") or str(Path.home() / ".local/share/care-partners/accounts.sqlite3"))
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    connection = sqlite3.connect(path, timeout=5)
    try:
        os.chmod(path, 0o600)
        connection.execute("PRAGMA foreign_keys = ON")
        connection.executescript("""
            CREATE TABLE IF NOT EXISTS accounts (
                id INTEGER PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                salt BLOB NOT NULL,
                password_hash BLOB NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                digest BLOB PRIMARY KEY,
                account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
                expires REAL NOT NULL
            );
            CREATE INDEX IF NOT EXISTS session_expiry ON sessions(expires);
        """)
        with connection:
            yield connection
    finally:
        connection.close()


def create_account(username: str, password: str) -> int:
    username = normalize_username(username)
    if not 12 <= len(password) <= 128:
        raise ValueError("비밀번호는 12~128자로 입력하세요.")
    salt = secrets.token_bytes(16)
    digest = password_hash(password, salt)
    with database() as connection:
        try:
            cursor = connection.execute(
                "INSERT INTO accounts(username, salt, password_hash) VALUES (?, ?, ?)",
                (username, salt, digest),
            )
        except sqlite3.IntegrityError:
            raise ValueError("이미 사용 중인 아이디입니다.") from None
        return cursor.lastrowid


def verify_account(username: str, password: str) -> int | None:
    with database() as connection:
        row = connection.execute(
            "SELECT id, salt, password_hash FROM accounts WHERE username = ?",
            (username.strip().lower(),),
        ).fetchone()
    # Unknown accounts perform the same password work.
    salt, expected = (row[1], row[2]) if row else (bytes(16), bytes(64))
    actual = password_hash(password, salt)
    return row[0] if hmac.compare_digest(actual, expected) and row else None


def secure_transport(request) -> bool:
    # Shipped nginx overwrites this header; the backend is not publicly exposed.
    return request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"


def local_http() -> bool:
    return os.getenv("CARE_DEMO_LOCAL_HTTP") == "1"


def token_digest(token: str) -> bytes:
    return hashlib.sha256(token.encode()).digest()


def authenticated(request) -> bool:
    if not (secure_transport(request) or local_http()):
        return False
    token = request.cookies.get(COOKIE, "")
    if not token:
        return False
    with database() as connection:
        return connection.execute(
            "SELECT 1 FROM sessions WHERE digest = ? AND expires > ?",
            (token_digest(token), time.time()),
        ).fetchone() is not None


def issue_session(account_id: int, previous_token: str = "") -> str:
    token = secrets.token_urlsafe(32)
    with database() as connection:
        connection.execute("DELETE FROM sessions WHERE expires <= ? OR digest = ?",
                           (time.time(), token_digest(previous_token)))
        connection.execute("INSERT INTO sessions VALUES (?, ?, ?)",
                           (token_digest(token), account_id, time.time() + LIFETIME))
    return token


def revoke(request):
    token = request.cookies.get(COOKIE)
    if token:
        with database() as connection:
            connection.execute("DELETE FROM sessions WHERE digest = ?", (token_digest(token),))


if __name__ == "__main__":
    from getpass import getpass

    username = input("새 계정 아이디: ")
    password = getpass("새 비밀번호 (12~128자): ")
    if password != getpass("비밀번호 확인: "):
        raise SystemExit("비밀번호 확인 값이 다릅니다.")
    try:
        create_account(username, password)
    except ValueError as error:
        raise SystemExit(str(error)) from None
    print("개인 계정을 생성했습니다.")
