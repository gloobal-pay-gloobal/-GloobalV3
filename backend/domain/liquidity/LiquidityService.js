// src/domain/liquidity/LiquidityService.js
var LiquidityService = class {
  constructor(ledgerEngine, pool) {
    this.ledgerEngine = ledgerEngine;
    this.pool = pool;
  }
  // Real check against the platform's actual backing liquidity — the
  // reserve is a liability account (money the platform owes back out);
  // a draw is only fundable if the reserve can absorb the debit
  // without going negative (which would mean the platform owes more
  // than it currently holds). Previously a stub that always returned
  // true, which meant PayLater draws were never actually capped by
  // system-wide liquidity, only by each user's own credit limit.
  hasSufficientLiquidity(money) {
    if (!(money instanceof Money) || !money.isPositive()) return false;
    const reserveBalance = this.reserveBalance();
    if (reserveBalance.currency !== money.currency) return false;
    return reserveBalance.amount - money.amount >= 0;
  }
  reserveBalance() {
    return this.ledgerEngine.getAccountBalance(this.pool.reserveAccountId, this.pool.currency);
  }
};

