// src/domain/creatorShare/entities/CreatorShareRecord.js
var CreatorShareRecord = class {
  constructor({ txnId, payerName, sharePercent, shareMoney, earnedAt = /* @__PURE__ */ new Date() }) {
    this.txnId = txnId;
    this.payerName = payerName;
    this.sharePercent = sharePercent;
    this.shareMoney = shareMoney;
    this.earnedAt = earnedAt;
    Object.freeze(this);
  }
};

