// src/domain/accounts/entities/LedgerAccount.js
var ACCOUNT_TYPE = {
  ASSET: "asset",
  LIABILITY: "liability",
  INCOME: "income",
  EXPENSE: "expense",
  EQUITY: "equity"
};
var NORMAL_BALANCE = {
  [ACCOUNT_TYPE.ASSET]: "debit",
  [ACCOUNT_TYPE.EXPENSE]: "debit",
  [ACCOUNT_TYPE.LIABILITY]: "credit",
  [ACCOUNT_TYPE.INCOME]: "credit",
  [ACCOUNT_TYPE.EQUITY]: "credit"
};
var LedgerAccount = class {
  constructor({ id, type, name, currency = "INR", ownerId = null, meta = {} }) {
    if (!id) throw new TypeError("LedgerAccount requires an id");
    if (!NORMAL_BALANCE[type]) throw new TypeError(`LedgerAccount: unknown type "${type}"`);
    this.id = id;
    this.type = type;
    this.name = name;
    this.currency = currency;
    this.ownerId = ownerId;
    this.meta = Object.freeze({ ...meta });
    this.normalBalance = NORMAL_BALANCE[type];
    Object.freeze(this);
  }
};

