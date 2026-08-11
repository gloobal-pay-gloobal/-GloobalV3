// src/domain/settlement/entities/SettlementState.js
var SettlementState = Object.freeze({
  PENDING: "pending",
  SETTLED: "settled",
  FAILED: "failed"
});
var VALID_TRANSITIONS = {
  [SettlementState.PENDING]: [SettlementState.SETTLED, SettlementState.FAILED],
  [SettlementState.SETTLED]: [],
  [SettlementState.FAILED]: []
};
function canTransition(from, to) {
  return (VALID_TRANSITIONS[from] || []).includes(to);
}

