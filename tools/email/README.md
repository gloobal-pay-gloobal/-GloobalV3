# Email and reporting

Two mailers, both for sending Gloobal progress reports and session handoffs.
They exist because they were written at different times; neither is a
replacement for the other yet.

| | `mailer.py` (Python) | `report-mailer/` (Node) |
| --- | --- | --- |
| Sends | `report.md` + `report.html`, attaches `progress-report.txt` | Markdown files rendered to HTML |
| Entry points | `mailer.py`, `send.bat` | `send-report.mjs`, `send-handoff.mjs`, `send-file.mjs`, `send-message.mjs` |
| Also reads mail | yes — `fetch_mail.py` | no |
| Account | `noreplygloobalpay@gmail.com` | `gloobalpay@gmail.com` |

`send-handoff.mjs` has no Python equivalent, and `fetch_mail.py` has no Node
equivalent, which is why both are kept.

## Credentials — none are in this repository

Both tools read their password at run time and neither has it in source.

**Python:** `GMAIL_APP_PASSWORD` environment variable, else a `secret.txt`
placed next to `config.py`. Copy `secret.txt.example` to `secret.txt` and
paste a Google App Password into it. `secret.txt` is gitignored.

**Node:** copy `report-mailer/.env.example` to `report-mailer/.env` and fill
in `SMTP_PASS` with a Google App Password. `.env` is gitignored.

Generate an App Password at: Google Account → Security → 2-Step
Verification → App passwords. A normal account password will not work.

## Running

```bash
# Python — from this folder
python tools/email/mailer.py [recipient@example.com]

# Node — from tools/email/report-mailer (npm install first)
node send-handoff.mjs --file="../../../docs/handoffs/GLOOBAL_SESSION_HANDOFF.md"
```
