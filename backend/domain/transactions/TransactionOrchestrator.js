// src/domain/transactions/TransactionOrchestrator.js
var TransactionOrchestrator = class {
  // #locked guards executeTransaction's mutating/snapshot window only
  // (risk evaluation and replay reads are exempt) — see the
  // re-entrancy note on executeTransaction below.
  #locked = false;
  constructor({ ledgerEngine, riskEngine, payLaterService, settlementEngine, creatorShareService, essentialsService, essentialsPoolService, provenanceService, idempotencyGuard, eventBus, currency = "INR" }) {
    this.ledgerEngine = ledgerEngine;
    this.riskEngine = riskEngine;
    this.payLaterService = payLaterService;
    this.settlementEngine = settlementEngine;
    this.creatorShareService = creatorShareService;
    this.essentialsService = essentialsService;
    this.essentialsPoolService = essentialsPoolService || null;
    this.provenanceService = provenanceService || null;
    this.idempotencyGuard = idempotencyGuard || null;
    // The real, live bus — events staged during a transaction are
    // eventually replayed onto THIS, never onto themselves. Distinct
    // from ledgerEngine.eventBus/provenanceService.eventBus, which get
    // temporarily swapped to a staging outbox during the mutating
    // window (see #stageEvents) and always restored to point back
    // here afterward.
    this.eventBus = eventBus || null;
    this.currency = currency;
  }
  // Risk-only check, no posting — mirrors the old
  // computeTransactionDeduction/handleCheckAndDeduct split where Send
  // Money could ask "would this work" before committing. Kept separate
  // from sendMoney() so a future "preview before biometric" UI step
  // doesn't have to post-then-reverse to find out.
  evaluateSend({ userAccounts, amount, payMethodLabel }) {
    return this.riskEngine.evaluateSend({ amount, payMethodLabel, userAccounts, currency: this.currency });
  }
  // Posts the ledger side-effects of an already-evaluated decision:
  // the bank debit (routed via the platform reserve, same as every
  // other outbound movement) and/or the PayLater draw. This is the
  // direct replacement for core/transaction/transactionEngine.js's
  // applyDeductionDecision — same two-branch shape, same inputs — the
  // difference is every branch now posts a real, balanced
  // JournalEntry instead of calling a React state setter.
  // clientRequestId is optional (existing call sites are unaffected):
  // when supplied, a repeated call with the same id — a retried
  // submit, a double-tap that both landed — returns the *original*
  // ledgerRecordId instead of posting a second deduction. This is the
  // "duplicate settlement" guard for the send path specifically.
  // `now`, when supplied by executeTransaction, is threaded into every
  // posting this call makes so they share its one authoritative
  // timestamp instead of each independently stamping itself.
  applyDeduction({ userAccounts, decision, memo, clientRequestId, now }) {
    const run = () => {
      const lines = [];
      if (decision.fromBank > 0) {
        lines.push(DebitEntry(this.ledgerEngine.registry.reserve.id, Money.of(decision.fromBank, this.currency)));
        lines.push(CreditEntry(userAccounts.bank.id, Money.of(decision.fromBank, this.currency)));
      }
      let ledgerRecordId = null;
      if (lines.length > 0) {
        const record = this.ledgerEngine.postJournalEntry({ memo: memo || "Payment", lines, meta: { kind: "deduction" }, now });
        ledgerRecordId = record.id;
      }
      if (decision.fromPaylater > 0) {
        const draw = this.payLaterService.recordDraw({ userAccounts, amount: decision.fromPaylater, label: memo || "Send Money", currency: this.currency, now });
        ledgerRecordId = ledgerRecordId || draw?.id || null;
      }
      return ledgerRecordId;
    };
    return this.idempotencyGuard ? this.idempotencyGuard.execute(clientRequestId, run) : run();
  }
  // NOTE: the old standalone sendMoney()/buildReceipt() convenience
  // method (evaluate → post → receipt → Creator Share, bypassing
  // completeTransaction entirely) and the old scanAndPay() (which
  // posted a debit with NO risk/balance check at all — a second,
  // unsafe posting path) are both removed. Send Money, Scan & Pay, and
  // Pay a Business now all go through the one executeTransaction()
  // lifecycle below, which always risk-checks before posting.
  settleEssentialsToBank({ userAccounts, amount }) {
    const result = this.settlementEngine.settleEssentialsToBank({ userAccounts, amount, currency: this.currency });
    if (result.ok) this.essentialsService.clearGrants();
    return result;
  }
  settleReferralToBank({ userAccounts, amount }) {
    return this.settlementEngine.settleReferralToBank({ userAccounts, amount, currency: this.currency });
  }
  // REMOVED: the old addEssentialsGrant() passthrough that let any
  // caller mint an asset seed directly, with no ledger deduction and
  // no completed transaction behind it. Asset seeds now only ever
  // come from completeTransaction() below, on a real, first-time
  // completion. See useTransactionActions for the UI-facing note.
  // Explicit completion step — distinct from send-time ledger posting,
  // and the ONLY path (for either Send Money or Scan & Pay) that opens
  // a complaint window or creates an asset seed. Nothing upstream of a
  // successful call here ever gets a complaint window or a grant.
  //
  // Atomicity/idempotency: whether this call is the transaction's
  // *first* completion is decided once, up front, from the
  // provenance store itself (the durable source of truth) — not from
  // a flag threaded through the call. Provenance recording and the
  // asset-seed grant then both run only on that first call; a second
  // completeTransaction for the same txnId (retry, double-tap,
  // duplicate event) is a pure no-op that returns the original
  // result, never a second grant and never a re-opened window.
  // clientRequestId additionally routes through the shared
  // IdempotencyGuard when provided, so a retried request with the
  // same id short-circuits before doing any work at all.
  //
  // This remains a standalone, composable step (used internally by
  // executeTransaction() below, and directly by tests/diagnostics that
  // want to exercise completion in isolation from posting) — it is not
  // itself a second product-facing entry point. The three real UI
  // flows (Send Money, Scan & Pay, Pay a Business) never call this on
  // their own; they call executeTransaction(), which calls this as
  // part of one atomic sequence.
  completeTransaction({ userAccounts, txnId, ledgerRecordId, name, amount, shareRatePercent, time, senderGeo, receiverGeo, complaintWindowMinutes, clientRequestId, now = /* @__PURE__ */ new Date() }) {
    if (!this.provenanceService) throw new Error("completeTransaction requires a provenanceService");
    if (!txnId) throw new Error("completeTransaction requires a txnId");
    const run = () => {
      const isFirstCompletion = this.provenanceService.isFirstCompletion(txnId);
      const provenanceRecord = this.provenanceService.recordCompletion({
        txnId,
        ledgerRecordId,
        completedAt: now,
        senderGeo,
        receiverGeo,
        complaintWindowMinutes
      });
      let grant = null;
      let paylaterAutoSettlement = null;
      const shareRateDecimal = (shareRatePercent ?? 0) / 100;
      // Asset seed only ever comes from a *successful, first-time*
      // completion — never speculatively, never twice.
      if (isFirstCompletion && shareRateDecimal > 0) {
        // New Creator Share earnings pay down any outstanding PayLater
        // due FIRST, before any of it becomes freely available — e.g.
        // owe 100, already paid 50 (50 due left); a new 100 grant
        // arrives, so 50 of it settles the remaining due immediately
        // and the other 50 is what's actually free. Computed BEFORE
        // the grant is created (monthsAccrued is always 0 at creation,
        // so the grant's accrued value is just amount*rate — no need
        // for the grant object itself yet) so the settled amount can
        // be attached to the grant directly instead of trying to
        // mutate it afterward (EssentialsGrant is frozen). This is
        // what lets the grant's own Received history row show the
        // real "PayLater" method tag instead of always saying "Bank".
        const { paylaterDue } = this.payLaterService.computeAvailable(this.currency, userAccounts);
        const grantAccruedValue = amount * shareRateDecimal;
        const autoSettleAmount = paylaterDue > 0 ? Math.min(paylaterDue, grantAccruedValue) : 0;
        grant = this.essentialsService.addGrant({
          userAccounts,
          key: "creator-share",
          business: `Creator Share \xB7 ${name}`,
          chip: "CS",
          amountPaid: amount,
          cashbackRate: shareRateDecimal,
          creatorName: name,
          time,
          currency: this.currency,
          txnId,
          now,
          paylaterSettledAmount: autoSettleAmount
        });
        // The transfer itself (essentials -> paylaterPayable, see
        // SettlementEngine#settleEssentialsToPayLater) is a real
        // ledger movement, not just a smaller number shown in
        // computeAvailable() — the due is genuinely reduced,
        // atomically, as part of this same transaction.
        if (grant && autoSettleAmount > 0) {
          const settlement = this.settlementEngine.settleEssentialsToPayLater({ userAccounts, amount: autoSettleAmount, currency: this.currency, now });
          if (settlement.ok) {
            paylaterAutoSettlement = { amount: autoSettleAmount, ledgerRecordId: settlement.batch.ledgerRecordId };
          }
        }
      }
      return {
        ok: true,
        txnId,
        ledgerRecordId: provenanceRecord.payload.ledgerRecordId,
        completedAt: provenanceRecord.payload.completedAt,
        complaintWindowExpiresAt: provenanceRecord.payload.complaintWindowExpiresAt,
        firstCompletion: isFirstCompletion,
        grant,
        paylaterAutoSettlement
      };
    };
    return this.idempotencyGuard ? this.idempotencyGuard.execute(clientRequestId, run) : run();
  }
  // src/domain/transactions/executeTransaction.js
  // THE single canonical transaction lifecycle. Send Money, Scan & Pay,
  // and the "Pay a business" flow all call exactly this method — there
  // is no other product-facing way to move money in this app. One call
  // does risk evaluation, ledger posting (bank debit and/or PayLater
  // draw), provenance recording, the complaint-window open, and (if
  // eligible) the asset-seed grant, as one synchronous sequence at the
  // domain/backend boundary. Nothing here is fire-and-forget: the
  // caller gets a single settled result covering the whole lifecycle.
  //
  // TRUE TRANSACTIONAL BOUNDARY: once risk evaluation has passed and
  // any mutation is about to happen, every required effect below is
  // wrapped in a single try/catch around a snapshot taken just before
  // the first mutation. If ANY stage throws — the bank/PayLater
  // posting, the provenance/completion record, the complaint-window
  // creation (part of that same record), or the asset-seed grant —
  // every store touched by this call (ledger, PayLater records,
  // provenance, essentials grants) is restored to its exact
  // pre-transaction snapshot before returning. There is no window in
  // which a partial transaction (e.g. money moved but no completion
  // record, or a completion record but no grant despite eligibility)
  // is observable from outside this method. This is a prototype
  // in-memory analogue of BEGIN/COMMIT/ROLLBACK — see
  // #captureSnapshot/#restoreSnapshot below, and MIGRATION.md for how
  // this maps onto a real database transaction (a single
  // `db.transaction(async (tx) => {...})` block, with the snapshot/
  // restore pair replaced by the database's own rollback).
  //
  // Location is deliberately NOT a parameter that gates this method at
  // all, and is NOT part of the transactional boundary — senderGeo/
  // receiverGeo default to unknownObservation() and are meant to be
  // filled in (immediately, later, or never) via the independent
  // submitLocationObservation() channel below. A slow GPS fix, a
  // denied permission, or no receiver device connected must never
  // delay, block, or roll back money movement.
  //
  // Idempotency has two independent layers:
  //  1. clientRequestId, via the shared IdempotencyGuard — a retried
  //     submit/double-tap with the same id short-circuits before any
  //     work runs, returning the exact original result (including a
  //     prior rollback's failure result, if that's what happened).
  //  2. txnId itself, as a durable backstop — even a retry that (bug,
  //     crash-recovery, whatever) arrives with a *different*
  //     clientRequestId but the *same* txnId is detected against the
  //     provenance store (the source of truth for "did this already
  //     happen") and never re-posts or re-grants; it returns the
  //     original completion's ledgerRecordId/window/etc. with
  //     firstCompletion:false. Because a rolled-back attempt leaves NO
  //     completion record (the rollback undid it), a rolled-back
  //     txnId is indistinguishable from one that never ran — retrying
  //     it is a completely ordinary first attempt.
  // A transaction that fails risk evaluation (insufficient balance,
  // invalid amount, ...) never reaches posting, never mutates
  // anything, and needs no rollback at all — the whole sequence is
  // all-or-nothing at every stage, not just the ones after posting.
  //
  // EVENTS ARE TRANSACTIONAL TOO. Every event the mutating stages would
  // normally emit live (LEDGER_ENTRY_POSTED/REJECTED from postings,
  // PROVENANCE_COMPLETED from completion, PAYLATER_DRAW_RECORDED from
  // a PayLater draw, ESSENTIALS_GRANT_ADDED from an asset-seed grant)
  // is staged into a private per-call outbox instead — see
  // #stageEvents, which swaps ALL FOUR services' eventBus, not just
  // the ledger's and provenance's. Nothing reaches a real listener
  // until the transaction is known to have committed. On success, the
  // whole staged batch is replayed onto the real bus, in original
  // order, right after the state mutations are final — this is
  // synchronous, in-process delivery, not a durable, retryable publish;
  // see TransactionEventOutbox for how this is structured to become
  // one later without changing executeTransaction's shape. On failure,
  // the batch is discarded outright (never touches the real bus at
  // all) and exactly one TRANSACTION_FAILED event is emitted instead —
  // so a rolled-back transaction can never leave a "ledger.entry.
  // posted", "provenance.completed", "paylater.draw.recorded", or
  // "essentials.grant.added" in committed event history for state that
  // no longer exists.
  //
  // RE-ENTRANCY LOCK. The mutating/snapshot window (from just before
  // #captureSnapshot to just after commit-or-rollback) is exclusive
  // per orchestrator instance: a second executeTransaction call that
  // arrives while one is already inside that window is rejected
  // immediately with TRANSACTION_LOCKED, attempting no mutation at
  // all. This is what actually prevents the danger a naive rollback
  // has otherwise: if a second transaction were allowed to commit
  // *during* the first one's snapshot-to-restore window, the first
  // transaction's restore() would blindly overwrite the stores back to
  // its OWN pre-transaction snapshot — silently erasing whatever the
  // second transaction had just committed in between. The lock makes
  // that interleaving impossible; risk evaluation and the replay read
  // above are exempt (no mutation, safe to run reentrantly).
  executeTransaction({
    userAccounts,
    txnId,
    amount,
    payMethodLabel = null,
    memo,
    name,
    shareRatePercent = 0,
    time,
    senderGeo,
    receiverGeo,
    complaintWindowMinutes,
    clientRequestId,
    now = /* @__PURE__ */ new Date()
  }) {
    if (!txnId) throw new Error("executeTransaction requires a txnId");
    if (!this.provenanceService) throw new Error("executeTransaction requires a provenanceService");
    const run = () => {
      // Backstop: this exact transaction already completed successfully
      // (detected independent of clientRequestId) — replay is a pure
      // read of what already happened, never a second post/grant/window.
      if (!this.provenanceService.isFirstCompletion(txnId)) {
        const completion = this.provenanceService.getCompletion(txnId);
        return {
          ok: true,
          txnId,
          ledgerRecordId: completion.payload.ledgerRecordId,
          completedAt: completion.payload.completedAt,
          complaintWindowExpiresAt: completion.payload.complaintWindowExpiresAt,
          firstCompletion: false,
          grant: null
        };
      }
      const decision = this.evaluateSend({ userAccounts, amount, payMethodLabel });
      if (!decision.ok) return decision;
      // MUTATING WINDOW STARTS HERE — locked, snapshotted, and
      // event-staged all together as one unit.
      if (this.#locked) {
        this.eventBus?.emit(DomainEvent.TRANSACTION_LOCKED, { txnId });
        return {
          ok: false,
          code: "TRANSACTION_LOCKED",
          reason: "Another transaction is already in progress",
          txnId
        };
      }
      this.#locked = true;
      const snapshot = this.#captureSnapshot();
      const staging = this.#stageEvents();
      try {
        const ledgerRecordId = this.applyDeduction({ userAccounts, decision, memo, now });
        const completion = this.completeTransaction({
          userAccounts,
          txnId,
          ledgerRecordId,
          name,
          amount,
          shareRatePercent,
          time,
          senderGeo: senderGeo ?? unknownObservation(),
          receiverGeo: receiverGeo ?? unknownObservation(),
          complaintWindowMinutes,
          now
        });
        staging.restore();
        this.#flushStaged(staging.outbox);
        return { ...completion, fromBank: decision.fromBank, fromPaylater: decision.fromPaylater };
      } catch (err) {
        staging.restore();
        this.#restoreSnapshot(snapshot);
        this.eventBus?.emit(DomainEvent.TRANSACTION_FAILED, {
          txnId,
          code: "TRANSACTION_ROLLED_BACK",
          reason: (err && err.message) || "Transaction failed and was rolled back",
          failedAt: now
        });
        return {
          ok: false,
          code: "TRANSACTION_ROLLED_BACK",
          reason: (err && err.message) || "Transaction failed and was rolled back",
          txnId
        };
      } finally {
        this.#locked = false;
      }
    };
    return this.idempotencyGuard ? this.idempotencyGuard.execute(clientRequestId, run) : run();
  }
  // Swaps ledgerEngine's, provenanceService's, payLaterService's, and
  // essentialsService's live eventBus for a private
  // TransactionEventOutbox that only buffers — every domain event this
  // transaction's mutating stages can produce (LEDGER_ENTRY_POSTED/
  // REJECTED, PROVENANCE_COMPLETED, PAYLATER_DRAW_RECORDED,
  // ESSENTIALS_GRANT_ADDED) is covered, not just the first two. Nothing
  // subscribed to the real bus can observe anything emitted while
  // staging is active. Returns the outbox plus a restore() that puts
  // the original (real) bus references back, which must always be
  // called before this transaction returns, on both the success and
  // failure paths. Any future transaction-owned domain event source
  // must be added here too — this is the one place "is this staged?"
  // is decided for the whole transaction.
  #stageEvents() {
    const outbox = new TransactionEventOutbox();
    const realLedgerBus = this.ledgerEngine.eventBus;
    const realProvenanceBus = this.provenanceService.eventBus;
    const realPayLaterBus = this.payLaterService.eventBus;
    const realEssentialsBus = this.essentialsService.eventBus;
    const realEssentialsPoolBus = this.essentialsPoolService ? this.essentialsPoolService.eventBus : null;
    this.ledgerEngine.eventBus = outbox;
    this.provenanceService.eventBus = outbox;
    this.payLaterService.eventBus = outbox;
    this.essentialsService.eventBus = outbox;
    if (this.essentialsPoolService) this.essentialsPoolService.eventBus = outbox;
    return {
      outbox,
      restore: () => {
        this.ledgerEngine.eventBus = realLedgerBus;
        this.provenanceService.eventBus = realProvenanceBus;
        this.payLaterService.eventBus = realPayLaterBus;
        this.essentialsService.eventBus = realEssentialsBus;
        if (this.essentialsPoolService) this.essentialsPoolService.eventBus = realEssentialsPoolBus;
      }
    };
  }
  // Replays every staged event onto the REAL bus, in the exact order
  // they were originally staged — called only once state mutation has
  // fully succeeded, so every listener sees a fact that is actually
  // true and permanent, never a fact about to be undone.
  #flushStaged(outbox) {
    for (const { eventName, payload } of outbox.entries()) {
      this.eventBus?.emit(eventName, payload);
    }
  }
  // Point-in-time snapshot of every store this transaction's mutating
  // stages can touch: the ledger (bank debit, PayLater draw's own
  // entry, and the Essentials grant's own entry all post through the
  // same LedgerStore, so one snapshot covers all three), PayLater's
  // own record list, provenance (completion + complaint window are one
  // record in that store), Essentials' own grant list, and the My
  // Essentials daily pool's own usage counter. Taken once, immediately
  // before the first mutation of a given atomic call — never
  // speculatively, never left lying around between calls.
  #captureSnapshot() {
    return {
      ledger: this.ledgerEngine.store.snapshot(),
      provenance: this.provenanceService.store.snapshot(),
      essentials: this.essentialsService.snapshot(),
      payLater: this.payLaterService.snapshot(),
      essentialsPool: this.essentialsPoolService ? this.essentialsPoolService.snapshot() : null
    };
  }
  // Restores every store captured above to exactly the state it was in
  // before the failed attempt's first mutation — undoing the ledger
  // debit, any PayLater draw, the provenance/completion/complaint-
  // window record, any Essentials grant, and any My Essentials pool
  // usage, together, as one unit. Each store's own restore()
  // re-notifies its subscribers, so the UI reflects the rollback
  // immediately rather than showing a stale "in-flight" balance.
  #restoreSnapshot(snapshot) {
    this.essentialsService.restore(snapshot.essentials);
    this.payLaterService.restore(snapshot.payLater);
    this.provenanceService.store.restore(snapshot.provenance);
    this.ledgerEngine.store.restore(snapshot.ledger);
    if (this.essentialsPoolService && snapshot.essentialsPool) this.essentialsPoolService.restore(snapshot.essentialsPool);
  }
  // src/domain/essentials/applyEssentialsPoolSubsidy.js
  // A SEPARATE atomic operation from executeTransaction — the My
  // Essentials daily pool is not a payment method and isn't part of
  // any specific purchase's lifecycle; it's a standing daily top-up to
  // the user's own bank balance, funded directly by the platform
  // reserve. A caller (currently Scan & Pay) applies this once, before
  // the real payment, so the subsidized amount is already real bank
  // balance by the time evaluateSend/applyDeduction run inside the
  // normal executeTransaction call that follows. Reuses the exact same
  // lock/snapshot/stage-or-discard machinery as executeTransaction, so
  // it's just as safe against re-entrancy and partial failure, and its
  // one event (ESSENTIALS_POOL_APPLIED) is staged and only published
  // on success, never live mid-call.
  applyEssentialsPoolSubsidy({ userAccounts, requestedAmount, dailyLimit, currency, now = /* @__PURE__ */ new Date() }) {
    if (!this.essentialsPoolService) return { subsidyAmount: 0, ledgerRecordId: null };
    if (this.#locked) {
      this.eventBus?.emit(DomainEvent.TRANSACTION_LOCKED, { txnId: "essentials-pool-subsidy" });
      return { subsidyAmount: 0, ledgerRecordId: null, code: "TRANSACTION_LOCKED" };
    }
    this.#locked = true;
    const snapshot = this.#captureSnapshot();
    const staging = this.#stageEvents();
    try {
      const result = this.essentialsPoolService.applySubsidy({ userAccounts, requestedAmount, dailyLimit, currency: currency || this.currency, now });
      staging.restore();
      this.#flushStaged(staging.outbox);
      return result;
    } catch (err) {
      staging.restore();
      this.#restoreSnapshot(snapshot);
      this.eventBus?.emit(DomainEvent.TRANSACTION_FAILED, {
        txnId: "essentials-pool-subsidy",
        code: "TRANSACTION_ROLLED_BACK",
        reason: (err && err.message) || "Essentials pool subsidy failed and was rolled back",
        failedAt: now
      });
      return { subsidyAmount: 0, ledgerRecordId: null, code: "TRANSACTION_ROLLED_BACK" };
    } finally {
      this.#locked = false;
    }
  }
};

