// src/domain/provenance/ProvenanceService.js
// Stores the full sender+receiver location OBSERVATIONS (the
// "backend" truth: latitude, longitude, accuracy, observedAt, status)
// and exposes only a viewer-scoped projection (getLocationForViewer)
// to UI callers — city/state, never raw coordinates, never the other
// party's location. One completion record per txnId; completedAt is
// an explicit field distinct from the ledger record's own postedAt
// (which stands in for initiation time — no separate initiation event
// is duplicated here, the ledger already owns that timestamp).
// recordCompletion is the ONLY place a completion record is created,
// and is idempotent per txnId — completion is meant to be called at
// most meaningfully once; a second call for the same txnId is a no-op
// that returns the original record rather than overwriting it.
//
// Location and completion are deliberately decoupled: recordCompletion
// takes a best-effort senderGeo/receiverGeo *snapshot* at the moment
// the transaction completes (usually unknownObservation() for whichever
// side has no observation in hand yet), but the real, live location for
// either party can arrive independently — before completion, after
// completion, more than once — through submitLocationObservation()
// below. That's the actual "receiver-side location-observation
// interface": any device, sender or receiver, can report its own
// observation against a txnId whenever it has one, without that report
// ever being required for (or blocking) the transaction itself.
var ProvenanceService = class {
  constructor(store, eventBus, { complaintWindowMinutes = COMPLAINT_WINDOW_MINUTES_DEFAULT, idempotencyGuard } = {}) {
    this.store = store;
    this.eventBus = eventBus || null;
    this.complaintWindowMinutes = complaintWindowMinutes;
    this.idempotencyGuard = idempotencyGuard || null;
  }
  recordCompletion({ txnId, ledgerRecordId, completedAt = /* @__PURE__ */ new Date(), senderGeo, receiverGeo, complaintWindowMinutes }) {
    if (!txnId) throw new Error("recordCompletion requires a txnId");
    const existing = this.getCompletion(txnId);
    if (existing) return existing;
    const windowMinutes = complaintWindowMinutes ?? this.complaintWindowMinutes;
    const senderObservation = withFreshness(asObservation(senderGeo), completedAt);
    const receiverObservation = withFreshness(asObservation(receiverGeo), completedAt);
    const senderLocation = resolveLocationLabel(senderObservation);
    const receiverLocation = resolveLocationLabel(receiverObservation);
    const complaintWindowExpiresAt = new Date(completedAt.getTime() + windowMinutes * 6e4);
    const record = this.store.append({
      txnId,
      kind: "completed",
      payload: {
        ledgerRecordId: ledgerRecordId ?? null,
        completedAt,
        // Full backend-only observation snapshot AT COMPLETION TIME:
        // lat/lon/accuracy/timestamp/status. If a real observation
        // arrives later via submitLocationObservation(), the *current*
        // view (see #currentObservation below) overlays this snapshot
        // without ever rewriting this immutable record.
        senderGeo: senderObservation,
        receiverGeo: receiverObservation,
        // UI-facing projections of the snapshot only — never raw coordinates.
        senderLocation,
        receiverLocation,
        senderLocationStatus: senderObservation.status,
        receiverLocationStatus: receiverObservation.status,
        complaintWindowMinutes: windowMinutes,
        complaintWindowExpiresAt
      }
    }, { recordedAt: completedAt });
    this.eventBus?.emit(DomainEvent.PROVENANCE_COMPLETED, { txnId, completedAt, complaintWindowExpiresAt });
    return record;
  }
  // The real location-observation submission interface. Either party's
  // OWN device calls this with ITS OWN observation — never someone
  // else's location, never a guess on their behalf. Independent of
  // completion: can be called before a completeTransaction/
  // executeTransaction for this txnId has even happened, after it, or
  // both (a device might submit a rough fix immediately and a better
  // one moments later — the latest submission for a role wins). Never
  // fabricates: whatever isn't a real LocationObservation coerces to
  // UNKNOWN via asObservation, exactly like every other entry point.
  //
  // TRUST BOUNDARY (prototype gap, not fixed here): role, like
  // viewerRole/raisedBy above, is caller-supplied. In production the
  // backend must derive "which role is this authenticated caller" from
  // the session/device identity submitting the request, not accept a
  // client-asserted "sender"/"receiver" string — otherwise one party
  // could submit an observation claiming to be the other party's
  // device.
  submitLocationObservation({ txnId, role, observation, now = /* @__PURE__ */ new Date(), clientRequestId }) {
    if (!txnId) return { ok: false, code: "MISSING_TXN_ID", reason: "submitLocationObservation requires a txnId" };
    if (role !== "sender" && role !== "receiver") {
      return { ok: false, code: "INVALID_ROLE", reason: 'role must be "sender" or "receiver"' };
    }
    const run = () => {
      const resolved = withFreshness(asObservation(observation), now);
      const record = this.store.append({
        txnId,
        kind: `location:${role}`,
        payload: { role, observation: resolved, submittedAt: now }
      });
      this.eventBus?.emit(DomainEvent.LOCATION_OBSERVATION_SUBMITTED, { txnId, role, status: resolved.status, submittedAt: now });
      return { ok: true, txnId, role, status: resolved.status, recordId: record.id };
    };
    return this.idempotencyGuard ? this.idempotencyGuard.execute(clientRequestId, run) : run();
  }
  // The CURRENT observation for a role: the latest independently
  // submitted observation for this txnId+role if one exists, otherwise
  // the snapshot captured at completion time, otherwise (no completion
  // yet either) an explicit UNKNOWN — never a fabricated fallback.
  // Re-evaluated for freshness against `now` on every read, so an
  // AVAILABLE fix that's aged past the staleness window downgrades to
  // STALE without needing anyone to re-submit it.
  #currentObservation(txnId, role, now = /* @__PURE__ */ new Date()) {
    const submissions = this.getForTxn(txnId).filter((r) => r.kind === `location:${role}`);
    if (submissions.length > 0) {
      const latest = submissions[submissions.length - 1];
      return withFreshness(asObservation(latest.payload.observation), now);
    }
    const completion = this.getCompletion(txnId);
    if (completion) {
      const baseline = role === "sender" ? completion.payload.senderGeo : completion.payload.receiverGeo;
      return withFreshness(asObservation(baseline), now);
    }
    return unknownObservation();
  }
  // True only for a txnId that has never had a completion recorded —
  // used by the orchestrator to decide, before touching money-adjacent
  // side effects, whether this call is the one that actually completes
  // the transaction or a harmless repeat.
  isFirstCompletion(txnId) {
    return !this.getCompletion(txnId);
  }
  getForTxn(txnId) {
    return this.store.getAll().filter((r) => r.txnId === txnId);
  }
  getCompletion(txnId) {
    return this.getForTxn(txnId).find((r) => r.kind === "completed") || null;
  }
  // Viewer-scoped projection — the one read path UI is meant to use.
  // viewerRole is "sender" | "receiver"; anything else returns null
  // rather than guessing. Reflects the CURRENT observation, including
  // anything submitted independently after completion.
  //
  // TRUST BOUNDARY (prototype gap, not fixed here): viewerRole is a
  // plain caller-supplied string in this client-only build — there is
  // no server session to derive it from. In production this MUST come
  // from the authenticated identity attached to the request (i.e. the
  // backend derives "you are the sender or receiver of this txnId"
  // from who is logged in, never trusts a client-passed role string),
  // or a viewer could pass "receiver" and read the other party's
  // resolved city. Same applies to getLocationStatusForViewer,
  // submitLocationObservation's role, and DisputeService.openComplaint's
  // raisedBy below.
  getLocationForViewer(txnId, viewerRole, now = /* @__PURE__ */ new Date()) {
    if (viewerRole !== "sender" && viewerRole !== "receiver") return null;
    if (!this.getCompletion(txnId) && this.getForTxn(txnId).length === 0) return null;
    return resolveLocationLabel(this.#currentObservation(txnId, viewerRole, now));
  }
  // Status-only projection (no coordinates) — lets UI explain *why*
  // no location is showing ("denied", "unknown", "timeout"...) without
  // ever exposing lat/lon. Also reflects the current observation.
  getLocationStatusForViewer(txnId, viewerRole, now = /* @__PURE__ */ new Date()) {
    if (viewerRole !== "sender" && viewerRole !== "receiver") return null;
    if (!this.getCompletion(txnId) && this.getForTxn(txnId).length === 0) return null;
    return this.#currentObservation(txnId, viewerRole, now).status;
  }
  getComplaintWindow(txnId) {
    const completion = this.getCompletion(txnId);
    if (!completion) return null;
    return { expiresAt: completion.payload.complaintWindowExpiresAt, windowMinutes: completion.payload.complaintWindowMinutes };
  }
  isWithinComplaintWindow(txnId, now = /* @__PURE__ */ new Date()) {
    const window = this.getComplaintWindow(txnId);
    if (!window) return false;
    return now.getTime() <= window.expiresAt.getTime();
  }
};

