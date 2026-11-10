"""Local launcher: load only the named LLM variables without printing their contents."""

import os
import shlex
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parent.parent
env = os.environ.copy()
path = root / ".env"
if path.exists():
    for line in path.read_text().splitlines():
        if "=" not in line or line.lstrip().startswith("#"):
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if key in {"UPSTAGE_LLM_API_KEY", "UPSTAGE_MODEL", "CARE_DEMO_PASSWORD_HASH"}:
            parts = shlex.split(value, comments=True)
            env.setdefault(key, parts[0] if parts else "")
env["CARE_DEMO_LOCAL_HTTP"] = "1"
raise SystemExit(
    subprocess.call(
        [
            str(root / "backend/.venv/bin/uvicorn"),
            "app.main:app",
            "--app-dir",
            str(root / "backend"),
            "--host",
            "127.0.0.1",
            "--port",
            os.getenv("CARE_API_PORT", "8000"),
            "--no-access-log",
        ],
        env=env,
    )
)
