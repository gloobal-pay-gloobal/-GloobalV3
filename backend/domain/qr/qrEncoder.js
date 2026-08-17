// src/domain/qr/qrEncoder.js
// A REAL, standards-compliant QR encoder — no external library, no
// import at all — so this works in any environment this file lands
// in, including previews that only support a fixed library whitelist
// (qrcode.react is not on it) and a live camera pointed at a real
// screen. Fixed to QR Version 4 / Error Correction Level M: this
// app's QR payload (encodeGloobalQR) is always exactly 16 characters
// from an 8-symbol alphabet, worst case 48 UTF-8 bytes, comfortably
// under Version 4-M's 64-byte data capacity — fixing the version
// avoids needing the general "pick the smallest version that fits"
// logic a full multi-version library needs, while still being 100%
// spec-compliant for every payload this app actually produces.
// Implements ISO 18004 from first principles (GF(256) Reed-Solomon,
// standard finder/timing/alignment/format-info placement, mask
// pattern 0) — not copied from any existing library's source, though
// verified against one: rendered to a real image and independently
// re-decoded (a completely separate scanning implementation) to
// confirm round-trip correctness before shipping, and cross-checked
// cell-for-cell against a well-established reference encoder with
// zero discrepancies.
var QR_GF_EXP = new Array(512);
var QR_GF_LOG = new Array(256);
(function buildQrGaloisField() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    QR_GF_EXP[i] = x;
    QR_GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11D;
  }
  for (let i = 255; i < 512; i++) QR_GF_EXP[i] = QR_GF_EXP[i - 255];
})();
function qrGfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return QR_GF_EXP[QR_GF_LOG[a] + QR_GF_LOG[b]];
}
function qrReedSolomonGeneratorPoly(ecCount) {
  let poly = [1];
  for (let i = 0; i < ecCount; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= qrGfMul(poly[j], 1);
      next[j + 1] ^= qrGfMul(poly[j], QR_GF_EXP[i]);
    }
    poly = next;
  }
  return poly;
}
function qrReedSolomonEncode(dataBytes, ecCount) {
  const generator = qrReedSolomonGeneratorPoly(ecCount);
  const remainder = dataBytes.slice();
  for (let i = 0; i < ecCount; i++) remainder.push(0);
  for (let i = 0; i < dataBytes.length; i++) {
    const coef = remainder[i];
    if (coef === 0) continue;
    for (let j = 0; j < generator.length; j++) {
      remainder[i + j] ^= qrGfMul(generator[j], coef);
    }
  }
  return remainder.slice(dataBytes.length);
}
var QR_VERSION = 4;
var QR_SIZE = 33;
var QR_DATA_CODEWORDS_PER_BLOCK = 32;
var QR_EC_CODEWORDS_PER_BLOCK = 18;
var QR_BLOCKS = 2;
var QR_TOTAL_DATA_CODEWORDS = QR_DATA_CODEWORDS_PER_BLOCK * QR_BLOCKS;
function qrBuildDataCodewords(text) {
  const bytes = Array.from(new TextEncoder().encode(text));
  if (bytes.length > QR_TOTAL_DATA_CODEWORDS - 2) {
    throw new Error(`QR payload too long for fixed Version ${QR_VERSION}-M (${bytes.length} bytes)`);
  }
  const bits = [];
  const pushBits = (value, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };
  pushBits(4, 4);
  pushBits(bytes.length, 8);
  for (const b of bytes) pushBits(b, 8);
  const totalBits = QR_TOTAL_DATA_CODEWORDS * 8;
  for (let i = 0; i < 4 && bits.length < totalBits; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);
  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }
  const padBytes = [0xEC, 0x11];
  let p = 0;
  while (codewords.length < QR_TOTAL_DATA_CODEWORDS) {
    codewords.push(padBytes[p % 2]);
    p++;
  }
  return codewords;
}
function qrBuildFinalCodewords(dataCodewords) {
  const blocks = [];
  for (let b = 0; b < QR_BLOCKS; b++) {
    const block = dataCodewords.slice(b * QR_DATA_CODEWORDS_PER_BLOCK, (b + 1) * QR_DATA_CODEWORDS_PER_BLOCK);
    blocks.push({ data: block, ec: qrReedSolomonEncode(block, QR_EC_CODEWORDS_PER_BLOCK) });
  }
  const final = [];
  for (let i = 0; i < QR_DATA_CODEWORDS_PER_BLOCK; i++) for (const blk of blocks) final.push(blk.data[i]);
  for (let i = 0; i < QR_EC_CODEWORDS_PER_BLOCK; i++) for (const blk of blocks) final.push(blk.ec[i]);
  return final;
}
function qrMakeMatrix() {
  return Array.from({ length: QR_SIZE }, () => new Array(QR_SIZE).fill(null));
}
function qrPlaceFinder(matrix, isFn, top, left) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = top + r, cc = left + c;
      if (rr < 0 || rr >= QR_SIZE || cc < 0 || cc >= QR_SIZE) continue;
      isFn[rr][cc] = true;
      const inRing = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      if (!inRing) { matrix[rr][cc] = 0; continue; }
      const onOuter = r === 0 || r === 6 || c === 0 || c === 6;
      const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      matrix[rr][cc] = onOuter || inCore ? 1 : 0;
    }
  }
}
function qrPlaceAlignment(matrix, isFn, centerR, centerC) {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const rr = centerR + r, cc = centerC + c;
      isFn[rr][cc] = true;
      matrix[rr][cc] = Math.max(Math.abs(r), Math.abs(c)) !== 1 ? 1 : 0;
    }
  }
}
function qrPlaceTiming(matrix, isFn) {
  for (let i = 0; i < QR_SIZE; i++) {
    if (!isFn[6][i]) { matrix[6][i] = i % 2 === 0 ? 1 : 0; isFn[6][i] = true; }
    if (!isFn[i][6]) { matrix[i][6] = i % 2 === 0 ? 1 : 0; isFn[i][6] = true; }
  }
}
function qrPlaceDarkModule(matrix, isFn) {
  matrix[QR_SIZE - 8][8] = 1;
  isFn[QR_SIZE - 8][8] = true;
}
// Format info: 5 data bits (EC level + 3-bit mask), BCH(15,5) error
// correction (generator 0b10100110111), XORed with the fixed mask
// 0b101010000010010 so no combination of level+mask ever produces an
// all-zero string. Placed twice (split around the top-left finder,
// plus the bottom-left/top-right copy) per the standard layout, so a
// scanner can read it even with part of the code occluded.
var QR_FORMAT_EC_BITS = { L: 1, M: 0, Q: 3, H: 2 };
var QR_FORMAT_GENERATOR = 0b10100110111;
var QR_FORMAT_MASK = 0b101010000010010;
function qrBchDigitCount(n) {
  let digits = 0;
  while (n !== 0) { digits++; n >>>= 1; }
  return digits;
}
function qrFormatInfoBits(ecLevel, maskPattern) {
  const data = (QR_FORMAT_EC_BITS[ecLevel] << 3) | maskPattern;
  let d = data << 10;
  const genDigits = qrBchDigitCount(QR_FORMAT_GENERATOR);
  while (qrBchDigitCount(d) - genDigits >= 0) {
    d ^= QR_FORMAT_GENERATOR << (qrBchDigitCount(d) - genDigits);
  }
  return (data << 10 | d) ^ QR_FORMAT_MASK;
}
function qrPlaceFormatInfo(matrix, isFn, ecLevel, maskPattern) {
  const bits = qrFormatInfoBits(ecLevel, maskPattern);
  for (let i = 0; i < 15; i++) {
    const mod = bits >> i & 1;
    const vr = i < 6 ? i : i < 8 ? i + 1 : QR_SIZE - 15 + i;
    matrix[vr][8] = mod;
    isFn[vr][8] = true;
    const hc = i < 8 ? QR_SIZE - i - 1 : i < 9 ? 15 - i : 14 - i;
    matrix[8][hc] = mod;
    isFn[8][hc] = true;
  }
}
function qrReserveFormatAreas(isFn) {
  for (let i = 0; i <= 8; i++) { isFn[8][i] = true; isFn[i][8] = true; }
  for (let i = 0; i < 8; i++) { isFn[QR_SIZE - 1 - i][8] = true; isFn[8][QR_SIZE - 1 - i] = true; }
}
// Zigzag placement (bottom-right corner upward, two columns at a
// time, skipping the vertical timing column) with mask pattern 0
// ((row+col) % 2 === 0) applied to data/EC modules only — the exact
// ISO 18004 module-placement algorithm.
function qrPlaceData(matrix, isFn, codewords) {
  const bits = [];
  for (const byte of codewords) for (let i = 7; i >= 0; i--) bits.push(byte >> i & 1);
  let bitIndex = 0;
  let col = QR_SIZE - 1;
  let upward = true;
  while (col > 0) {
    if (col === 6) col--;
    for (let i = 0; i < QR_SIZE; i++) {
      const row = upward ? QR_SIZE - 1 - i : i;
      for (const c of [col, col - 1]) {
        if (isFn[row][c]) continue;
        const bit = bitIndex < bits.length ? bits[bitIndex] : 0;
        bitIndex++;
        matrix[row][c] = (row + c) % 2 === 0 ? bit ^ 1 : bit;
      }
    }
    upward = !upward;
    col -= 2;
  }
}
// Returns both the module matrix AND isFunctionModule, the same "is this
// cell a finder/timing/alignment/format-info/dark-module cell, or real
// data" map this function already builds internally as `isFn` — it just
// never left the function before. A renderer needs that distinction to
// stay camera-scannable while still restyling anything it safely can:
// function-pattern cells must stay plain, standard-shaped modules for a
// real scanner to lock onto the code at all (the finder squares' geometry
// specifically is what a decoder searches the image for), but every dark
// DATA cell can be drawn as anything with equivalent ink coverage — a
// scanner only reads dark-vs-light per cell, never what shape made it dark.
function qrBuildMatrix(text) {
  const matrix = qrMakeMatrix();
  const isFn = Array.from({ length: QR_SIZE }, () => new Array(QR_SIZE).fill(false));
  qrPlaceFinder(matrix, isFn, 0, 0);
  qrPlaceFinder(matrix, isFn, 0, QR_SIZE - 7);
  qrPlaceFinder(matrix, isFn, QR_SIZE - 7, 0);
  qrPlaceAlignment(matrix, isFn, 26, 26);
  qrPlaceTiming(matrix, isFn);
  qrReserveFormatAreas(isFn);
  qrPlaceDarkModule(matrix, isFn);
  const finalCodewords = qrBuildFinalCodewords(qrBuildDataCodewords(text));
  qrPlaceData(matrix, isFn, finalCodewords);
  qrPlaceFormatInfo(matrix, isFn, "M", 0);
  return { matrix, isFunctionModule: isFn };
}

