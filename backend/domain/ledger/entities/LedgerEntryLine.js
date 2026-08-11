// src/domain/ledger/entities/LedgerEntryLine.js
var LedgerEntryLine = class {
  constructor({ accountId, direction, money }) {
    if (!accountId) throw new LedgerError(LEDGER_ERROR.INVALID_LINE, "Ledger line requires an accountId");
    if (direction !== "debit" && direction !== "credit") {
      throw new LedgerError(LEDGER_ERROR.INVALID_LINE, `Ledger line direction must be "debit" or "credit", got "${direction}"`);
    }
    if (!(money instanceof Money) || !money.isPositive()) {
      throw new LedgerError(LEDGER_ERROR.INVALID_LINE, "Ledger line amount must be positive Money");
    }
    this.accountId = accountId;
    this.direction = direction;
    this.money = money;
    Object.freeze(this);
  }
  // Signed effect on the account's balance is direction- AND
  // account-type-dependent (see accounts/entities/LedgerAccount.js for
  // the normal-balance convention) — this class intentionally does not
  // decide that. It only records what was posted.
};
function DebitEntry(accountId, money) {
  return new LedgerEntryLine({ accountId, direction: "debit", money });
}
function CreditEntry(accountId, money) {
  return new LedgerEntryLine({ accountId, direction: "credit", money });
}

