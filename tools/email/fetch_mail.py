#!/usr/bin/env python3
"""Gloobal mail reader — fetches recent Gmail via IMAP and prints them as text.

WARNING: stores a Gmail App Password in PLAINTEXT (same account as mailer.py).
Keep this file private and OUT of any git repo. Rotate the password if leaked.

Gmail IMAP must be enabled: Gmail -> Settings -> Forwarding and POP/IMAP ->
Enable IMAP.

Usage:
    py fetch_mail.py            # latest 5 in INBOX
    py fetch_mail.py 10         # latest 10 in INBOX
    py fetch_mail.py 5 UNSEEN   # latest 5 unread
"""
import email
import imaplib
import sys
from email.header import decode_header, make_header
from email.utils import parseaddr

from config import USER, get_password

MAILBOX = "INBOX"
MAX_BODY_CHARS = 2000


def hdr(raw):
    """Decode a possibly RFC2047-encoded header to a plain string."""
    if not raw:
        return ""
    try:
        return str(make_header(decode_header(raw)))
    except Exception:
        return raw


def plain_body(msg):
    """Best-effort plaintext body; falls back to stripped HTML text."""
    if msg.is_multipart():
        # Prefer a text/plain part that isn't an attachment.
        for part in msg.walk():
            if part.get_content_type() == "text/plain" and "attachment" not in str(part.get("Content-Disposition")):
                return decode_part(part)
        for part in msg.walk():
            if part.get_content_type() == "text/html":
                return strip_html(decode_part(part))
        return ""
    payload = decode_part(msg)
    return payload if msg.get_content_type() == "text/plain" else strip_html(payload)


def decode_part(part):
    try:
        raw = part.get_payload(decode=True) or b""
        return raw.decode(part.get_content_charset() or "utf-8", errors="replace")
    except Exception:
        return ""


def strip_html(text):
    import re
    text = re.sub(r"(?is)<(script|style).*?>.*?</\1>", "", text)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    return re.sub(r"[ \t]*\n[ \t]*", "\n", text).strip()


def main():
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    criteria = sys.argv[2] if len(sys.argv) > 2 else "ALL"

    imap = imaplib.IMAP4_SSL("imap.gmail.com", 993)
    imap.login(USER, get_password())
    imap.select(MAILBOX, readonly=True)  # readonly => does not mark as read

    typ, data = imap.search(None, criteria)
    if typ != "OK":
        sys.exit(f"IMAP search failed: {typ}")

    ids = data[0].split()
    if not ids:
        print(f"No messages match {criteria!r} in {MAILBOX}.")
        imap.logout()
        return

    latest = ids[-count:][::-1]  # newest first
    print(f"Latest {len(latest)} of {len(ids)} in {MAILBOX} (criteria={criteria}):\n")

    for i, mid in enumerate(latest, 1):
        typ, msg_data = imap.fetch(mid, "(RFC822)")
        if typ != "OK":
            continue
        msg = email.message_from_bytes(msg_data[0][1])
        frm = parseaddr(hdr(msg.get("From")))
        body = plain_body(msg).strip()
        if len(body) > MAX_BODY_CHARS:
            body = body[:MAX_BODY_CHARS] + f"\n… [truncated, {len(body)} chars total]"
        print("=" * 70)
        print(f"[{i}] From:    {frm[1] or frm[0]}  ({frm[0]})" if frm[0] else f"[{i}] From:    {frm[1]}")
        print(f"    Subject: {hdr(msg.get('Subject'))}")
        print(f"    Date:    {hdr(msg.get('Date'))}")
        print("-" * 70)
        print(body or "(no plaintext body)")
        print()

    imap.logout()


if __name__ == "__main__":
    main()
