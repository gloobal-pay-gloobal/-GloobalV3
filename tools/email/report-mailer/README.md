# Gloobal Report Mailer

Sends the Gloobal **progress report** (`PROGRESS.md`) and **project report**
(`GLOOBAL_PROJECT_REPORT.md`) to any set of email addresses, on demand.

Designed to land in the inbox, not spam: real sender name, reply-to, a working
unsubscribe path, plain-text + HTML versions, and a human-worded body (no
"this is an automated / computer generated message" footer that Gmail flags).

## One-time setup

```powershell
cd tools/email/report-mailer   # from the repo root (D:\gloobalv3)
npm install
copy .env.example .env      # then edit .env
```

Edit `.env` and set:

- `SMTP_USER` — your Gmail address
- `SMTP_PASS` — a Gmail **App Password** (16 chars), NOT your login password
  - Google Account → Security → turn on **2-Step Verification**
  - → **App passwords** → generate → paste here (drop the spaces)
- `FROM_NAME` — a real person/team name
- `DEFAULT_RECIPIENTS` — optional fallback list

## Send

```powershell
# progress report to specific people
npm run send -- --report=progress --to="a@x.com,b@y.com"

# project report
npm run send -- --report=project --to="a@x.com"

# both reports in one email, custom subject
npm run send -- --report=both --to="a@x.com" --subject="Weekly Gloobal update"

# use DEFAULT_RECIPIENTS from .env
npm run progress
npm run project
```

## Options

| Flag | Values | Default |
|------|--------|---------|
| `--report` | `progress` \| `project` \| `both` | `progress` |
| `--to` | comma-separated emails | `DEFAULT_RECIPIENTS` |
| `--subject` | any string | auto: `Gloobal — … update (date)` |
| `--date` | `YYYY-MM-DD` | today |

`--date` back-dates a report: it sets the date shown in the email body **and**
the stamp in the attachment filenames, so you can send yesterday's report today
without it claiming to be today's.

```powershell
npm run send -- --report=progress --to="a@x.com" --date=2026-07-29
```

## The shared email template

`email-template.mjs` holds the house style — the one every Gloobal email uses.
It is the exact shell the progress reports have gone out in since 22 Jul 2026
(verified byte-identical when it was extracted): slate page, white rounded card,
greeting → intro → content → sign-off, grey footer with the unsubscribe line.

Both `send-report.mjs` and `send-message.mjs` import it. To write a new mailer,
import it too rather than pasting markup:

```js
import {
  renderEmail,       // { html, text } — the card shell around your content
  renderSection,     // a titled block inside the body (heading + intro + content)
  renderStandaloneHtml, // a self-contained .html for attachments
  markdownToHtml,    // marked, wrapped
  buildHeaders,      // List-Unsubscribe + List-Id, the anti-spam signals
  formatDate,        // "29 July 2026"  — body copy and subjects
  formatStamp,       // "2026-07-29"    — attachment filenames
  parseDate,         // YYYY-MM-DD → Date, pinned to midday UTC
  SECTION_DIVIDER,
  PALETTE,
} from './email-template.mjs';

const { html, text } = renderEmail({
  fromName: 'Gloobal Team',
  intro: 'Sharing the latest update on <strong>Gloobal</strong>.',
  bodyHtml: renderSection({ title: 'Progress Report', contentHtml }),
  bodyText: markdownSource,
});
```

`renderEmail` options — all optional except the body:

| Option | Purpose | Default |
|--------|---------|---------|
| `fromName` | name on the sign-off line | `Gloobal Team` |
| `greeting` | first line | `Hi,` |
| `intro` | one short paragraph above the content | none |
| `bodyHtml` / `bodyText` | the content itself | empty |
| `signOff` | line above the name | `Best regards,` |
| `closingNote` | small grey line under the name | `Reply to this email with any questions.` |
| `footerNote` | grey text outside the card | update-list + unsubscribe wording |
| `maxWidth` | card width in px | `640` |

Colours live in `PALETTE` — change them there and every email follows.

## Deliverability notes (avoid spam)

- Sends **one message per recipient** — no giant shared `To:` list.
- Includes `List-Unsubscribe` header + a real reply-to-unsubscribe line.
- Gmail App Password sends go through Google's SPF/DKIM automatically.
- First email to a new person: ask them to mark "Not spam" once. After that
  Gmail trusts the sender.
- Keep the subject calm — no ALL CAPS, no `!!!`, no "FREE"/"URGENT".

## Security

`.env` (real credentials) is **gitignored**. Never commit it.
