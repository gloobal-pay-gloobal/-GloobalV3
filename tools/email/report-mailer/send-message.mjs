/**
 * Gloobal one-off message sender
 * -------------------------------------------------------------
 * Sends a custom email (welcome note, announcement, etc.) using the
 * same SMTP config + anti-spam headers as the report mailer.
 *
 * Usage:
 *   node send-message.mjs --template=welcome --to="a@x.com"
 *   node send-message.mjs --to="a@x.com" --subject="Hello" --body="Your text here"
 *
 * Config comes from report-mailer/.env (gitignored).
 */

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

// ---- SMTP config ------------------------------------------------------------
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

// ---- Recipients -------------------------------------------------------------
const recipients = String(args.to || process.env.DEFAULT_RECIPIENTS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (recipients.length === 0) {
  console.error('No recipients. Pass --to="name@example.com".');
  process.exit(1);
}

// ---- Templates --------------------------------------------------------------
const templates = {
  welcome: {
    subject: 'Welcome to the Gloobal family',
    // Human, warm, no spammy words. The greeting and sign-off come from the
    // shared template — templates supply the middle only.
    text: `Thank you for becoming part of the Gloobal family. We're really glad to have you with us.

Gloobal is built to make sending and receiving money across borders simple, fast and borderless. Now that you're on board, we'll keep working to make your experience smoother with every update.

If you ever have a question, a suggestion, or something isn't working the way you expected, just reply to this email. We read every message.

Welcome aboard, and thank you for trusting us.`,
    html: `
      <p style="margin:0 0 16px;">
        Thank you for becoming part of the <strong>Gloobal family</strong>.
        We're really glad to have you with us.
      </p>
      <p style="margin:0 0 16px;">
        Gloobal is built to make sending and receiving money across borders
        simple, fast and borderless. Now that you're on board, we'll keep working
        to make your experience smoother with every update.
      </p>
      <p style="margin:0 0 16px;">
        If you ever have a question, a suggestion, or something isn't working the
        way you expected, just reply to this email — we read every message.
      </p>
      <p style="margin:0 0 4px;">Welcome aboard, and thank you for trusting us.</p>`,
  },
};

let subject;
let textCore;
let htmlCore;

if (args.template) {
  const t = templates[String(args.template).toLowerCase()];
  if (!t) {
    console.error(`Unknown template. Available: ${Object.keys(templates).join(', ')}`);
    process.exit(1);
  }
  subject = args.subject || t.subject;
  textCore = t.text;
  htmlCore = t.html;
} else {
  if (!args.body) {
    console.error('Pass --template=welcome OR --subject and --body.');
    process.exit(1);
  }
  subject = args.subject || 'A note from Gloobal';
  textCore = String(args.body);
  htmlCore = String(args.body)
    .split('\n')
    .map((line) => `<p style="margin:0 0 16px;">${line}</p>`)
    .join('\n');
}

// ---- HTML shell (the shared house template) ---------------------------------
const { html, text } = renderEmail({
  fromName: FROM_NAME,
  bodyHtml: htmlCore,
  bodyText: textCore,
  signOff: 'Warm regards,',
  closingNote: '',
  footerNote:
    "You're receiving this because you signed up with Gloobal. " +
    'To stop these emails, just reply with "unsubscribe".',
  maxWidth: 600,
});

// ---- Send -------------------------------------------------------------------
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
