"""Credential-safe Terraform entrypoint. Never print .env values or place keys in TF vars.

python3 scripts/infra.py plan|apply [outside-repository credential env file]
The plan and state live outside the repository. Apply consumes the reviewed saved plan.
"""

import os
import shlex
import subprocess
import sys
import urllib.request
from pathlib import Path

root = Path(__file__).resolve().parent.parent
command = sys.argv[1] if len(sys.argv) > 1 else "plan"
if command not in {"plan", "apply"}:
    raise SystemExit("Only plan/apply are supported.")
credential = Path(sys.argv[2]).expanduser() if len(sys.argv) > 2 else root / ".env"
env = os.environ.copy()
for key in ["TF_LOG", "TF_LOG_PATH", "TF_LOG_PROVIDER", "TF_LOG_CORE"]:
    env.pop(key, None)
if credential.is_file():
    for line in credential.read_text().splitlines():
        if "=" not in line or line.lstrip().startswith("#"):
            continue
        key, value = line.split("=", 1)
        if key.strip() == "VULTR_API_KEY":
            parts = shlex.split(value, comments=True)
            if parts:
                env["VULTR_API_KEY"] = parts[0]
if not env.get("VULTR_API_KEY"):
    raise SystemExit("VULTR_API_KEY is missing; no cloud resource was changed.")
private = Path.home() / ".local/state/no-named"
private.mkdir(parents=True, exist_ok=True, mode=0o700)
os.chmod(private, 0o700)
os.umask(0o077)
ssh_key = private / "deploy_ed25519"
if not ssh_key.exists():
    subprocess.run(
        [
            "ssh-keygen",
            "-q",
            "-t",
            "ed25519",
            "-N",
            "",
            "-C",
            "family-finance-deploy",
            "-f",
            str(ssh_key),
        ],
        check=True,
    )
current_ip = (
    urllib.request.urlopen("https://api.ipify.org", timeout=15).read().decode().strip()
)
env["TF_VAR_admin_ipv4"] = current_ip
env["TF_VAR_ssh_public_key_path"] = str(ssh_key) + ".pub"
tf = ["terraform", f"-chdir={root / 'infra'}"]
subprocess.run(
    tf
    + ["init", "-reconfigure", f"-backend-config=path={private / 'terraform.tfstate'}"],
    env=env,
    check=True,
)
if command == "plan":
    subprocess.run(
        tf + ["plan", "-input=false", f"-out={private / 'deployment.tfplan'}"],
        env=env,
        check=True,
    )
else:
    subprocess.run(
        tf + ["apply", "-input=false", str(private / "deployment.tfplan")],
        env=env,
        check=True,
    )
