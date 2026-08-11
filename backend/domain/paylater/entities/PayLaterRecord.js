// src/domain/paylater/entities/PayLaterRecord.js
var PayLaterRecord = class {
  constructor({ name, date, amount, status = "pending", direction = "out" }) {
    this.name = name;
    this.date = date;
    this.amount = amount;
    this.status = status;
    this.direction = direction;
    Object.freeze(this);
  }
};

