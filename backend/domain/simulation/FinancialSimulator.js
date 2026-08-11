// src/domain/simulation/FinancialSimulator.js
function createSandboxCore(overrides = {}) {
  return createFinancialCore({ userId: "sim-user", currency: "INR", openingBankBalance: 2e4, logLevel: "silent", ...overrides });
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a |= 0;
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
var PAY_METHODS = [void 0, "Bank", "PayLater"];
function randomAmount(rand, { min = 1, max = 3e3 } = {}) {
  return Math.round((min + rand() * (max - min)) * 100) / 100;
}
function runTransactionStorm({ count = 200, seed = 1 } = {}) {
  const core = createSandboxCore();
  const rand = mulberry32(seed);
  let posted = 0;
  let rejected = 0;
  const rejectionsByCode = /* @__PURE__ */ new Map();
  for (let i = 0; i < count; i++) {
    const roll = rand();
    const amount = roll < 0.1 ? [-5, 0, NaN][Math.floor(rand() * 3)] : roll < 0.3 ? randomAmount(rand, { min: 15e3, max: 5e4 }) : randomAmount(rand);
    const payMethodLabel = PAY_METHODS[Math.floor(rand() * PAY_METHODS.length)];
    const decision = core.orchestrator.evaluateSend({ userAccounts: core.userAccounts, amount, payMethodLabel });
    core.eventBus.emit(DomainEvent.SIMULATION_STEP, { scenario: "transaction-storm", stepIndex: i, total: count, ok: decision.ok });
    if (!decision.ok) {
      rejected += 1;
      rejectionsByCode.set(decision.code, (rejectionsByCode.get(decision.code) || 0) + 1);
      continue;
    }
    core.orchestrator.applyDeduction({ userAccounts: core.userAccounts, decision, memo: `Sim tx #${i}` });
    posted += 1;
  }
  const health = runHealthChecks(core);
  const replay = replayIntoFreshStore(core);
  const report = {
    scenario: "transaction-storm",
    seed,
    requested: count,
    posted,
    rejected,
    rejectionsByCode: Array.from(rejectionsByCode, ([code, n]) => ({ code, count: n })),
    health,
    replay,
    finalBankBalance: core.ledgerEngine.getAccountBalance(core.userAccounts.bank.id, core.currency).amount
  };
  core.eventBus.emit(DomainEvent.SIMULATION_COMPLETE, { scenario: "transaction-storm", report });
  return report;
}
function runDuplicateSubmissionScenario({ distinctRequests = 20, maxDuplicatesPerRequest = 4, seed = 2 } = {}) {
  const core = createSandboxCore();
  const rand = mulberry32(seed);
  const guard = new IdempotencyGuard({ eventBus: core.eventBus });
  let totalSubmissions = 0;
  let dedupedCount = 0;
  for (let i = 0; i < distinctRequests; i++) {
    const clientRequestId = `sim-req-${i}`;
    const amount = randomAmount(rand, { min: 10, max: 500 });
    const duplicates = 1 + Math.floor(rand() * maxDuplicatesPerRequest);
    for (let d = 0; d < duplicates; d++) {
      totalSubmissions += 1;
      const before = core.store.getAll().length;
      guard.execute(clientRequestId, () => {
        const decision = core.orchestrator.evaluateSend({ userAccounts: core.userAccounts, amount, payMethodLabel: void 0 });
        if (decision.ok) core.orchestrator.applyDeduction({ userAccounts: core.userAccounts, decision, memo: `Sim dup ${clientRequestId}` });
        return decision;
      });
      const after = core.store.getAll().length;
      if (d > 0 && after === before) dedupedCount += 1;
    }
  }
  const recordCount = core.store.getAll().length;
  return {
    scenario: "duplicate-submission",
    seed,
    distinctRequests,
    totalSubmissions,
    dedupedCount,
    recordsPosted: recordCount,
    ok: recordCount <= distinctRequests + 1,
    health: runHealthChecks(core)
  };
}
function runOfflineRecoveryScenario({ count = 15, seed = 3 } = {}) {
  const core = createSandboxCore();
  const rand = mulberry32(seed);
  const queue = new OfflineQueue({ eventBus: core.eventBus, online: false });
  const amounts = Array.from({ length: count }, () => randomAmount(rand, { min: 20, max: 800 }));
  for (const amount of amounts) {
    queue.enqueueOrRun("send", () => {
      const decision = core.orchestrator.evaluateSend({ userAccounts: core.userAccounts, amount, payMethodLabel: void 0 });
      if (decision.ok) core.orchestrator.applyDeduction({ userAccounts: core.userAccounts, decision, memo: "Sim offline send" });
      return decision;
    });
  }
  const queuedWhileOffline = queue.size();
  const flushResults = queue.setOnline(true);
  return {
    scenario: "offline-recovery",
    seed,
    count,
    queuedWhileOffline,
    flushedCount: flushResults.length,
    flushFailures: flushResults.filter((r) => !r.ok).length,
    finalBankBalance: core.ledgerEngine.getAccountBalance(core.userAccounts.bank.id, core.currency).amount,
    health: runHealthChecks(core)
  };
}
async function runFlakyNetworkScenario({ count = 12, failEveryNth = 3, seed = 4 } = {}) {
  const core = createSandboxCore();
  const rand = mulberry32(seed);
  const injector = new FaultInjector({ eventBus: core.eventBus });
  let succeeded = 0;
  let permanentFailures = 0;
  for (let i = 0; i < count; i++) {
    if (i % failEveryNth === 0) injector.scheduleFault({ kind: "throw", count: 1, message: "Simulated transient network failure" });
    const amount = randomAmount(rand, { min: 10, max: 400 });
    try {
      await withFixedRetry(
        () => injector.guard("send", () => {
          const decision = core.orchestrator.evaluateSend({ userAccounts: core.userAccounts, amount, payMethodLabel: void 0 });
          if (decision.ok) core.orchestrator.applyDeduction({ userAccounts: core.userAccounts, decision, memo: "Sim flaky send" });
          return decision;
        }),
        { maxAttempts: 3, delayMs: 1, eventBus: core.eventBus, label: "sim-send" }
      );
      succeeded += 1;
    } catch {
      permanentFailures += 1;
    }
  }
  return {
    scenario: "flaky-network",
    seed,
    count,
    succeeded,
    permanentFailures,
    recordsPosted: core.store.getAll().length,
    health: runHealthChecks(core)
  };
}
async function runFullStressTest({ seed = Date.now() & 65535 } = {}) {
  const storm = runTransactionStorm({ count: 300, seed });
  const duplicates = runDuplicateSubmissionScenario({ distinctRequests: 25, seed: seed + 1 });
  const offline = runOfflineRecoveryScenario({ count: 20, seed: seed + 2 });
  const flaky = await runFlakyNetworkScenario({ count: 15, seed: seed + 3 });
  const scenarios = [storm, duplicates, offline, flaky];
  const allHealthy = scenarios.every((s) => s.health.overall !== "fail");
  return {
    seed,
    generatedAt: /* @__PURE__ */ new Date(),
    overall: allHealthy ? "pass" : "fail",
    scenarios
  };
}

