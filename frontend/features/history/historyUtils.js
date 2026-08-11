// src/features/history/historyUtils.js
function buildHistoryReceipt(t, direction, dialCountry, ccy) {
  const localCurrency = COUNTRY_CURRENCY[dialCountry.iso] || "USD";
  const counterpartyCountry = ALL_COUNTRIES.find((c) => c.flag === t.flag);
  const counterpartyCurrency = counterpartyCountry ? COUNTRY_CURRENCY[counterpartyCountry.iso] : null;
  const converted = counterpartyCurrency && counterpartyCurrency !== localCurrency ? convert(t.amount, localCurrency, counterpartyCurrency) : null;
  return {
    direction,
    // 'sent' | 'received'
    name: t.name,
    flag: t.flag,
    // Real captured value when present (every row saved since the
    // receipt-determinism fix); falls back to a fresh one only for
    // "sent" rows that predate it, so old demo data doesn't crash —
    // but a transaction that already has its own shareRate/time/txnId
    // must never have it regenerated, or the same transaction would
    // show different numbers on every reopen. A "received" row (the
    // Creator Share side of some earlier payment) always carries its
    // own real shareRate now — never a random fallback, and never a
    // fabricated 0%, since it isn't a new transaction of its own to
    // guess a rate for; it's the same original payment's Creator
    // Share tab, read from the receiving side.
    shareRate: t.shareRate ?? (direction === "sent" ? randomShareRate() : null),
    amount: t.amount,
    currencySymbol: ccy,
    currencyCode: localCurrency,
    convertedAmount: converted,
    convertedCurrency: converted != null ? counterpartyCurrency : null,
    method: HISTORY_METHOD_META[t.method]?.label,
    date: t.date,
    time: t.time || formatClockTime(/* @__PURE__ */ new Date()),
    status: t.status === "completed" || t.status === "received" ? "completed" : t.status,
    txnId: t.txnId || genTxnId(),
    // Present on rows saved from a real payment (see onSendComplete in
    // Send Money); older/seed-less rows simply won't have these, same
    // as before.
    id: t.id,
    phone: t.phone
  };
}

