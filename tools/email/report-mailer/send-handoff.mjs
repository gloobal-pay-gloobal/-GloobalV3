/**
 * Gloobal handoff mailer (one-off)
 * -------------------------------------------------------------
 * Sends an arbitrary Markdown file rendered inline in the house template,
 * with the original .md and a standalone .html attached. Same SMTP config
 * and anti-spam headers as send-report.mjs.
 *
 * Usage:
 *   node send-handoff.mjs --file="../../../docs/handoffs/GLOOBAL_SESSION_HANDOFF.md" \
 *     --to="a@x.com" --title="Session Handoff" --subject="..."
 */

import fs from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';
import 'dotenv/config';
import {
  renderEmail,
  renderSection,
  renderStandaloneHtml,
  markdownToHtml,
  buildHeaders,
  formatDate,
  formatStamp,
  parseDate,
} from './email-template.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  }),
);

const {
  SMTP_HOST = 'smtp.gmail.com',
  SMTP_PORT = '465',
  SMTP_USER,
  SMTP_PASS,
  FROM_NAME = 'Gloobal Team',
  FROM_EMAIL,
  REPLY_TO,
} = process.env;

if (!SMTP_USER || !SMTP_PASS) {
  console.error('Missing SMTP_USER / SMTP_PASS in report-mailer/.env.');
  process.exit(1);
}
const fromEmail = FROM_EMAIL || SMTP_USER;

const recipients = String(args.to || process.env.DEFAULT_RECIPIENTS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (recipients.length === 0) {
  console.error('No recipients. Pass --to="name@example.com".');
  process.exit(1);
}

const file = path.resolve(String(args.file || ''));
if (!args.file || !fs.existsSync(file)) {
  console.error(`Report file not found: ${file}`);
  process.exit(1);
}

const md = fs.readFileSync(file, 'utf8');
const title = String(args.title || path.basename(file, path.extname(file)));

let reportDate;
try {
  reportDate = parseDate(args.date);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
const dateStr = formatDate(reportDate);
const stamp = formatStamp(reportDate);

const contentHtml = markdownToHtml(md);
const base = title.replace(/\s+/g, '-');

const attachments = [
  {
    filename: `Gloobal-${base}-${stamp}.md`,
    content: md,
    contentType: 'text/markdown; charset=utf-8',
  },
  {
    filename: `Gloobal-${base}-${stamp}.html`,
    content: renderStandaloneHtml({
      title: `Gloobal — ${title}`,
      dateStr,
      contentHtml,
    }),
    contentType: 'text/html; charset=utf-8',
  },
];

const intro =
  String(args.intro || '') ||
  `Sharing the <strong>${title}</strong> for Gloobal, as of ${dateStr}. ` +
    'The full document is below and also attached (.md and .html).';

const { html, text } = renderEmail({
  fromName: FROM_NAME,
  intro,
  bodyHtml: renderSection({ title, contentHtml }),
  bodyText: md,
});

const subject = String(args.subject || `Gloobal — ${title} (${dateStr})`);

const port = Number(SMTP_PORT);
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port,
  secure: port === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

async function main() {
  try {
    await transporter.verify();
  } catch (e) {
    console.error('SMTP connection/auth failed:', e.message);
    process.exit(1);
  }

  let ok = 0;
  for (const to of recipients) {
    try {
      const info = await transporter.sendMail({
        from: { name: FROM_NAME, address: fromEmail },
        to,
        replyTo: REPLY_TO || fromEmail,
        subject,
        text,
        html,
        attachments,
        headers: buildHeaders(fromEmail),
      });
      ok += 1;
      console.log(`✓ Sent to ${to}  (id: ${info.messageId})`);
    } catch (e) {
      console.error(`✗ Failed to ${to}: ${e.message}`);
    }
  }
  console.log(`\nDone. ${ok}/${recipients.length} sent.  Subject: ${subject}`);
  process.exit(ok === recipients.length ? 0 : 1);
}

main();
