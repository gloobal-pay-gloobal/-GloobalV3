// src/domain/disputes/DisputeService.js
// A complaint is a *case*, never an automatic fraud flag or reversal.
// State machine: open -> (accepted -> resolved) | (declined ->
// escalated) | (expired -> escalated). Every transition is an
// appended, chained event — current state is always a pure fold over
// that event log (getCase/getCasesForTxn), so it's replayable by
// construction, matching the ledger's own audit story.
var DisputeService = class {
  constructor({ store, provenanceService, eventBus, idempotencyGuard, responseWindowHours = DISPUTE_RECEIVER_RESPONSE_HOURS_DEFAULT }) {
    this.store = store;
    this.provenanceService = provenanceService;
    this.eventBus = eventBus || null;
    this.idempotencyGuard = idempotencyGuard || null;
    this.responseWindowHours = responseWindowHours;
  }
  #eventsForCase(caseId) {
    return this.store.getAll().filter((e) => e.caseId === caseId);
  }
  #currentState(caseId) {
    const events = this.#eventsForCase(caseId);
    if (events.length === 0) return null;
    const first = events[0];
    const last = events[events.length - 1];
    return {
      caseId,
      txnId: first.payload.txnId,
      raisedBy: first.payload.raisedBy,
      reason: first.payload.reason,
      openedAt: first.payload.openedAt,
      receiverResponseDeadline: first.payload.receiverResponseDeadline,
      status: last.payload.status,
      events
    };
  }
  // TRUST BOUNDARY (prototype gap, not fixed here): raisedBy is a
  // plain caller-supplied string, same as viewerRole on
  // ProvenanceService above. In production this must be derived from
  // the authenticated identity making the request (the backend knows
  // whether that identity is the sender or receiver of txnId), never
  // accepted as a client-asserted value — otherwise anyone could open
  // a complaint claiming to be "the receiver" of someone else's
  // transaction.
  openComplaint({ txnId, raisedBy, reason, now = /* @__PURE__ */ new Date(), clientRequestId }) {
    const run = () => {
      if (!this.provenanceService.isWithinComplaintWindow(txnId, now)) {
        return { ok: false, code: DISPUTE_ERROR.OUTSIDE_COMPLAINT_WINDOW, reason: "The verification window for this transaction has closed." };
      }
      const existing = this.store.getAll().find((e) => e.payload.txnId === txnId && [DISPUTE_STATUS.OPEN, DISPUTE_STATUS.IN_CONVERSATION].includes(e.payload.status));
      if (existing) {
        return { ok: false, code: DISPUTE_ERROR.ALREADY_OPEN, reason: "A case is already open for this transaction.", caseId: existing.caseId };
      }
      const caseId = genDisputeCaseId();
      const receiverResponseDeadline = new Date(now.getTime() + this.responseWindowHours * 36e5);
      this.store.append({ caseId, kind: "opened", payload: { txnId, raisedBy, reason: reason || null, status: DISPUTE_STATUS.OPEN, openedAt: now, receiverResponseDeadline } });
      this.eventBus?.emit(DomainEvent.DISPUTE_OPENED, { caseId, txnId, raisedBy, receiverResponseDeadline });
      return { ok: true, caseId, status: DISPUTE_STATUS.OPEN, receiverResponseDeadline };
    };
    return this.idempotencyGuard ? this.idempotencyGuard.execute(clientRequestId, run) : run();
  }
  acceptConversation({ caseId, now = /* @__PURE__ */ new Date() }) {
    const state = this.#currentState(caseId);
    if (!state) return { ok: false, code: DISPUTE_ERROR.NOT_FOUND };
    if (state.status !== DISPUTE_STATUS.OPEN) {
      return { ok: false, code: DISPUTE_ERROR.INVALID_TRANSITION, reason: `Case is ${state.status}, not open.` };
    }
    if (now.getTime() > state.receiverResponseDeadline.getTime()) {
      return this.#expire(state, now);
    }
    this.store.append({ caseId, kind: "accepted", payload: { txnId: state.txnId, raisedBy: state.raisedBy, openedAt: state.openedAt, receiverResponseDeadline: state.receiverResponseDeadline, status: DISPUTE_STATUS.IN_CONVERSATION, acceptedAt: now } });
    this.eventBus?.emit(DomainEvent.DISPUTE_ACCEPTED, { caseId, acceptedAt: now });
    return { ok: true, status: DISPUTE_STATUS.IN_CONVERSATION };
  }
  declineConversation({ caseId, now = /* @__PURE__ */ new Date(), reason }) {
    const state = this.#currentState(caseId);
    if (!state) return { ok: false, code: DISPUTE_ERROR.NOT_FOUND };
    if (state.status !== DISPUTE_STATUS.OPEN) {
      return { ok: false, code: DISPUTE_ERROR.INVALID_TRANSITION, reason: `Case is ${state.status}, not open.` };
    }
    this.store.append({ caseId, kind: "declined", payload: { txnId: state.txnId, raisedBy: state.raisedBy, openedAt: state.openedAt, receiverResponseDeadline: state.receiverResponseDeadline, status: DISPUTE_STATUS.DECLINED, declinedAt: now, declineReason: reason || null } });
    this.eventBus?.emit(DomainEvent.DISPUTE_DECLINED, { caseId, declinedAt: now });
    return this.#escalate(caseId, now, "declined");
  }
  #expire(state, now) {
    this.store.append({ caseId: state.caseId, kind: "expired", payload: { txnId: state.txnId, raisedBy: state.raisedBy, openedAt: state.openedAt, receiverResponseDeadline: state.receiverResponseDeadline, status: DISPUTE_STATUS.EXPIRED, expiredAt: now } });
    this.eventBus?.emit(DomainEvent.DISPUTE_EXPIRED, { caseId: state.caseId, expiredAt: now });
    return this.#escalate(state.caseId, now, "expired");
  }
  #escalate(caseId, now, triggeredBy) {
    const state = this.#currentState(caseId);
    this.store.append({ caseId, kind: "escalated", payload: { txnId: state.txnId, raisedBy: state.raisedBy, openedAt: state.openedAt, receiverResponseDeadline: state.receiverResponseDeadline, status: DISPUTE_STATUS.ESCALATED, escalatedAt: now, triggeredBy } });
    this.eventBus?.emit(DomainEvent.DISPUTE_ESCALATED, { caseId, escalatedAt: now, triggeredBy });
    return { ok: true, status: DISPUTE_STATUS.ESCALATED, triggeredBy };
  }
  // Lazily expires any case whose receiver window has passed without a
  // response. No real cron in a client-only demo, so this is called
  // both on-demand (diagnostics action) and defensively before any
  // read that needs current state — mirrors the ledger replay's "walk
  // everything, (re)derive" approach rather than trusting a timer.
  sweepExpired(now = /* @__PURE__ */ new Date()) {
    const openCaseIds = /* @__PURE__ */ new Set(this.store.getAll().filter((e) => e.payload.status === DISPUTE_STATUS.OPEN).map((e) => e.caseId));
    const results = [];
    for (const caseId of openCaseIds) {
      const state = this.#currentState(caseId);
      if (state && state.status === DISPUTE_STATUS.OPEN && now.getTime() > state.receiverResponseDeadline.getTime()) {
        results.push({ caseId, ...this.#expire(state, now) });
      }
    }
    return results;
  }
  resolve({ caseId, resolution, now = /* @__PURE__ */ new Date() }) {
    const state = this.#currentState(caseId);
    if (!state) return { ok: false, code: DISPUTE_ERROR.NOT_FOUND };
    if (![DISPUTE_STATUS.IN_CONVERSATION, DISPUTE_STATUS.ESCALATED].includes(state.status)) {
      return { ok: false, code: DISPUTE_ERROR.INVALID_TRANSITION, reason: `Case is ${state.status}.` };
    }
    this.store.append({ caseId, kind: "resolved", payload: { txnId: state.txnId, raisedBy: state.raisedBy, openedAt: state.openedAt, receiverResponseDeadline: state.receiverResponseDeadline, status: DISPUTE_STATUS.RESOLVED, resolvedAt: now, resolution: resolution || null } });
    this.eventBus?.emit(DomainEvent.DISPUTE_RESOLVED, { caseId, resolvedAt: now, resolution });
    return { ok: true, status: DISPUTE_STATUS.RESOLVED };
  }
  getCase(caseId) {
    this.sweepExpired();
    return this.#currentState(caseId);
  }
  getCasesForTxn(txnId) {
    this.sweepExpired();
    const caseIds = /* @__PURE__ */ new Set(this.store.getAll().filter((e) => e.payload.txnId === txnId).map((e) => e.caseId));
    return Array.from(caseIds, (id) => this.#currentState(id));
  }
  getAllCases() {
    this.sweepExpired();
    const caseIds = /* @__PURE__ */ new Set(this.store.getAll().map((e) => e.caseId));
    return Array.from(caseIds, (id) => this.#currentState(id)).sort((a, b) => b.openedAt - a.openedAt);
  }
};

