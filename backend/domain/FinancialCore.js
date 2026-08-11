// src/domain/FinancialCore.js
function createFinancialCore({ userId = "demo-user", currency = "INR", openingBankBalance = 5e3, eventBus, logLevel } = {}) {
  const store = new LedgerStore();
  const registry = new AccountRegistry();
  const bus = eventBus || new EventBus();
  const ledgerEngine = new LedgerEngine(store, registry, bus);
  const userAccounts = registry.registerUser(userId, currency);
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
    currency,
    eventBus: bus,
    logger
  };
}

