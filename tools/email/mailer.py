#!/usr/bin/env python3
"""Gloobal mailer — sends the progress email over Gmail SMTP.

The email has:
  - an HTML body (report.html) with a plaintext fallback (report.md), and
  - progress-report.txt attached.

The App Password is NOT stored here — it comes from config.get_password()
(env var GMAIL_APP_PASSWORD or a local secret.txt). See config.py.

Usage:
    py mailer.py                      # send to the default recipient
    py mailer.py someone@example.com  # send to a different recipient
Or double-click send.bat.
"""
import smtplib
import sys
from email.message import EmailMessage
from pathlib import Path

from config import SENDER, get_password

DEFAULT_TO = "jackass66982@gmail.com"
SUBJECT = "Gloobal - Progress Report (today)"
HERE = Path(__file__).parent


def main():
    to = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_TO

    body_md = HERE / "report.md"       # plaintext message body
    body_html = HERE / "report.html"   # styled HTML message body
    attachment = HERE / "progress-report.txt"  # detailed report, attached

    if not body_md.exists():
        sys.exit(f"ERROR: message body not found: {body_md}")

    msg = EmailMessage()
    msg["From"] = f"Gloobal Pay <{SENDER}>"
    msg["To"] = to
    msg["Subject"] = SUBJECT

    # Message body: plaintext + HTML alternative.
    msg.set_content(body_md.read_text(encoding="utf-8"))
    if body_html.exists():
        msg.add_alternative(body_html.read_text(encoding="utf-8"), subtype="html")
        fmt = "HTML + text"
    else:
        fmt = "text only"

    # Attach the detailed progress report as a .txt file.
    attached = ""
    if attachment.exists():
        msg.add_attachment(
            attachment.read_text(encoding="utf-8").encode("utf-8"),
            maintype="text",
            subtype="plain",
            filename=attachment.name,
        )
        attached = f" + attachment {attachment.name}"

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
        smtp.login(SENDER, get_password())
        smtp.send_message(msg)

    print(f"Sent ({fmt}{attached}) from {SENDER} to {to}.")


if __name__ == "__main__":
    main()
