// src/domain/FinancialCore.js
function createFinancialCore({ userId = "demo-user", currency = "INR", openingBankBalance = 5e3, eventBus, logLevel } = {}) {
  const store = new LedgerStore();
  const registry = new AccountRegistry();
  const bus = eventBus || new EventBus();
  const ledgerEngine = new LedgerEngine(store, registry, bus);
  const userAccounts = registry.registerUser(userId, currency);
  // Gloobal Coin. The server owns the balances (Backend/server.js, and
  // tests/coin-supply-invariant.test.mjs asserts the supply invariant there);
  // this records the same movements as double entry so the local ledger and the
  // database tell one story rather than two.
  const coinService = new CoinService(
    ledgerEngine,
    {
      userBank: userAccounts.bank,
      userCoin: userAccounts.coin,
      coinReserve: registry.coinReserve,
      coinIssuance: registry.coinIssuance
    },
    { reserveCurrency: currency, eventBus: bus }
  );
  const liquidityPool = new LiquidityPool({ id: `pool:${currency}`, currency, reserveAccountId: registry.reserve.id });
  const liquidityService = new LiquidityService(ledgerEngine, liquidityPool);
  const essentialsService = new EssentialsService(ledgerEngine, ASSET_GROWTH_RATE_MONTHLY, bus);
  const essentialsPoolService = new EssentialsPoolService(ledgerEngine, bus);
  const creatorShareService = new CreatorShareService(essentialsService);
  const payLaterService = new PayLaterService(ledgerEngine, essentialsService, liquidityService, bus);
  const riskEngine = new RiskEngine(ledgerEngine, payLaterService, bus);
  const settlementEngine = new SettlementEngine(ledgerEngine);
  const provenanceStore = createProvenanceStore();
  const disputeStore = createDisputeStore();
  const idempotencyGuard = new IdempotencyGuard({ eventBus: bus });
  const provenanceService = new ProvenanceService(provenanceStore, bus, { idempotencyGuard });
  const disputeService = new DisputeService({ store: disputeStore, provenanceService, eventBus: bus, idempotencyGuard });
  const logger = createLogger(bus, { level: logLevel ?? "info", scope: userId });
  const orchestrator = new TransactionOrchestrator({
    ledgerEngine,
    riskEngine,
    payLaterService,
    settlementEngine,
    creatorShareService,
    essentialsService,
    essentialsPoolService,
    provenanceService,
    idempotencyGuard,
    eventBus: bus,
    currency
  });
  if (openingBankBalance > 0) {
    ledgerEngine.postJournalEntry({
      memo: "Opening Balance",
      lines: [DebitEntry(userAccounts.bank.id, Money.of(openingBankBalance, currency)), CreditEntry(registry.reserve.id, Money.of(openingBankBalance, currency))],
      meta: { kind: "opening-balance" }
    });
  }
  // Bring the local bank balance in line with the account's real balance
  // on the server.
  //
  // The two used to be unrelated: this ledger opened at a fixed 5,000 and
  // tracked only what happened in this browser session, while
  // POST /api/transactions/send debited the balance MongoDB holds. So the
  // dashboard could show 5,000 to an account the server knew was empty —
  // and, worse, the local figure is what executeTransaction's risk check
  // reads, so spending decisions were made against a number the backend
  // did not share.
  //
  // Reconciling by posting rather than by assignment is deliberate. This
  // is a double-entry ledger; a balance is derived from entries, not
  // stored, so there is nothing to assign. The adjustment uses the same
  // account pair the opening balance uses (bank against reserve), which is
  // what makes it a legitimate entry rather than a hole in the books, and
  // it stays visible in the ledger as its own memo.
  //
  // Returns the delta applied, or 0 when already in sync — callers can
  // fire this on every refresh without it doing anything when nothing
  // changed.
  function reconcileBankBalance(serverBalance) {
    // Only a genuine number counts. Coercing first would be a trap:
    // Number(null), Number("") and Number([]) are all 0 — finite,
    // non-negative, and indistinguishable from a real zero balance — so a
    // response with `balance` missing or null would wipe the account's
    // balance to nothing and post an entry saying the server asked for it.
    const isNumeric =
      typeof serverBalance === "number" ||
      (typeof serverBalance === "string" && serverBalance.trim() !== "" && Number.isFinite(Number(serverBalance)));
    if (!isNumeric) return 0;
    const target = Number(serverBalance);
    if (!Number.isFinite(target) || target < 0) return 0;
    const current = ledgerEngine.getAccountBalance(userAccounts.bank.id, currency).amount;
    const delta = Number((target - current).toFixed(2));
    if (delta === 0) return 0;
    const magnitude = Money.of(Math.abs(delta), currency);
    ledgerEngine.postJournalEntry({
      memo: "Balance reconciled with Gloobal server",
      lines:
        delta > 0
          ? [DebitEntry(userAccounts.bank.id, magnitude), CreditEntry(registry.reserve.id, magnitude)]
          : [DebitEntry(registry.reserve.id, magnitude), CreditEntry(userAccounts.bank.id, magnitude)],
      meta: { kind: "server-reconciliation", serverBalance: target, delta }
    });
    return delta;
  }
  bus.emit(DomainEvent.CORE_INITIALIZED, { userId, currency, openingBankBalance });
  return {
    store,
    registry,
    ledgerEngine,
    userAccounts,
    liquidityService,
    essentialsService,
    essentialsPoolService,
    creatorShareService,
    payLaterService,
    riskEngine,
    settlementEngine,
    orchestrator,
    provenanceStore,
    provenanceService,
    disputeStore,
    disputeService,
    idempotencyGuard,
    reconcileBankBalance,
    coinService,
    // Mirrors reconcileBankBalance for the coin side. Both are handed the
    // figure the server just reported, and both are no-ops when it already
    // agrees, so a screen can call them after every coin call without
    // littering the ledger.
    reconcileCoinBalance: (serverCoinBalance) => coinService.reconcile(serverCoinBalance),
    coinCurrency: COIN_CURRENCY,
    currency,
    eventBus: bus,
    logger
  };
}

