// src/utils/idGenerators.js
function isoToFlag(iso2) {
  return iso2.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}
function genTxnId() {
  let s = "";
  for (let i = 0; i < 20; i++) {
    s += DIAL_SYMBOLS[Math.floor(Math.random() * DIAL_SYMBOLS.length)];
    if ((i + 1) % 4 === 0 && i !== 19) s += " ";
  }
  return s;
}
function genSuggestedId(length = 12) {
  let s = "";
  for (let i = 0; i < length; i++) {
    s += DIAL_SYMBOLS[Math.floor(Math.random() * DIAL_SYMBOLS.length)];
  }
  return s;
}

