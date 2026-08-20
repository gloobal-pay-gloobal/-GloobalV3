/**
 * Gloobal report mailer
 * -------------------------------------------------------------
 * Sends the project's progress / project report to one or more
 * recipients on demand. Reports are read from the Markdown files
 * already in the repo root and rendered with the shared house
 * template in email-template.mjs.
 *
 * Usage:
 *   node send-report.mjs --report=progress --to="a@x.com,b@y.com"
 *   node send-report.mjs --report=project  --to="a@x.com"
 *   node send-report.mjs --report=both     --to="a@x.com" --subject="Weekly Gloobal update"
 *   node send-report.mjs --report=progress --to="a@x.com" --date=2026-07-29
 *
 * If --to is omitted it falls back to DEFAULT_RECIPIENTS in .env.
 * If --date is omitted the report is dated today. --date sets both the date
 * shown in the email and the stamp in the attachment filenames.
 *
 * Config lives in report-mailer/.env (gitignored). See .env.example.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
  SECTION_DIVIDER,
} from './email-template.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

// ---- CLI args ---------------------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) return [m[1], m[2]];
    return [a.replace(/^--/, ''), true];
  }),
);

const REPORTS = {
  progress: {
    file: 'PROGRESS.md',
    label: 'Progress Report',
    intro: 'Here is the latest progress update on Gloobal.',
  },
  project: {
    file: 'GLOOBAL_PROJECT_REPORT.md',
    label: 'Project Report',
    intro: 'Sharing the current Gloobal project report for your review.',
  },
};

const which = String(args.report || 'progress').toLowerCase();
const selected =
  which === 'both' ? ['progress', 'project'] : [which];

for (const key of selected) {
  if (!REPORTS[key]) {
    console.error(`Unknown report "${key}". Use progress | project | both.`);
    process.exit(1);
  }
}

// ---- Recipients -------------------------------------------------------------
const recipients = String(args.to || process.env.DEFAULT_RECIPIENTS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (recipients.length === 0) {
  console.error(
    'No recipients. Pass --to="name@example.com" or set DEFAULT_RECIPIENTS in .env.',
  );
  process.exit(1);
}

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
  console.error(
    'Missing SMTP_USER / SMTP_PASS in report-mailer/.env. See .env.example.',
  );
  process.exit(1);
}

const fromEmail = FROM_EMAIL || SMTP_USER;

// ---- Build report content ---------------------------------------------------
function readReport(key) {
  const cfg = REPORTS[key];
  const full = path.join(repoRoot, cfg.file);
  if (!fs.existsSync(full)) {
    console.error(`Report file not found: ${full}`);
    process.exit(1);
  }
  const md = fs.readFileSync(full, 'utf8');
  return { cfg, md };
}

let reportDate;
try {
  reportDate = parseDate(args.date);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
const dateStr = formatDate(reportDate);
const stamp = formatStamp(reportDate);

const sections = selected.map(readReport);

const bodyHtml = sections
  .map(({ cfg, md }) =>
    renderSection({
      title: cfg.label,
      intro: cfg.intro,
      contentHtml: markdownToHtml(md),
    }),
  )
  .join(SECTION_DIVIDER);

const bodyText = sections
  .map(({ cfg, md }) => `${cfg.label}\n${'='.repeat(cfg.label.length)}\n\n${md}`)
  .join('\n\n----------------------------------------\n\n');

// A clean, human subject. No ALL CAPS, no exclamation spam.
const reportNames = selected
  .map((k) => REPORTS[k].label.replace(' Report', ''))
  .join(' & ');
const subject =
  args.subject || `Gloobal — ${reportNames} update (${dateStr})`;

// ---- Attachments: original .md + a standalone rendered .html per report -----
const attachments = sections.flatMap(({ cfg, md }) => {
  const base = cfg.label.replace(/\s+/g, '-'); // Progress-Report
  return [
    {
      filename: `Gloobal-${base}-${stamp}.md`,
      content: md,
      contentType: 'text/markdown; charset=utf-8',
    },
    {
      filename: `Gloobal-${base}-${stamp}.html`,
      content: renderStandaloneHtml({
        title: `Gloobal — ${cfg.label}`,
        dateStr,
        contentHtml: markdownToHtml(md),
      }),
      contentType: 'text/html; charset=utf-8',
    },
  ];
});

// ---- Email body -------------------------------------------------------------
const intro =
  `Sharing the latest update on <strong>Gloobal</strong> below, as of ${dateStr}. ` +
  'The full report is also attached (.md and .html). Happy to walk through any part of it.';

const { html, text } = renderEmail({
  fromName: FROM_NAME,
  intro,
  bodyHtml,
  bodyText,
});

// ---- Transport --------------------------------------------------------------
const port = Number(SMTP_PORT);
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port,
  secure: port === 465, // 465 = implicit TLS, 587 = STARTTLS
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

// ---- Send (one message per recipient, no big shared To: list) ---------------
async function main() {
  try {
    await transporter.verify();
  } catch (e) {
    console.error('SMTP connection/auth failed:', e.message);
    console.error(
      'For Gmail: enable 2-Step Verification, then create an App Password ' +
        '(Google Account → Security → App passwords) and put it in SMTP_PASS.',
    );
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
  console.log(`Report(s): ${selected.join(', ')}  |  dated ${dateStr}`);
  process.exit(ok === recipients.length ? 0 : 1);
}

main();
