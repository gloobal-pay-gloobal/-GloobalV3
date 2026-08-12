// src/core/transaction/transactionSnapshot.js
function buildTransactionSnapshot({ sender, receiver, amount, convertedAmount, payMethod, now, shareRatePercent, ledgerRecordId, txnId }) {
  const resolvedTxnId = txnId || genTxnId();
  const txnTime = formatClockTime(now);
  const txnShareRate = shareRatePercent ?? 0;
  const methodKey = !payMethod ? "bank" : payMethod.includes("PayLater") ? "paylater" : payMethod.includes("Coin") ? "coin" : "bank";
  const receipt = {
    direction: "sent",
    // Defensive defaults on every field the receipt renders. A single
    // undefined here used to be enough to throw inside ReceiptModal while
    // the payment itself had already gone through — the money moved and
    // the person got no receipt, which is the worst way to fail.
    name: receiver.name || "Gloobal User",
    flag: receiver.flag || "",
    id: receiver.id || "",
    phone: receiver.phone || "",
    shareRate: txnShareRate,
    // "You send" — the exact amount debited, in the sender's own
    // currency, converted from what was typed.
    amount: Number(convertedAmount) || 0,
    currencySymbol: CURRENCY_SYMBOL[sender.currency] || "",
    currencyCode: sender.currency || "USD",
    // "They receive" — the amount actually typed, in the receiver's
    // currency (what they asked for).
    convertedAmount: parseFloat(amount) || null,
    convertedCurrency: receiver.currency || sender.currency || "USD",
    method: payMethod || "Gloobal Bank",
    date: now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    time: txnTime,
    status: "completed",
    txnId: resolvedTxnId,
    ledgerRecordId: ledgerRecordId ?? null
  };
  const historyEntry = {
    name: receiver.name,
    date: now.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    amount: convertedAmount,
    flag: receiver.flag,
    status: "completed",
    method: methodKey,
    // Carried through so the receipt still shows these when reopened
    // later from History.
    id: receiver.id,
    phone: receiver.phone,
    time: txnTime,
    txnId: resolvedTxnId,
    shareRate: txnShareRate,
    ledgerRecordId: ledgerRecordId ?? null
  };
  return { receipt, historyEntry };
}

