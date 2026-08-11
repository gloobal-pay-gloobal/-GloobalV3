// src/domain/ledger/ledgerErrors.js
var LedgerError = class extends Error {
  constructor(code, message) {
    super(message);
    this.name = "LedgerError";
    this.code = code;
  }
};
var LEDGER_ERROR = {
  UNBALANCED_ENTRY: "UNBALANCED_ENTRY",
  EMPTY_ENTRY: "EMPTY_ENTRY",
  UNKNOWN_ACCOUNT: "UNKNOWN_ACCOUNT",
  CURRENCY_MISMATCH: "CURRENCY_MISMATCH",
  INVALID_LINE: "INVALID_LINE"
};

