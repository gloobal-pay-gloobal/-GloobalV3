// src/services/storage/coverageStorage.js
var inMemoryCoverageCountry = null;
function loadStoredCoverageCountry() {
  return inMemoryCoverageCountry;
}
function saveStoredCoverageCountry(code) {
  inMemoryCoverageCountry = code;
}

