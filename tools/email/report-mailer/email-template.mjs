/**
 * Gloobal email template
 * -------------------------------------------------------------
 * The one house style for every Gloobal email we send: the card-on-slate
 * shell, the human greeting/sign-off, the standalone HTML attachment, and
 * the anti-spam headers. This is the exact look that went out with the
 * progress reports — kept in one place so any new mailer reuses it instead
 * of re-inventing the markup.
 *
 * Use it like this:
 *
 *   import { renderEmail, buildHeaders, formatDate } from './email-template.mjs';
 *
 *   const mail = renderEmail({
 *     fromName: 'Gloobal Team',
 *     intro: 'Sharing the latest update on Gloobal below.',
 *     bodyHtml: '<p>…</p>',
 *     bodyText: '…',
 *   });
 *   transporter.sendMail({ ...mail, to, subject, headers: buildHeaders(fromEmail) });
 *
 * Nothing here talks to SMTP or reads the filesystem — it only builds strings,
 * so it is safe to import from any script.
 */

import { marked } from 'marked';

// ---- Palette ----------------------------------------------------------------
// Slate scale, matching the report emails. Change these and every mail follows.
export const PALETTE = {
  pageBg: '#f1f5f9',
  cardBg: '#ffffff',
  border: '#e2e8f0',
  text: '#1e293b',
  heading: '#0f172a',
  muted: '#475569',
  subtle: '#64748b',
  faint: '#94a3b8',
  codeBg: '#f1f5f9',
  preBg: '#0f172a',
  preText: '#e2e8f0',
};

const FONT_STACK =
  '-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif';

// ---- Dates ------------------------------------------------------------------
/**
 * "29 July 2026" — the human date used in subject lines and body copy.
 */
export function formatDate(date = new Date()) {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * "2026-07-29" — the stamp used in attachment filenames.
 */
export function formatStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/**
 * Accepts YYYY-MM-DD (or anything Date understands) and returns a Date pinned
 * to midday UTC, so the stamp never slides a day either side of the timezone.
 */
export function parseDate(input) {
  if (!input) return new Date();
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(String(input))
    ? `${input}T12:00:00Z`
    : String(input);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Unrecognised date: "${input}". Use YYYY-MM-DD.`);
  }
  return d;
}

// ---- Markdown ---------------------------------------------------------------
export function markdownToHtml(md) {
  return marked.parse(md);
}

// ---- Section helper ---------------------------------------------------------
/**
 * One titled block inside the email body: a heading, a one-line intro, then
 * the rendered content. Reports use one section per report file.
 */
export function renderSection({ title, intro = '', contentHtml }) {
  const introHtml = intro
    ? `\n    <p style="margin:0 0 16px;color:${PALETTE.muted};">${intro}</p>`
    : '';
  return `
    <h2 style="font-size:18px;margin:28px 0 8px;color:${PALETTE.heading};">${title}</h2>${introHtml}
    <div class="report-body">${contentHtml}</div>`;
}

export const SECTION_DIVIDER = `\n<hr style="border:none;border-top:1px solid ${PALETTE.border};margin:32px 0;">\n`;

// ---- The email shell --------------------------------------------------------
/**
 * Wraps body content in the house shell and returns { html, text } ready to
 * hand to nodemailer.
 *
 * Everything except `bodyHtml` has a sensible default, so a minimal call is
 * renderEmail({ bodyHtml, bodyText }).
 *
 * Written to read like a person wrote it: greeting, short intro, the content,
 * a real sign-off. No "this is an automated / computer generated message"
 * footer — Gmail treats that as a spam signal.
 */
export function renderEmail({
  fromName = 'Gloobal Team',
  greeting = 'Hi,',
  intro = '',
  bodyHtml = '',
  bodyText = '',
  signOff = 'Best regards,',
  closingNote = 'Reply to this email with any questions.',
  footerNote = 'You are receiving this because you are on the Gloobal update list. ' +
    'To stop receiving these, just reply with "unsubscribe" and we\'ll remove you.',
  maxWidth = 640,
} = {}) {
  const introHtml = intro
    ? `\n      <p style="margin:0 0 8px;">
        ${intro}
      </p>`
    : '';
  const closingHtml = closingNote
    ? `\n      <p style="margin:2px 0 0;color:${PALETTE.subtle};font-size:13px;">
        ${closingNote}
      </p>`
    : '';

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:${PALETTE.pageBg};">
  <div style="max-width:${maxWidth}px;margin:0 auto;padding:24px 16px;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:${PALETTE.text};">
    <div style="background:${PALETTE.cardBg};border:1px solid ${PALETTE.border};border-radius:14px;padding:28px 26px;">
      <p style="margin:0 0 16px;">${greeting}</p>${introHtml}
      ${bodyHtml}
      <p style="margin:28px 0 4px;">${signOff}</p>
      <p style="margin:0;font-weight:600;">${fromName}</p>${closingHtml}
    </div>
    <p style="margin:16px 4px 0;color:${PALETTE.faint};font-size:12px;line-height:1.5;">
      ${footerNote}
    </p>
  </div>
</body>
</html>`;

  const introText = intro ? `${stripTags(intro)}\n\n` : '';
  const footerText = footerNote ? `\n\n---\n${stripTags(footerNote)}` : '';
  const text = `${greeting}\n\n${introText}${bodyText}\n\n${signOff}\n${fromName}${footerText}`;

  return { html, text };
}

function stripTags(s) {
  return String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// ---- Standalone attachment --------------------------------------------------
/**
 * A self-contained .html file of the same content, for the attachment. Opens
 * fine in a browser with no email client around it.
 */
export function renderStandaloneHtml({ title, dateStr, contentHtml }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  body{max-width:820px;margin:32px auto;padding:0 20px;
    font-family:${FONT_STACK};
    line-height:1.6;color:${PALETTE.text};}
  h1,h2,h3{color:${PALETTE.heading};} code{background:${PALETTE.codeBg};padding:2px 5px;border-radius:4px;}
  pre{background:${PALETTE.preBg};color:${PALETTE.preText};padding:14px;border-radius:8px;overflow:auto;}
  table{border-collapse:collapse;width:100%;} th,td{border:1px solid ${PALETTE.border};padding:8px;text-align:left;}
  hr{border:none;border-top:1px solid ${PALETTE.border};margin:28px 0;}
</style></head><body>
<h1>${title}</h1>
<p style="color:${PALETTE.subtle};">Generated ${dateStr}</p>
<hr>
${contentHtml}
</body></html>`;
}

// ---- Deliverability ---------------------------------------------------------
/**
 * A working unsubscribe path + list id. Real signals, not decoration — these
 * are why the reports land in the inbox rather than the spam folder.
 */
export function buildHeaders(fromEmail) {
  return {
    'List-Unsubscribe': `<mailto:${fromEmail}?subject=unsubscribe>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    'List-Id': `Gloobal Updates <${fromEmail.replace('@', '.')}>`,
  };
}
