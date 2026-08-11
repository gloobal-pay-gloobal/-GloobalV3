// src/adapters/ledger/LedgerProvider.jsx
import { createContext, useContext, useRef } from "react";


// src/adapters/ledger/LedgerProvider.jsx
var LedgerContext = createContext(null);
function LedgerProvider({ children, userId = "demo-user", currency = "INR", openingBankBalance = 5e3 }) {
  const coreRef = useRef(null);
  if (coreRef.current === null) {
    coreRef.current = createFinancialCore({ userId, currency, openingBankBalance });
  }
  return <LedgerContext.Provider value={coreRef.current}>{children}</LedgerContext.Provider>;
}
function useFinancialCore() {
  const core = useContext(LedgerContext);
  if (!core) throw new Error("useFinancialCore must be used within a <LedgerProvider>");
  return core;
}

