// src/domain/risk/RiskEngine.js
var RiskEngine = class {
  // `eventBus` optional, same additive pattern as LedgerEngine — old
  // two-arg call sites keep working.
  constructor(ledgerEngine, payLaterService, eventBus) {
    this.ledgerEngine = ledgerEngine;
    this.payLaterService = payLaterService;
    this.eventBus = eventBus || null;
  }
  evaluateSend(args) {
    const decision = this.#evaluateSend(args);
    this.eventBus?.emit(DomainEvent.RISK_EVALUATED, {
      ok: decision.ok,
      code: decision.code,
      reason: decision.reason,
      amount: args.amount,
      payMethodLabel: args.payMethodLabel,
      decision
    });
    return decision;
  }
  #evaluateSend({ amount, payMethodLabel, userAccounts, currency = "INR" }) {
    if (amount === null || amount === void 0 || amount === "" || typeof amount !== "number" || Number.isNaN(amount) || !Number.isFinite(amount)) {
      return { ok: false, code: RISK_CODE.INVALID_AMOUNT, reason: "Enter a valid amount" };
    }
    if (amount <= 0) {
      return { ok: false, code: RISK_CODE.INVALID_AMOUNT, reason: "Enter an amount greater than zero" };
    }
    const decimalPlaces = (String(amount).split(".")[1] || "").length;
    if (decimalPlaces > 2) {
      return { ok: false, code: RISK_CODE.INVALID_AMOUNT, reason: "Amounts support up to 2 decimal places" };
    }
    if (typeof payMethodLabel !== "undefined" && payMethodLabel !== null && typeof payMethodLabel !== "string") {
      return { ok: false, code: RISK_CODE.INVALID_METHOD, reason: "Unrecognized payment method" };
    }
    const bankBalance = this.ledgerEngine.getAccountBalance(userAccounts.bank.id, currency).amount;
    if (typeof bankBalance !== "number" || Number.isNaN(bankBalance) || !Number.isFinite(bankBalance) || bankBalance < 0) {
      return { ok: false, code: RISK_CODE.INVALID_BALANCE, reason: "Balance unavailable \u2014 try again" };
    }
    const isPaylater = payMethodLabel && payMethodLabel.includes("PayLater");
    if (!isPaylater) {
      if (amount > bankBalance) {
        return { ok: false, code: RISK_CODE.INSUFFICIENT_BANK, reason: "Insufficient balance in Gloobal Bank" };
      }
      return { ok: true, fromBank: amount, fromPaylater: 0, total: amount };
    }
    const { paylaterAvailable } = this.payLaterService.computeAvailable(currency, userAccounts);
    const fromPaylater = Math.min(paylaterAvailable, amount);
    const fromBank = Math.round((amount - fromPaylater) * 100) / 100;
    if (fromBank > bankBalance) {
      return { ok: false, code: RISK_CODE.INSUFFICIENT_COMBINED, reason: "Insufficient balance to cover the remainder in Gloobal Bank" };
    }
    return { ok: true, fromBank, fromPaylater, total: amount };
  }
};

