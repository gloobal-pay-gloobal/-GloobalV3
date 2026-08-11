// src/domain/creatorShare/CreatorShareService.js
var CreatorShareService = class {
  #records = [];
  constructor(essentialsService) {
    this.essentialsService = essentialsService;
  }
  recordShareFromPayment({ userAccounts, txnId, payerName, amount, sharePercent, time, currency = "INR" }) {
    const shareRateDecimal = (sharePercent ?? 0) / 100;
    if (shareRateDecimal <= 0) return null;
    const record = new CreatorShareRecord({
      txnId,
      payerName,
      sharePercent,
      shareMoney: Money.of(amount * shareRateDecimal, currency)
    });
    this.#records.push(record);
    this.essentialsService.addGrant({
      userAccounts,
      key: "creator-share",
      business: `Creator Share \xB7 ${payerName}`,
      chip: "CS",
      amountPaid: amount,
      cashbackRate: shareRateDecimal,
      creatorName: payerName,
      time,
      currency,
      txnId
    });
    return record;
  }
  listRecords() {
    return this.#records.slice();
  }
};

