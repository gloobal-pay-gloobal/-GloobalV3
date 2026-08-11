// src/domain/accounts/AccountRegistry.js
var AccountRegistry = class {
  #accountsById = /* @__PURE__ */ new Map();
  constructor() {
    this.reserve = createReserveAccount();
    this.#register(this.reserve);
  }
  #register(account) {
    this.#accountsById.set(account.id, account);
    return account;
  }
  registerUser(userId, currency = "INR") {
    const bundle = createUserAccount(userId, currency);
    Object.values(bundle).forEach((v) => {
      if (v && v.id) this.#register(v);
    });
    return bundle;
  }
  registerMerchant(merchantBundle) {
    Object.values(merchantBundle).forEach((v) => {
      if (v && v.id) this.#register(v);
    });
    return merchantBundle;
  }
  get(accountId) {
    const account = this.#accountsById.get(accountId);
    if (!account) throw new RangeError(`AccountRegistry: unknown account "${accountId}"`);
    return account;
  }
  has(accountId) {
    return this.#accountsById.has(accountId);
  }
  all() {
    return Array.from(this.#accountsById.values());
  }
};

