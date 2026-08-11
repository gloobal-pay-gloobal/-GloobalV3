// src/domain/liquidity/entities/LiquidityPool.js
var LiquidityPool = class {
  constructor({ id, currency, reserveAccountId }) {
    this.id = id;
    this.currency = currency;
    this.reserveAccountId = reserveAccountId;
    Object.freeze(this);
  }
};

