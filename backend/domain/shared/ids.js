// src/domain/shared/ids.js
var sequenceCounter = 0;
function nextSequence() {
  sequenceCounter += 1;
  return sequenceCounter;
}
function genLedgerRecordId() {
  return `LR-${Date.now().toString(36)}-${nextSequence().toString(36)}`;
}
function genJournalEntryId() {
  return `JE-${Date.now().toString(36)}-${nextSequence().toString(36)}`;
}
function genSettlementBatchId() {
  return `STL-${Date.now().toString(36)}-${nextSequence().toString(36)}`;
}
function genProvenanceRecordId() {
  return `PR-${Date.now().toString(36)}-${nextSequence().toString(36)}`;
}
function genDisputeCaseId() {
  return `DC-${Date.now().toString(36)}-${nextSequence().toString(36)}`;
}
function genDisputeEventId() {
  return `DE-${Date.now().toString(36)}-${nextSequence().toString(36)}`;
}

