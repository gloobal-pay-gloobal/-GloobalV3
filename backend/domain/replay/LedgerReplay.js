// src/domain/replay/LedgerReplay.js
function balanceAsOf(core, accountId, sequence) {
  const account = core.registry.get(accountId);
  const records = core.store.getForAccount(accountId).filter((r) => r.sequence <= sequence);
  let balance = Money.zero(core.currency);
  for (const record of records) {
    for (const line of record.journalEntry.linesForAccount(accountId)) {
      const signed = line.direction === account.normalBalance ? line.money : Money.zero(core.currency).subtract(line.money);
      balance = balance.add(signed);
    }
  }
  return balance;
}
function snapshotAsOf(core, sequence) {
  return core.registry.all().map((account) => ({
    accountId: account.id,
    balance: balanceAsOf(core, account.id, sequence).amount,
    currency: core.currency
  }));
}
function buildTimeline(core) {
  const records = core.store.getAll();
  return records.map((record) => ({
    sequence: record.sequence,
    recordId: record.id,
    postedAt: record.postedAt,
    memo: record.journalEntry.memo,
    snapshot: snapshotAsOf(core, record.sequence)
  }));
}
function replayIntoFreshStore(core, { userId = "replay-check", currency = core.currency } = {}) {
  const freshStore = new LedgerStore();
  const freshRegistry = new AccountRegistry();
  const freshEngine = new LedgerEngine(freshStore, freshRegistry);
  const freshAccounts = freshRegistry.registerUser(userId, currency);
  const idMap = /* @__PURE__ */ new Map();
  const originalAccounts = core.userAccounts;
  for (const key of Object.keys(originalAccounts)) {
    if (originalAccounts[key]?.id && freshAccounts[key]?.id) idMap.set(originalAccounts[key].id, freshAccounts[key].id);
  }
  idMap.set(core.registry.reserve.id, freshRegistry.reserve.id);
  const originalRecords = core.store.getAll();
  const errors = [];
  for (const record of originalRecords) {
    try {
      const lines = record.journalEntry.lines.map((line) => ({
        accountId: idMap.get(line.accountId) || line.accountId,
        direction: line.direction,
        money: line.money
      }));
      freshEngine.postJournalEntry({ memo: record.journalEntry.memo, lines, meta: record.journalEntry.meta });
    } catch (err) {
      errors.push({ recordId: record.id, sequence: record.sequence, error: err.message });
    }
  }
  const mismatches = [];
  for (const [originalId, freshId] of idMap) {
    const originalBalance = core.ledgerEngine.getAccountBalance(originalId, currency);
    const freshBalance = freshEngine.getAccountBalance(freshId, currency);
    if (!originalBalance.equals(freshBalance)) {
      mismatches.push({ accountId: originalId, original: originalBalance.amount, replayed: freshBalance.amount });
    }
  }
  return {
    ok: errors.length === 0 && mismatches.length === 0,
    recordsReplayed: originalRecords.length - errors.length,
    recordsTotal: originalRecords.length,
    errors,
    mismatches,
    chainValid: freshStore.verifyChain(),
    provenanceChainValid: core.provenanceStore.verifyChain(),
    disputeChainValid: core.disputeStore.verifyChain()
  };
}

