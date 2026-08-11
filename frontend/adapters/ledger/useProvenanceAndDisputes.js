// src/adapters/ledger/useProvenanceAndDisputes.js
import { useCallback as useCallbackProv, useSyncExternalStore as useSyncExternalStoreProv } from "react";
function useProvenanceVersion() {
  const core = useFinancialCore();
  const subscribe = useCallbackProv((onChange) => core.provenanceStore.subscribe(onChange), [core]);
  const getSnapshot = useCallbackProv(() => core.provenanceStore.getAll().length, [core]);
  return useSyncExternalStoreProv(subscribe, getSnapshot);
}
function useDisputeVersion() {
  const core = useFinancialCore();
  const subscribe = useCallbackProv((onChange) => core.disputeStore.subscribe(onChange), [core]);
  const getSnapshot = useCallbackProv(() => core.disputeStore.getAll().length, [core]);
  return useSyncExternalStoreProv(subscribe, getSnapshot);
}
// Exposes location/dispute reads and the location-observation
// submission channel. userId is this device's own identity, used only
// to resolve which side ("sender" | "receiver") of a given txnId the
// current viewer is on, so location/case reads never leak the other
// party's details. Note there's no completeTransaction here anymore —
// completion is folded into useTransactionActions().executeTransaction,
// the one canonical lifecycle entry point.
function useProvenanceAndDisputes() {
  const core = useFinancialCore();
  const { provenanceService, disputeService } = core;
  useProvenanceVersion();
  useDisputeVersion();
  const getLocationForViewer = useCallbackProv((txnId, viewerRole) => provenanceService.getLocationForViewer(txnId, viewerRole), [provenanceService]);
  const getLocationStatusForViewer = useCallbackProv((txnId, viewerRole) => provenanceService.getLocationStatusForViewer(txnId, viewerRole), [provenanceService]);
  // The real location-observation submission interface: a device
  // (sender's own, or — once a receiver client exists — the
  // receiver's own) reports its own observation against a txnId,
  // independent of and never blocking transaction completion. Safe to
  // call before completion, after it, or more than once.
  const submitLocationObservation = useCallbackProv(
    ({ txnId, role, observation, clientRequestId }) => provenanceService.submitLocationObservation({ txnId, role, observation, clientRequestId }),
    [provenanceService]
  );
  const getComplaintWindow = useCallbackProv((txnId) => provenanceService.getComplaintWindow(txnId), [provenanceService]);
  const isWithinComplaintWindow = useCallbackProv((txnId, now) => provenanceService.isWithinComplaintWindow(txnId, now), [provenanceService]);
  const openComplaint = useCallbackProv(({ txnId, raisedBy, reason, clientRequestId }) => disputeService.openComplaint({ txnId, raisedBy, reason, clientRequestId }), [disputeService]);
  const acceptConversation = useCallbackProv((caseId) => disputeService.acceptConversation({ caseId }), [disputeService]);
  const declineConversation = useCallbackProv((caseId, reason) => disputeService.declineConversation({ caseId, reason }), [disputeService]);
  const resolveCase = useCallbackProv((caseId, resolution) => disputeService.resolve({ caseId, resolution }), [disputeService]);
  const sweepExpiredDisputes = useCallbackProv(() => disputeService.sweepExpired(), [disputeService]);
  const getCasesForTxn = useCallbackProv((txnId) => disputeService.getCasesForTxn(txnId), [disputeService]);
  const getAllCases = useCallbackProv(() => disputeService.getAllCases(), [disputeService]);
  return {
    getLocationForViewer,
    getLocationStatusForViewer,
    submitLocationObservation,
    getComplaintWindow,
    isWithinComplaintWindow,
    openComplaint,
    acceptConversation,
    declineConversation,
    resolveCase,
    sweepExpiredDisputes,
    getCasesForTxn,
    getAllCases
  };
}

