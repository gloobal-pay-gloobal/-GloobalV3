// src/domain/shared/Money.js
var Money = class _Money {
  #minorUnits;
  // integer, stored as major-unit-equivalent * 100, rounded
  constructor(amount, currency = "INR") {
    const n = typeof amount === "number" ? amount : parseFloat(amount);
    if (Number.isNaN(n) || !Number.isFinite(n)) {
      throw new TypeError(`Money: invalid amount "${amount}"`);
    }
    this.#minorUnits = Math.round(n * 100);
    this.currency = currency;
    Object.freeze(this);
  }
  static of(amount, currency = "INR") {
    return new _Money(amount, currency);
  }
  static zero(currency = "INR") {
    return new _Money(0, currency);
  }
  get amount() {
    return this.#minorUnits / 100;
  }
  isZero() {
    return this.#minorUnits === 0;
  }
  isPositive() {
    return this.#minorUnits > 0;
  }
  isNegative() {
    return this.#minorUnits < 0;
  }
  assertSameCurrency(other) {
    if (this.currency !== other.currency) {
      throw new TypeError(`Money: currency mismatch (${this.currency} vs ${other.currency})`);
    }
  }
  add(other) {
    this.assertSameCurrency(other);
    return new _Money((this.#minorUnits + other.#minorUnits) / 100, this.currency);
  }
  subtract(other) {
    this.assertSameCurrency(other);
    return new _Money((this.#minorUnits - other.#minorUnits) / 100, this.currency);
  }
  min(other) {
    this.assertSameCurrency(other);
    return this.#minorUnits <= other.#minorUnits ? this : other;
  }
  greaterThan(other) {
    this.assertSameCurrency(other);
    return this.#minorUnits > other.#minorUnits;
  }
  equals(other) {
    return this.currency === other.currency && this.#minorUnits === other.#minorUnits;
  }
  toJSON() {
    return { amount: this.amount, currency: this.currency };
  }
  toString() {
    return `${this.amount.toFixed(2)} ${this.currency}`;
  }
};

