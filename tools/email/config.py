"""Shared config for the Gloobal mailer/reader.

The App Password is NOT stored here. It is read at run time from:
  1. the GMAIL_APP_PASSWORD environment variable, if set, else
  2. a local file `secret.txt` sitting next to these scripts (first line).

Keep secret.txt private and out of any git repo. Spaces are stripped, so you
can paste the App Password exactly as Google shows it ("abcd efgh ijkl mnop").
"""
import os
from pathlib import Path

# The Gmail account these scripts sign in as (sender + mailbox owner).
ACCOUNT = "noreplygloobalpay@gmail.com"
SENDER = ACCOUNT
USER = ACCOUNT


def get_password():
    """Return the Gmail App Password from env var or secret.txt, or exit."""
    env = os.environ.get("GMAIL_APP_PASSWORD")
    if env and env.strip():
        return env.replace(" ", "").strip()

    secret = Path(__file__).with_name("secret.txt")
    if secret.exists():
        pw = secret.read_text(encoding="utf-8").strip()
        if pw:
            return pw.replace(" ", "")

    raise SystemExit(
        "No Gmail App Password found.\n"
        "  Put it in secret.txt (next to this script), or\n"
        "  set the GMAIL_APP_PASSWORD environment variable.\n"
        "Generate one at: Google Account -> Security -> App passwords."
    )
