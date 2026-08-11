// src/domain/provenance/ProvenanceStore.js
function createProvenanceStore() {
  return new ChainStore({ idPrefix: "PR", basisFn: (e) => [e.txnId, e.kind] });
}

