// src/domain/diagnostics/DiagnosticsService.js
function accountBalancesSnapshot(core) {
  return core.registry.all().map((account) => {
    const balance = core.ledgerEngine.getAccountBalance(account.id, core.currency);
    return {
      accountId: account.id,
      type: account.type,
      normalBalance: account.normalBalance,
      balance: balance.amount,
      currency: balance.currency,
      historyCount: core.ledgerEngine.getAccountHistory(account.id).length
    };
  });
}
function ledgerStats(core) {
  const records = core.store.getAll();
  const byKind = /* @__PURE__ */ new Map();
  for (const r of records) {
    const kind = r.journalEntry.meta?.kind || "unspecified";
    byKind.set(kind, (byKind.get(kind) || 0) + 1);
  }
  return {
    totalRecords: records.length,
    firstPostedAt: records[0]?.postedAt ?? null,
    lastPostedAt: records[records.length - 1]?.postedAt ?? null,
    byKind: Array.from(byKind, ([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count)
  };
}
function getDiagnosticsSnapshot(core, { eventLimit = 100 } = {}) {
  return {
    generatedAt: /* @__PURE__ */ new Date(),
    health: runHealthChecks(core),
    accounts: accountBalancesSnapshot(core),
    ledgerStats: ledgerStats(core),
    recentEvents: core.eventBus.getHistory({ limit: eventLimit }).slice().reverse(),
    recentErrors: core.logger ? core.logger.errors(eventLimit) : []
  };
}

