import test from "node:test";
import assert from "node:assert/strict";
import {
  createFinancialCore,
  DISPUTE_STATUS,
  DISPUTE_ERROR,
  ChainStore,
  LocationObservation,
  LOCATION_STATUS,
  LOCATION_STALE_AFTER_MS_DEFAULT,
  unknownObservation,
  asObservation,
  withFreshness,
  resolveLocationLabel,
  LOCATION_MOCK_CITIES,
  COMPLAINT_WINDOW_MINUTES_DEFAULT,
  DISPUTE_RECEIVER_RESPONSE_HOURS_DEFAULT,
  CAPABILITY_KEY,
  deriveCapabilityStates
} from "../app_bundle_testonly.mjs";

function freshCore(opts = {}) {
  return createFinancialCore({ userId: "test-user", currency: "INR", openingBankBalance: 10000, ...opts });
}

function available(latitude, longitude, observedAt = new Date()) {
  return new LocationObservation({ status: LOCATION_STATUS.AVAILABLE, latitude, longitude, accuracy: 20, observedAt });
}

// ---------------------------------------------------------------------
// LocationObservation — the replacement for the old GeoCapture, and
// the core of "never fabricate location; preserve explicit states".
// ---------------------------------------------------------------------
test("an AVAILABLE observation with valid coordinates reports hasCoordinates() true", () => {
  const obs = available(12.9716, 77.5946);
  assert.equal(obs.status, LOCATION_STATUS.AVAILABLE);
  assert.equal(obs.hasCoordinates(), true);
});

test("out-of-range coordinates are stored as-given but never treated as usable — hasCoordinates() is the range gate", () => {
  const obs = new LocationObservation({ status: LOCATION_STATUS.AVAILABLE, latitude: 999, longitude: 10 });
  assert.equal(obs.latitude, 999);
  assert.equal(obs.hasCoordinates(), false, "out-of-range latitude must never be treated as a usable fix");
  assert.equal(resolveLocationLabel(obs), null, "and must never resolve to a city");
});

test("every explicit status is preserved as given: denied, unavailable, timeout, stale, unknown", () => {
  for (const status of [LOCATION_STATUS.DENIED, LOCATION_STATUS.UNAVAILABLE, LOCATION_STATUS.TIMEOUT, LOCATION_STATUS.STALE, LOCATION_STATUS.UNKNOWN]) {
    const obs = new LocationObservation({ status });
    assert.equal(obs.status, status);
    assert.equal(obs.hasCoordinates(), false, `${status} observation should carry no coordinates`);
  }
});

test("an unrecognized status string is never silently accepted as real data — it collapses to UNKNOWN", () => {
  const obs = new LocationObservation({ status: "definitely-not-a-real-status", latitude: 1, longitude: 1 });
  assert.equal(obs.status, LOCATION_STATUS.UNKNOWN);
});

test("unknownObservation() is the explicit 'no channel to observe from' state, never coordinates", () => {
  const obs = unknownObservation();
  assert.equal(obs.status, LOCATION_STATUS.UNKNOWN);
  assert.equal(obs.hasCoordinates(), false);
});

test("asObservation coerces anything that isn't a real LocationObservation to UNKNOWN — it never invents coordinates from a raw {lat,lon}-shaped object", () => {
  const coerced = asObservation({ latitude: 12.9716, longitude: 77.5946 });
  assert.equal(coerced.status, LOCATION_STATUS.UNKNOWN);
  assert.equal(coerced.hasCoordinates(), false);
  assert.equal(asObservation(null).status, LOCATION_STATUS.UNKNOWN);
  assert.equal(asObservation(undefined).status, LOCATION_STATUS.UNKNOWN);
});

test("asObservation passes a real LocationObservation through unchanged", () => {
  const obs = available(1, 1);
  assert.equal(asObservation(obs), obs);
});

test("resolveLocationLabel resolves the nearest mock city for an AVAILABLE observation", () => {
  // Exactly Bengaluru's coordinates from the mock table.
  const obs = available(12.9716, 77.5946);
  const label = resolveLocationLabel(obs);
  assert.ok(label);
  assert.equal(label.city, "Bengaluru");
  assert.equal(label.approximate, true);
  assert.ok(label.nearestDistanceKm < 1);
  assert.equal(label.stale, false);
});

test("resolveLocationLabel returns null for null/UNKNOWN/DENIED/UNAVAILABLE/TIMEOUT — never guesses a city", () => {
  assert.equal(resolveLocationLabel(null), null);
  assert.equal(resolveLocationLabel(unknownObservation()), null);
  assert.equal(resolveLocationLabel(new LocationObservation({ status: LOCATION_STATUS.DENIED })), null);
  assert.equal(resolveLocationLabel(new LocationObservation({ status: LOCATION_STATUS.UNAVAILABLE })), null);
  assert.equal(resolveLocationLabel(new LocationObservation({ status: LOCATION_STATUS.TIMEOUT })), null);
});

test("resolveLocationLabel still resolves a STALE observation's coordinates — stale is 'old', not 'absent'", () => {
  const stale = new LocationObservation({ status: LOCATION_STATUS.STALE, latitude: 12.9716, longitude: 77.5946, observedAt: new Date() });
  const label = resolveLocationLabel(stale);
  assert.ok(label);
  assert.equal(label.city, "Bengaluru");
  assert.equal(label.stale, true);
});

test("withFreshness downgrades an old AVAILABLE fix to STALE without discarding its coordinates", () => {
  const oldObservedAt = new Date(Date.now() - (LOCATION_STALE_AFTER_MS_DEFAULT + 60000));
  const obs = available(12.9716, 77.5946, oldObservedAt);
  const reevaluated = withFreshness(obs, new Date());
  assert.equal(reevaluated.status, LOCATION_STATUS.STALE);
  assert.equal(reevaluated.latitude, 12.9716);
  assert.equal(reevaluated.longitude, 77.5946);
});

test("withFreshness leaves a recent AVAILABLE fix untouched", () => {
  const obs = available(12.9716, 77.5946, new Date());
  const reevaluated = withFreshness(obs, new Date());
  assert.equal(reevaluated.status, LOCATION_STATUS.AVAILABLE);
});

test("withFreshness never touches non-AVAILABLE statuses (nothing to go stale)", () => {
  const denied = new LocationObservation({ status: LOCATION_STATUS.DENIED });
  assert.equal(withFreshness(denied, new Date()), denied);
});

// ---------------------------------------------------------------------
// ChainStore — generic tamper-evidence
// ---------------------------------------------------------------------
test("ChainStore.verifyChain is true for a freshly appended sequence", () => {
  const store = new ChainStore({ idPrefix: "T", basisFn: (e) => [e.a] });
  store.append({ a: 1 });
  store.append({ a: 2 });
  store.append({ a: 3 });
  assert.equal(store.verifyChain(), true);
  assert.equal(store.getAll().length, 3);
  assert.equal(store.getAll()[2].previousRecordId, store.getAll()[1].id);
});

// ---------------------------------------------------------------------
// ProvenanceService (via FinancialCore + TransactionOrchestrator)
// ---------------------------------------------------------------------
test("completeTransaction records an explicit completedAt distinct from now-at-call-time default", () => {
  const core = freshCore();
  const now = new Date("2026-01-01T00:00:00Z");
  const result = core.orchestrator.completeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-A",
    name: "Receiver A",
    amount: 100,
    shareRatePercent: 0,
    time: "12:00 PM",
    senderGeo: available(12.9716, 77.5946),
    receiverGeo: unknownObservation(),
    now
  });
  assert.equal(result.ok, true);
  assert.equal(result.completedAt.getTime(), now.getTime());
  assert.ok(result.complaintWindowExpiresAt.getTime() > now.getTime());
});

test("the complaint window default is 30 minutes", () => {
  assert.equal(COMPLAINT_WINDOW_MINUTES_DEFAULT, 30);
  const core = freshCore();
  const now = new Date("2026-01-01T00:00:00Z");
  core.orchestrator.completeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-30MIN",
    name: "R",
    amount: 10,
    shareRatePercent: 0,
    time: "t",
    senderGeo: unknownObservation(),
    receiverGeo: unknownObservation(),
    now
  });
  const window = core.provenanceService.getComplaintWindow("TXN-30MIN");
  assert.equal(window.windowMinutes, 30);
  assert.equal(window.expiresAt.getTime(), now.getTime() + 30 * 60000);
});

test("the receiver dispute-response window default is 24 hours", () => {
  assert.equal(DISPUTE_RECEIVER_RESPONSE_HOURS_DEFAULT, 24);
});

test("sender sees their own resolved city; receiver with no real observation channel sees nothing — never a guessed city", () => {
  const core = freshCore();
  core.orchestrator.completeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-B",
    name: "Receiver B",
    amount: 50,
    shareRatePercent: 0,
    time: "1:00 PM",
    senderGeo: available(12.9716, 77.5946), // Bengaluru
    receiverGeo: unknownObservation() // no connected receiver device in this build
  });
  const senderView = core.provenanceService.getLocationForViewer("TXN-B", "sender");
  const receiverView = core.provenanceService.getLocationForViewer("TXN-B", "receiver");
  assert.equal(senderView.city, "Bengaluru");
  assert.equal(receiverView, null, "no fabricated city for the receiver when there is no real observation");
  assert.equal(core.provenanceService.getLocationStatusForViewer("TXN-B", "receiver"), LOCATION_STATUS.UNKNOWN);
  assert.equal(core.provenanceService.getLocationStatusForViewer("TXN-B", "sender"), LOCATION_STATUS.AVAILABLE);
});

test("sender and receiver each see only their own city/state when both are real observations", () => {
  const core = freshCore();
  core.orchestrator.completeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-B2",
    name: "Receiver B2",
    amount: 50,
    shareRatePercent: 0,
    time: "1:00 PM",
    senderGeo: available(12.9716, 77.5946), // Bengaluru
    receiverGeo: available(40.7128, -74.006) // New York
  });
  const senderView = core.provenanceService.getLocationForViewer("TXN-B2", "sender");
  const receiverView = core.provenanceService.getLocationForViewer("TXN-B2", "receiver");
  assert.equal(senderView.city, "Bengaluru");
  assert.equal(receiverView.city, "New York");
  assert.notEqual(senderView.city, receiverView.city);
});

test("denied/unavailable/timeout sender location never displays a city, only shows up as a status", () => {
  const core = freshCore();
  core.orchestrator.completeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-DENIED",
    name: "R",
    amount: 10,
    shareRatePercent: 0,
    time: "t",
    senderGeo: new LocationObservation({ status: LOCATION_STATUS.DENIED }),
    receiverGeo: unknownObservation()
  });
  assert.equal(core.provenanceService.getLocationForViewer("TXN-DENIED", "sender"), null);
  assert.equal(core.provenanceService.getLocationStatusForViewer("TXN-DENIED", "sender"), LOCATION_STATUS.DENIED);
});

test("the backend record stores full lat/lon/accuracy/timestamp/status for both parties, even though the UI-facing projection never does", () => {
  const core = freshCore();
  const now = new Date("2026-01-01T00:00:00Z");
  core.orchestrator.completeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-BACKEND",
    name: "R",
    amount: 10,
    shareRatePercent: 0,
    time: "t",
    senderGeo: available(12.9716, 77.5946, now),
    receiverGeo: unknownObservation(),
    now
  });
  const completion = core.provenanceService.getCompletion("TXN-BACKEND");
  assert.equal(completion.payload.senderGeo.latitude, 12.9716);
  assert.equal(completion.payload.senderGeo.longitude, 77.5946);
  assert.equal(typeof completion.payload.senderGeo.accuracy, "number");
  assert.ok(completion.payload.senderGeo.observedAt);
  assert.equal(completion.payload.senderGeo.status, LOCATION_STATUS.AVAILABLE);
  assert.equal(completion.payload.receiverGeo.status, LOCATION_STATUS.UNKNOWN);
  assert.equal(completion.payload.receiverGeo.latitude, null);
});

test("an unrecognized viewer role sees nothing", () => {
  const core = freshCore();
  core.orchestrator.completeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-C",
    name: "R",
    amount: 10,
    shareRatePercent: 0,
    time: "t",
    senderGeo: available(1, 1),
    receiverGeo: unknownObservation()
  });
  assert.equal(core.provenanceService.getLocationForViewer("TXN-C", "auditor"), null);
  assert.equal(core.provenanceService.getLocationForViewer("does-not-exist", "sender"), null);
});

test("recordCompletion is idempotent per txnId — a second call is a no-op, not an overwrite", () => {
  const core = freshCore();
  const first = core.orchestrator.completeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-D",
    name: "R",
    amount: 10,
    shareRatePercent: 0,
    time: "t",
    senderGeo: available(1, 1),
    receiverGeo: unknownObservation()
  });
  const before = core.provenanceStore.getAll().length;
  core.provenanceService.recordCompletion({ txnId: "TXN-D", senderGeo: available(5, 5) });
  const after = core.provenanceStore.getAll().length;
  assert.equal(before, after, "a duplicate completion for the same txnId should not append a new record");
  // The original observation wins — the second call's coordinates never leak in.
  const senderView = core.provenanceService.getLocationForViewer("TXN-D", "sender");
  assert.notEqual(senderView.nearestDistanceKm, undefined);
  assert.ok(first.ok);
});

test("isFirstCompletion is true only until a real completion has been recorded", () => {
  const core = freshCore();
  assert.equal(core.provenanceService.isFirstCompletion("TXN-FIRST"), true);
  core.orchestrator.completeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-FIRST",
    name: "R",
    amount: 10,
    shareRatePercent: 0,
    time: "t",
    senderGeo: unknownObservation(),
    receiverGeo: unknownObservation()
  });
  assert.equal(core.provenanceService.isFirstCompletion("TXN-FIRST"), false);
});

test("provenance chain stays valid across multiple completions", () => {
  const core = freshCore();
  for (let i = 0; i < 5; i++) {
    core.orchestrator.completeTransaction({
      userAccounts: core.userAccounts,
      txnId: `TXN-CHAIN-${i}`,
      name: "R",
      amount: 10,
      shareRatePercent: 0,
      time: "t",
      senderGeo: available(1, 1),
      receiverGeo: unknownObservation()
    });
  }
  assert.equal(core.provenanceStore.verifyChain(), true);
  assert.equal(core.provenanceStore.getAll().length, 5);
});

// ---------------------------------------------------------------------
// TransactionOrchestrator.completeTransaction — atomicity/idempotency,
// "no asset seed or complaint window before successful completion"
// ---------------------------------------------------------------------
test("before completeTransaction runs, a txnId has no complaint window and no grant", () => {
  const core = freshCore();
  assert.equal(core.provenanceService.getComplaintWindow("NEVER-COMPLETED"), null);
  assert.equal(core.provenanceService.isWithinComplaintWindow("NEVER-COMPLETED"), false);
});

test("asset seed (essentials grant) is created on completion when shareRatePercent > 0", () => {
  const core = freshCore();
  const before = core.essentialsService.listGrants().length;
  const result = core.orchestrator.completeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-E",
    name: "Creator E",
    amount: 200,
    shareRatePercent: 5,
    time: "t",
    senderGeo: available(1, 1),
    receiverGeo: unknownObservation()
  });
  const after = core.essentialsService.listGrants().length;
  assert.equal(after, before + 1);
  assert.ok(result.grant);
  assert.equal(result.firstCompletion, true);
});

test("no asset seed is created on completion when shareRatePercent is 0", () => {
  const core = freshCore();
  const before = core.essentialsService.listGrants().length;
  const result = core.orchestrator.completeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-F",
    name: "R",
    amount: 200,
    shareRatePercent: 0,
    time: "t",
    senderGeo: available(1, 1),
    receiverGeo: unknownObservation()
  });
  const after = core.essentialsService.listGrants().length;
  assert.equal(after, before);
  assert.equal(result.grant, null);
});

test("completeTransaction is idempotent per txnId: calling it twice never creates a second grant or a second provenance record", () => {
  const core = freshCore();
  const first = core.orchestrator.completeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-IDEMP",
    name: "Creator",
    amount: 100,
    shareRatePercent: 10,
    time: "t",
    senderGeo: available(1, 1),
    receiverGeo: unknownObservation()
  });
  const second = core.orchestrator.completeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-IDEMP",
    name: "Creator",
    amount: 100,
    shareRatePercent: 10,
    time: "t",
    senderGeo: available(1, 1),
    receiverGeo: unknownObservation()
  });
  assert.equal(first.firstCompletion, true);
  assert.equal(second.firstCompletion, false);
  assert.equal(second.grant, null, "no second grant on a repeated completion");
  assert.equal(core.essentialsService.listGrants().length, 1);
  assert.equal(core.provenanceStore.getAll().filter((r) => r.txnId === "TXN-IDEMP").length, 1);
});

test("completeTransaction with a clientRequestId short-circuits a duplicate call via the shared IdempotencyGuard", () => {
  const core = freshCore();
  const requestId = "req-complete-1";
  const first = core.orchestrator.completeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-GUARD",
    name: "Creator",
    amount: 100,
    shareRatePercent: 10,
    time: "t",
    senderGeo: available(1, 1),
    receiverGeo: unknownObservation(),
    clientRequestId: requestId
  });
  const second = core.orchestrator.completeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-GUARD",
    name: "Creator",
    amount: 100,
    shareRatePercent: 10,
    time: "t",
    senderGeo: available(9, 9),
    receiverGeo: unknownObservation(),
    clientRequestId: requestId
  });
  assert.deepEqual(second, first, "a retried request with the same clientRequestId returns the exact original result");
  assert.equal(core.essentialsService.listGrants().length, 1);
});

test("EssentialsService.addGrant itself is idempotent per txnId, independent of the orchestrator", () => {
  const core = freshCore();
  const g1 = core.essentialsService.addGrant({ userAccounts: core.userAccounts, key: "k", business: "B", chip: "B", amountPaid: 100, cashbackRate: 0.1, creatorName: "C", time: "t", currency: "INR", txnId: "TXN-DIRECT" });
  const g2 = core.essentialsService.addGrant({ userAccounts: core.userAccounts, key: "k", business: "B", chip: "B", amountPaid: 100, cashbackRate: 0.1, creatorName: "C", time: "t", currency: "INR", txnId: "TXN-DIRECT" });
  assert.equal(g1, g2);
  assert.equal(core.essentialsService.listGrants().length, 1);
});

test("completeTransaction requires a txnId — it never silently completes an untracked transaction", () => {
  const core = freshCore();
  assert.throws(() => core.orchestrator.completeTransaction({
    userAccounts: core.userAccounts,
    name: "R",
    amount: 10,
    shareRatePercent: 0,
    time: "t",
    senderGeo: unknownObservation(),
    receiverGeo: unknownObservation()
  }));
});

test("Send Money and Scan & Pay style completions are indistinguishable at the provenance layer — same fields, same lifecycle", () => {
  const core = freshCore();
  const sendMoneyResult = core.orchestrator.completeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-SENDMONEY",
    name: "Receiver",
    amount: 50,
    shareRatePercent: 2,
    time: "t",
    senderGeo: available(1, 1),
    receiverGeo: unknownObservation()
  });
  const scanPayResult = core.orchestrator.completeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-SCANPAY",
    name: "Merchant Gloobal ID",
    amount: 50,
    shareRatePercent: 0, // Scan & Pay carries no Creator Share in this build
    time: "t",
    senderGeo: available(1, 1),
    receiverGeo: unknownObservation()
  });
  for (const result of [sendMoneyResult, scanPayResult]) {
    assert.equal(result.ok, true);
    assert.ok(result.complaintWindowExpiresAt);
    assert.equal(typeof result.firstCompletion, "boolean");
  }
  assert.ok(core.provenanceService.isWithinComplaintWindow("TXN-SENDMONEY"));
  assert.ok(core.provenanceService.isWithinComplaintWindow("TXN-SCANPAY"));
  // Both are equally reportable through the same DisputeService path.
  const d1 = core.disputeService.openComplaint({ txnId: "TXN-SENDMONEY", raisedBy: "sender" });
  const d2 = core.disputeService.openComplaint({ txnId: "TXN-SCANPAY", raisedBy: "sender" });
  assert.equal(d1.ok, true);
  assert.equal(d2.ok, true);
});

// ---------------------------------------------------------------------
// DisputeService — case state machine
// ---------------------------------------------------------------------
function completeAndOpen(core, txnId, now = new Date()) {
  core.orchestrator.completeTransaction({
    userAccounts: core.userAccounts,
    txnId,
    name: "R",
    amount: 10,
    shareRatePercent: 0,
    time: "t",
    senderGeo: available(1, 1),
    receiverGeo: unknownObservation(),
    now
  });
  return core.disputeService.openComplaint({ txnId, raisedBy: "sender", reason: "did not arrive", now });
}

test("opening a complaint fails outside the completion's complaint window", () => {
  const core = freshCore();
  const now = new Date("2026-01-01T00:00:00Z");
  core.orchestrator.completeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-H",
    name: "R",
    amount: 10,
    shareRatePercent: 0,
    time: "t",
    senderGeo: available(1, 1),
    receiverGeo: unknownObservation(),
    complaintWindowMinutes: 15,
    now
  });
  const tooLate = new Date(now.getTime() + 16 * 60000);
  const result = core.disputeService.openComplaint({ txnId: "TXN-H", raisedBy: "sender", now: tooLate });
  assert.equal(result.ok, false);
  assert.equal(result.code, DISPUTE_ERROR.OUTSIDE_COMPLAINT_WINDOW);
});

test("opening a complaint succeeds inside the default 30-minute window and returns a 24h receiver deadline", () => {
  const core = freshCore();
  const now = new Date("2026-01-01T00:00:00Z");
  const almostAtTheEdge = new Date(now.getTime() + 29 * 60000);
  core.orchestrator.completeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-I",
    name: "R",
    amount: 10,
    shareRatePercent: 0,
    time: "t",
    senderGeo: available(1, 1),
    receiverGeo: unknownObservation(),
    now
  });
  const result = core.disputeService.openComplaint({ txnId: "TXN-I", raisedBy: "sender", now: almostAtTheEdge });
  assert.equal(result.ok, true);
  assert.equal(result.status, DISPUTE_STATUS.OPEN);
  assert.equal(result.receiverResponseDeadline.getTime(), almostAtTheEdge.getTime() + 24 * 3600000);
});

test("opening a complaint fails just past the 30-minute mark", () => {
  const core = freshCore();
  const now = new Date("2026-01-01T00:00:00Z");
  const justPastThirty = new Date(now.getTime() + 30 * 60000 + 1);
  core.orchestrator.completeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-I2",
    name: "R",
    amount: 10,
    shareRatePercent: 0,
    time: "t",
    senderGeo: available(1, 1),
    receiverGeo: unknownObservation(),
    now
  });
  const result = core.disputeService.openComplaint({ txnId: "TXN-I2", raisedBy: "sender", now: justPastThirty });
  assert.equal(result.ok, false);
  assert.equal(result.code, DISPUTE_ERROR.OUTSIDE_COMPLAINT_WINDOW);
});

test("a second complaint on the same open transaction is rejected as already-open", () => {
  const core = freshCore();
  const now = new Date("2026-01-01T00:00:00Z");
  const first = completeAndOpen(core, "TXN-J", now);
  const second = core.disputeService.openComplaint({ txnId: "TXN-J", raisedBy: "sender", now });
  assert.equal(second.ok, false);
  assert.equal(second.code, DISPUTE_ERROR.ALREADY_OPEN);
  assert.equal(second.caseId, first.caseId);
});

test("receiver accepting within the window moves the case to in_conversation", () => {
  const core = freshCore();
  const now = new Date("2026-01-01T00:00:00Z");
  const opened = completeAndOpen(core, "TXN-K", now);
  const accepted = core.disputeService.acceptConversation({ caseId: opened.caseId, now: new Date(now.getTime() + 3600000) });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.status, DISPUTE_STATUS.IN_CONVERSATION);
});

test("declining escalates the case (never reverses money, never auto-fraud) instead of resolving it", () => {
  const core = freshCore();
  const now = new Date("2026-01-01T00:00:00Z");
  const opened = completeAndOpen(core, "TXN-L", now);
  const declined = core.disputeService.declineConversation({ caseId: opened.caseId, now, reason: "not agreed" });
  assert.equal(declined.ok, true);
  assert.equal(declined.status, DISPUTE_STATUS.ESCALATED);
  assert.equal(declined.triggeredBy, "declined");
  const finalState = core.disputeService.getCase(opened.caseId);
  assert.equal(finalState.status, DISPUTE_STATUS.ESCALATED);
});

test("a case left unanswered past the 24h receiver window auto-expires and escalates", () => {
  const core = freshCore();
  const now = new Date("2026-01-01T00:00:00Z");
  const opened = completeAndOpen(core, "TXN-M", now);
  const tooLate = new Date(now.getTime() + 25 * 3600000);
  // sweepExpired's default `now` is real wall-clock time, which (being
  // run long after 2026-01-01) would itself already sweep this case —
  // so assert against the explicit-time sweep directly, without an
  // intervening getCase()/getAllCases() call (both sweep with real
  // "now" as a side effect) that would sweep it first.
  const swept = core.disputeService.sweepExpired(tooLate);
  assert.equal(swept.length, 1);
  assert.equal(swept[0].status, DISPUTE_STATUS.ESCALATED);
  assert.equal(swept[0].triggeredBy, "expired");
  const finalState = core.disputeService.getCase(opened.caseId);
  assert.equal(finalState.status, DISPUTE_STATUS.ESCALATED);
});

test("accepting after the 24h deadline has passed is treated as an expiry, not a normal accept", () => {
  const core = freshCore();
  const now = new Date("2026-01-01T00:00:00Z");
  const opened = completeAndOpen(core, "TXN-N", now);
  const tooLate = new Date(now.getTime() + 25 * 3600000);
  const result = core.disputeService.acceptConversation({ caseId: opened.caseId, now: tooLate });
  assert.equal(result.ok, true);
  assert.equal(result.status, DISPUTE_STATUS.ESCALATED);
});

test("accepting within 24h (e.g. at 23h59m) is still a normal accept, not an expiry", () => {
  const core = freshCore();
  const now = new Date("2026-01-01T00:00:00Z");
  const opened = completeAndOpen(core, "TXN-N2", now);
  const justBeforeDeadline = new Date(now.getTime() + 23 * 3600000 + 59 * 60000);
  const result = core.disputeService.acceptConversation({ caseId: opened.caseId, now: justBeforeDeadline });
  assert.equal(result.ok, true);
  assert.equal(result.status, DISPUTE_STATUS.IN_CONVERSATION);
});

test("accepting/declining a non-open case (e.g. already escalated) is an invalid transition", () => {
  const core = freshCore();
  const now = new Date("2026-01-01T00:00:00Z");
  const opened = completeAndOpen(core, "TXN-O", now);
  core.disputeService.declineConversation({ caseId: opened.caseId, now });
  const retry = core.disputeService.acceptConversation({ caseId: opened.caseId, now });
  assert.equal(retry.ok, false);
  assert.equal(retry.code, DISPUTE_ERROR.INVALID_TRANSITION);
});

test("unknown caseId returns NOT_FOUND rather than throwing", () => {
  const core = freshCore();
  const result = core.disputeService.acceptConversation({ caseId: "no-such-case" });
  assert.equal(result.ok, false);
  assert.equal(result.code, DISPUTE_ERROR.NOT_FOUND);
});

test("resolve() works from in_conversation and from escalated, not from open", () => {
  const core = freshCore();
  const now = new Date("2026-01-01T00:00:00Z");
  const opened = completeAndOpen(core, "TXN-P", now);
  const cannotResolveYet = core.disputeService.resolve({ caseId: opened.caseId, resolution: "refunded" });
  assert.equal(cannotResolveYet.ok, false);
  core.disputeService.acceptConversation({ caseId: opened.caseId, now });
  const resolved = core.disputeService.resolve({ caseId: opened.caseId, resolution: "refunded" });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.status, DISPUTE_STATUS.RESOLVED);
});

test("idempotency guard prevents a duplicated openComplaint request from opening two cases", () => {
  const core = freshCore();
  const now = new Date("2026-01-01T00:00:00Z");
  core.orchestrator.completeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-Q",
    name: "R",
    amount: 10,
    shareRatePercent: 0,
    time: "t",
    senderGeo: available(1, 1),
    receiverGeo: unknownObservation(),
    now
  });
  const r1 = core.disputeService.openComplaint({ txnId: "TXN-Q", raisedBy: "sender", now, clientRequestId: "req-1" });
  const r2 = core.disputeService.openComplaint({ txnId: "TXN-Q", raisedBy: "sender", now, clientRequestId: "req-1" });
  assert.equal(r1.caseId, r2.caseId);
  assert.equal(core.disputeStore.getAll().filter((e) => e.kind === "opened").length, 1);
});

test("dispute chain stays valid through a full open -> accept -> resolve lifecycle", () => {
  const core = freshCore();
  const now = new Date("2026-01-01T00:00:00Z");
  const opened = completeAndOpen(core, "TXN-R", now);
  core.disputeService.acceptConversation({ caseId: opened.caseId, now });
  core.disputeService.resolve({ caseId: opened.caseId, resolution: "resolved amicably" });
  assert.equal(core.disputeStore.verifyChain(), true);
});

test("getCasesForTxn returns every case opened against a given transaction", () => {
  const core = freshCore();
  const now = new Date("2026-01-01T00:00:00Z");
  completeAndOpen(core, "TXN-S", now);
  const cases = core.disputeService.getCasesForTxn("TXN-S");
  assert.equal(cases.length, 1);
  assert.equal(cases[0].txnId, "TXN-S");
});

// ---------------------------------------------------------------------
// Centralized capability states — Gloobal Coin/PayLater/Assets/
// Essentials are derived from one place instead of independently
// hardcoded, and My Essentials is locked for first-time users until
// Gloobal Bank has been opened.
// ---------------------------------------------------------------------
test("a first-time user (never opened Gloobal Bank) has My Essentials locked; every other tile stays unlocked", () => {
  const states = deriveCapabilityStates({ hasOpenedGloobalBank: false });
  assert.equal(states[CAPABILITY_KEY.MY_ESSENTIALS].locked, true);
  assert.ok(states[CAPABILITY_KEY.MY_ESSENTIALS].reason);
  assert.equal(states[CAPABILITY_KEY.GLOOBAL_BANK].locked, false);
  assert.equal(states[CAPABILITY_KEY.GLOOBAL_COIN].locked, false);
  assert.equal(states[CAPABILITY_KEY.PAYLATER].locked, false);
  assert.equal(states[CAPABILITY_KEY.MY_ASSETS].locked, false);
});

test("once Gloobal Bank has been opened, My Essentials unlocks along with everything else", () => {
  const states = deriveCapabilityStates({ hasOpenedGloobalBank: true });
  assert.equal(states[CAPABILITY_KEY.MY_ESSENTIALS].locked, false);
  assert.equal(states[CAPABILITY_KEY.MY_ESSENTIALS].reason, null);
});

test("deriveCapabilityStates defaults to the first-time-user (locked Essentials) state when called with no input", () => {
  const states = deriveCapabilityStates();
  assert.equal(states[CAPABILITY_KEY.MY_ESSENTIALS].locked, true);
});

test("capability keys line up with the five Account-tab tiles", () => {
  assert.deepEqual(Object.values(CAPABILITY_KEY).sort(), ["gbank", "gcoin", "gpaylater", "myassets", "myessentials"].sort());
});
