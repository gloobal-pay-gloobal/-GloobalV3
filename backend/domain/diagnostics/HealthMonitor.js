// src/domain/diagnostics/HealthMonitor.js
function checkChainIntegrity(core) {
  const ok = core.store.verifyChain();
  return {
    id: "chain-integrity",
    label: "Ledger chain integrity",
    status: ok ? "pass" : "fail",
    detail: ok ? "Every record's previousRecordId matches the chain." : "Chain link mismatch detected \u2014 a record's previousRecordId does not match its predecessor."
  };
}
function checkTrialBalance(core) {
  const totals = /* @__PURE__ */ new Map();
  for (const record of core.store.getAll()) {
    for (const line of record.journalEntry.lines) {
      const bucket = totals.get(line.money.currency) || { debit: 0, credit: 0 };
      if (line.direction === "debit") bucket.debit += line.money.amount;
      else bucket.credit += line.money.amount;
      totals.set(line.money.currency, bucket);
    }
  }
  const mismatches = [];
  for (const [currency, { debit, credit }] of totals) {
    if (Math.round(debit * 100) !== Math.round(credit * 100)) {
      mismatches.push(`${currency}: debit=${debit.toFixed(2)} credit=${credit.toFixed(2)}`);
    }
  }
  return {
    id: "trial-balance",
    label: "Global trial balance",
    status: mismatches.length === 0 ? "pass" : "fail",
    detail: mismatches.length === 0 ? `Debits equal credits across ${totals.size || 0} currenc${totals.size === 1 ? "y" : "ies"}.` : mismatches.join("; ")
  };
}
function checkNoNegativeAssetBalances(core) {
  const assetAccountIds = [core.userAccounts.bank?.id, core.userAccounts.essentials?.id, core.userAccounts.referralEarnings?.id].filter(Boolean);
  const offenders = [];
  for (const accountId of assetAccountIds) {
    const balance = core.ledgerEngine.getAccountBalance(accountId, core.currency);
    if (balance.isNegative()) offenders.push(`${accountId}: ${balance.toString()}`);
  }
  return {
    id: "no-negative-assets",
    label: "No negative asset balances",
    status: offenders.length === 0 ? "pass" : "fail",
    detail: offenders.length === 0 ? "Bank, Essentials, and Referral Earnings balances are non-negative." : offenders.join("; ")
  };
}
// The two checks below are deliberately split, because a *sum-based*
// identity (checkMonetaryConservation) is a bookkeeping tautology —
// any well-formed set of balanced JournalEntries satisfies it whether
// or not the value was ever legitimately funded. What actually caught
// (and would catch a regression of) the Essentials-grant bug this
// pass fixed is checkNoUnbackedIncomeRecognition: in this system's
// design, every legitimate credit routes through the reserve, so
// INCOME/EQUITY accounts should never hold a nonzero balance at all.
function checkNoUnbackedIncomeRecognition(core) {
  const offenders = [];
  for (const account of core.registry.all()) {
    if (account.type !== ACCOUNT_TYPE.INCOME && account.type !== ACCOUNT_TYPE.EQUITY) continue;
    const balance = core.ledgerEngine.getAccountBalance(account.id, core.currency);
    if (Math.round(balance.amount * 100) !== 0) offenders.push(`${account.id}: ${balance.toString()}`);
  }
  return {
    id: "no-unbacked-income",
    label: "No value created via unbacked income recognition",
    status: offenders.length === 0 ? "pass" : "fail",
    detail: offenders.length === 0 ? "Every income/equity account is at zero \u2014 nothing was credited outside the reserve." : offenders.join("; ")
  };
}
// The literal M = \u03A3B\u1D62 identity: assets equal liabilities plus
// equity, summed across every registered account (scales to any
// number of users — nothing here is keyed to a single demo account).
// Always true by construction for a balanced ledger; kept as an
// explicit, visible regression guard against ever posting an
// unbalanced entry, alongside the trial-balance check.
function checkMonetaryConservation(core) {
  let assets = 0, liabilities = 0, incomeAndEquity = 0;
  for (const account of core.registry.all()) {
    const balance = core.ledgerEngine.getAccountBalance(account.id, core.currency).amount;
    if (account.type === ACCOUNT_TYPE.ASSET || account.type === ACCOUNT_TYPE.EXPENSE) assets += balance;
    else if (account.type === ACCOUNT_TYPE.LIABILITY) liabilities += balance;
    else incomeAndEquity += balance;
  }
  const diff = Math.round((assets - liabilities - incomeAndEquity) * 100) / 100;
  return {
    id: "monetary-conservation",
    label: "M = \u03A3B\u1D62 (assets = liabilities + equity)",
    status: diff === 0 ? "pass" : "fail",
    detail: diff === 0 ? `Assets ${assets.toFixed(2)} = liabilities+equity ${(liabilities + incomeAndEquity).toFixed(2)} ${core.currency} across ${core.registry.all().length} account(s).` : `Drift of ${diff.toFixed(2)} ${core.currency} \u2014 assets=${assets.toFixed(2)}, liabilities+equity=${(liabilities + incomeAndEquity).toFixed(2)}.`
  };
}
function checkAllAccountsResolvable(core) {
  const failures = [];
  for (const account of core.registry.all()) {
    try {
      core.ledgerEngine.getAccountBalance(account.id, core.currency);
    } catch (err) {
      failures.push(`${account.id}: ${err.message}`);
    }
  }
  return {
    id: "accounts-resolvable",
    label: "All registered accounts resolvable",
    status: failures.length === 0 ? "pass" : "fail",
    detail: failures.length === 0 ? `${core.registry.all().length} account(s) all computed a balance cleanly.` : failures.join("; ")
  };
}
function checkRecentErrorRate(core, { windowSize = 50, warnThreshold = 0.3 } = {}) {
  const recent = core.eventBus.getHistory({ limit: windowSize });
  const errorCount = recent.filter((r) => ERROR_EVENTS.has(r.eventName)).length;
  const rate = recent.length ? errorCount / recent.length : 0;
  const status = recent.length === 0 ? "warn" : rate > warnThreshold ? "warn" : "pass";
  return {
    id: "recent-error-rate",
    label: "Recent event error rate",
    status,
    detail: recent.length === 0 ? "No events yet." : `${errorCount}/${recent.length} of the last events were rejections/faults (${(rate * 100).toFixed(0)}%).`
  };
}
function checkProvenanceChainIntegrity(core) {
  const ok = core.provenanceStore.verifyChain();
  const count = core.provenanceStore.getAll().length;
  return {
    id: "provenance-chain-integrity",
    label: "Transaction provenance chain integrity",
    status: ok ? "pass" : "fail",
    detail: ok ? `${count} completion record(s), chain unbroken.` : "Chain link mismatch detected in the provenance log."
  };
}
function checkDisputeChainIntegrity(core) {
  const ok = core.disputeStore.verifyChain();
  const count = core.disputeStore.getAll().length;
  return {
    id: "dispute-chain-integrity",
    label: "Dispute case chain integrity",
    status: ok ? "pass" : "fail",
    detail: ok ? `${count} case event(s), chain unbroken.` : "Chain link mismatch detected in the dispute log."
  };
}
function checkNoStaleOpenDisputes(core) {
  const now = /* @__PURE__ */ new Date();
  const stale = core.disputeService.getAllCases().filter((c) => c.status === DISPUTE_STATUS.OPEN && now.getTime() > c.receiverResponseDeadline.getTime());
  return {
    id: "no-stale-open-disputes",
    label: "No disputes past their receiver deadline",
    status: stale.length === 0 ? "pass" : "warn",
    detail: stale.length === 0 ? "Every open case is still inside its receiver response window." : `${stale.length} case(s) past deadline \u2014 will auto-expire/escalate on next read.`
  };
}
function runHealthChecks(core, opts) {
  const checks = [checkChainIntegrity(core), checkTrialBalance(core), checkMonetaryConservation(core), checkNoUnbackedIncomeRecognition(core), checkNoNegativeAssetBalances(core), checkAllAccountsResolvable(core), checkRecentErrorRate(core, opts), checkProvenanceChainIntegrity(core), checkDisputeChainIntegrity(core), checkNoStaleOpenDisputes(core)];
  const failing = checks.filter((c) => c.status === "fail");
  const warning = checks.filter((c) => c.status === "warn");
  const overall = failing.length > 0 ? "fail" : warning.length > 0 ? "warn" : "pass";
  return { overall, checks, generatedAt: /* @__PURE__ */ new Date(), recordCount: core.store.getAll().length };
}

