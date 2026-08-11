// src/domain/receipts/entities/Receipt.js
var Receipt = class {
  constructor(fields) {
    Object.assign(this, fields);
    Object.freeze(this);
  }
};

