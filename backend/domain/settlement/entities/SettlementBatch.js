// src/domain/settlement/entities/SettlementBatch.js
var SettlementBatch = class _SettlementBatch {
  constructor({ id, kind, sourceAccountId, destinationAccountId, money, state = SettlementState.PENDING, ledgerRecordId = null, createdAt = /* @__PURE__ */ new Date() }) {
    this.id = id || genSettlementBatchId();
    this.kind = kind;
    this.sourceAccountId = sourceAccountId;
    this.destinationAccountId = destinationAccountId;
    this.money = money;
    this.state = state;
    this.ledgerRecordId = ledgerRecordId;
    this.createdAt = createdAt;
    Object.freeze(this);
  }
  advance(nextState, { ledgerRecordId } = {}) {
    if (!canTransition(this.state, nextState)) {
      throw new RangeError(`SettlementBatch: cannot move from ${this.state} to ${nextState}`);
    }
    return new _SettlementBatch({
      id: this.id,
      kind: this.kind,
      sourceAccountId: this.sourceAccountId,
      destinationAccountId: this.destinationAccountId,
      money: this.money,
      state: nextState,
      ledgerRecordId: ledgerRecordId ?? this.ledgerRecordId,
      createdAt: this.createdAt
    });
  }
};

