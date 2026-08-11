// src/domain/accounts/entities/ReserveAccount.js
function createReserveAccount(currency = "INR") {
  return new LedgerAccount({
    id: `platform:reserve:${currency}`,
    type: ACCOUNT_TYPE.LIABILITY,
    // platform holds it in trust, owes it onward
    name: "Platform Reserve / Clearing",
    currency
  });
}

