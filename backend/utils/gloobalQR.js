// src/utils/gloobalQR.js
var QR_TOTAL_LENGTH = 16;
var QR_ID_LENGTH = 12;
var QR_AMOUNT_LENGTH = 3;
var QR_REAL_LENGTH = QR_ID_LENGTH + QR_AMOUNT_LENGTH + 1;
// The QR payload's own amount+checksum bookkeeping uses a SMALLER,
// separate alphabet than Secure ID/general ID generation (DIAL_SYMBOLS,
// 8 symbols) — just +, minus, equals, filled square. This is scoped
// only to how amountCents and the checksum get encoded into digit
// positions inside the QR string; the ID portion of the QR payload is
// still the person's real Gloobal ID, built from the full DIAL_SYMBOLS
// alphabet exactly as it always has been. Two separate alphabets, two
// separate purposes — this one is not the Secure ID dial pad's set.
var QR_ENCODING_SYMBOLS = ["+", "\u2212", "=", "\u25A0"];
var QR_SYMBOL_TO_DIGIT = Object.fromEntries(QR_ENCODING_SYMBOLS.map((s, i) => [s, i]));
var QR_DIGIT_TO_SYMBOL = QR_ENCODING_SYMBOLS;
// The digit base is however many symbols QR_ENCODING_SYMBOLS actually
// has — never hardcoded, so a future change to that count doesn't
// silently break encode/decode with stale arithmetic.
var QR_SYMBOL_BASE = QR_ENCODING_SYMBOLS.length;
// Membership check for the ID portion — the person's real Gloobal ID,
// which can contain any of the full 8 DIAL_SYMBOLS characters, not
// just the 4 QR_ENCODING_SYMBOLS used for amount+checksum.
var QR_ID_SYMBOL_SET = new Set(DIAL_SYMBOLS);
function encodeGloobalQR({ gloobalId, amountCents }) {
  const idPart = gloobalId.replace(/\s/g, "").padEnd(QR_ID_LENGTH, DIAL_SYMBOLS[0]).slice(0, QR_ID_LENGTH);
  const safeAmountCents = Math.max(0, Math.min(QR_MAX_AMOUNT_CENTS, Math.round(amountCents)));
  const amountPart = safeAmountCents.toString(QR_SYMBOL_BASE).padStart(QR_AMOUNT_LENGTH, "0").slice(-QR_AMOUNT_LENGTH).split("").map((d) => QR_DIGIT_TO_SYMBOL[parseInt(d, QR_SYMBOL_BASE)]).join("");
  const realPayload = idPart + amountPart;
  let checksum = 0;
  for (let i = 0; i < realPayload.length; i++) checksum = (checksum + realPayload.charCodeAt(i) * (i + 1)) % QR_SYMBOL_BASE;
  const real = realPayload + QR_DIGIT_TO_SYMBOL[checksum];
  let padding = "";
  while (real.length + padding.length < QR_TOTAL_LENGTH) padding += real;
  return real + padding.slice(0, QR_TOTAL_LENGTH - real.length);
}
function decodeGloobalQR(code) {
  if (typeof code !== "string" || code.length !== QR_TOTAL_LENGTH) return null;
  const idPart = code.slice(0, QR_ID_LENGTH);
  const amountPart = code.slice(QR_ID_LENGTH, QR_ID_LENGTH + QR_AMOUNT_LENGTH);
  const checksumSymbol = code[QR_REAL_LENGTH - 1];
  // The ID portion must be real DIAL_SYMBOLS characters (the full
  // 8-symbol alphabet a real Gloobal ID is drawn from); the
  // amount+checksum portion must be QR_ENCODING_SYMBOLS (the smaller,
  // QR-only alphabet) — two different alphabets, checked separately,
  // never conflated.
  if (!idPart.split("").every((c) => QR_ID_SYMBOL_SET.has(c))) return null;
  if (!amountPart.split("").every((c) => c in QR_SYMBOL_TO_DIGIT)) return null;
  if (!(checksumSymbol in QR_SYMBOL_TO_DIGIT)) return null;
  const realPayload = idPart + amountPart;
  let checksum = 0;
  for (let i = 0; i < realPayload.length; i++) checksum = (checksum + realPayload.charCodeAt(i) * (i + 1)) % QR_SYMBOL_BASE;
  if (QR_DIGIT_TO_SYMBOL[checksum] !== checksumSymbol) return null;
  const amountDigits = amountPart.split("").map((c) => QR_SYMBOL_TO_DIGIT[c]).join("");
  const amountCents = parseInt(amountDigits, QR_SYMBOL_BASE);
  if (isNaN(amountCents)) return null;
  return { gloobalId: idPart, amountCents };
}
// With a 4-symbol encoding alphabet, the 3-digit amount field's range
// is 0-63 (in whatever the smallest currency unit is, e.g. cents).
// QR_AMOUNT_LENGTH would need to grow to represent a larger range,
// but that wasn't asked for here and would eat into QR_ID_LENGTH's
// share of the fixed 16-character total, so it's left as-is.
var QR_MAX_AMOUNT_CENTS = Math.pow(QR_SYMBOL_BASE, QR_AMOUNT_LENGTH) - 1;

