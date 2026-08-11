// src/domain/disputes/DisputeStore.js
function createDisputeStore() {
  return new ChainStore({ idPrefix: "DE", basisFn: (e) => [e.caseId, e.kind] });
}

