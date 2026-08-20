/**
 * Gloobal file sender
 * -------------------------------------------------------------
 * Emails one or more files as attachments, using the same SMTP config,
 * house template and anti-spam headers as the report mailer. The files
 * go out byte-for-byte as they are on disk — nothing is reformatted,
 * trimmed, or pasted into the body.
 *
 * Usage:
 *   node send-file.mjs --to="a@x.com,b@y.com" --file="../Frontend/src/App.jsx" \
 *     --subject="Gloobal — App.jsx" --intro="Latest UI source."
 *
 * Config comes from report-mailer/.env (gitignored).
 */

import { basename, resolve } from 'node:path';
import { readFileSync, statSync } from 'node:fs';
import nodemailer from 'nodemailer';
import 'dotenv/config';
import { renderEmail, buildHeaders } from './email-template.mjs';

// ---- CLI args ---------------------------------------------------------------
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

const files = String(args.file || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((p) => resolve(p));

if (files.length === 0) {
  console.error('No files. Pass --file="path/to/file".');
  process.exit(1);
}

const attachments = files.map((path) => {
  const size = statSync(path).size;
  console.log(`Attaching ${basename(path)} (${size.toLocaleString()} bytes) from ${path}`);
  return { filename: basename(path), content: readFileSync(path) };
});

const list = attachments.map((a) => a.filename).join(', ');
const subject = args.subject || `Gloobal — ${list}`;
const intro = args.intro ? String(args.intro) : '';

const bodyText = `${intro ? intro + '\n\n' : ''}Attached: ${list}`;
const bodyHtml = `
  ${intro ? `<p style="margin:0 0 16px;">${intro}</p>` : ''}
  <p style="margin:0 0 4px;">Attached: <strong>${list}</strong></p>`;

const { html, text } = renderEmail({
  fromName: FROM_NAME,
  bodyHtml,
  bodyText,
  signOff: 'Best regards,',
  closingNote: 'Reply to this email with any questions.',
  maxWidth: 600,
});

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
    console.error('SMTP auth failed:', e.message);
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
  console.log(`\nDone. ${ok}/${recipients.length} sent.`);
  process.exit(ok === recipients.length ? 0 : 1);
}

main();
