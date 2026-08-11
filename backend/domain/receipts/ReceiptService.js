// src/domain/receipts/ReceiptService.js
function buildReceipt({ sender, receiver, amount, convertedAmount, payMethod, now, shareRatePercent, ledgerRecordId }) {
  const txnId = genTxnId();
  const txnTime = formatClockTime(now);
  const txnShareRate = shareRatePercent ?? 0;
  const methodKey = !payMethod ? "bank" : payMethod.includes("PayLater") ? "paylater" : payMethod.includes("Coin") ? "coin" : "bank";
  const receipt = new Receipt({
    direction: "sent",
    name: receiver.name,
    flag: receiver.flag,
    id: receiver.id,
    phone: receiver.phone,
    shareRate: txnShareRate,
    amount: convertedAmount,
    currencySymbol: CURRENCY_SYMBOL[sender.currency] || "",
    currencyCode: sender.currency,
    convertedAmount: parseFloat(amount) || null,
    convertedCurrency: receiver.currency,
    method: payMethod || "Gloobal Bank",
    date: now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    time: txnTime,
    status: "completed",
    txnId,
    ledgerRecordId
    // new: traces this receipt back to the immutable ledger posting that backs it
  });
  const historyEntry = {
    name: receiver.name,
    date: now.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    amount: convertedAmount,
    flag: receiver.flag,
    status: "completed",
    method: methodKey,
    id: receiver.id,
    phone: receiver.phone,
    time: txnTime,
    txnId,
    shareRate: txnShareRate
  };
  return { receipt, historyEntry };
}

