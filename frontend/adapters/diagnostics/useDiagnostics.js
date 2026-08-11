// src/adapters/diagnostics/useDiagnostics.js
import { useCallback as useCallback4, useMemo as useMemo9, useState as useState17, useSyncExternalStore as useSyncExternalStore2 } from "react";


// src/adapters/diagnostics/useDiagnostics.js
function useDiagnostics() {
  const core = useFinancialCore();
  const subscribe = useCallback4((onChange) => core.ledgerEngine.subscribe(onChange), [core]);
  const getSnapshot = useCallback4(() => core.store.getAll().length, [core]);
  const version = useSyncExternalStore2(subscribe, getSnapshot);
  return useMemo9(() => getDiagnosticsSnapshot(core), [core, version]);
}
function useLedgerTimeline() {
  const core = useFinancialCore();
  const subscribe = useCallback4((onChange) => core.ledgerEngine.subscribe(onChange), [core]);
  const getSnapshot = useCallback4(() => core.store.getAll().length, [core]);
  const version = useSyncExternalStore2(subscribe, getSnapshot);
  return useMemo9(() => buildTimeline(core), [core, version]);
}
function useReplayCheck() {
  const core = useFinancialCore();
  const [result, setResult] = useState17(null);
  const [running, setRunning] = useState17(false);
  const run = useCallback4(() => {
    setRunning(true);
    Promise.resolve().then(() => {
      setResult(replayIntoFreshStore(core));
      setRunning(false);
    });
  }, [core]);
  return { result, running, run };
}
function useStressTest() {
  const [report, setReport] = useState17(null);
  const [running, setRunning] = useState17(false);
  const [error, setError] = useState17(null);
  const run = useCallback4((opts) => {
    setRunning(true);
    setError(null);
    runFullStressTest(opts).then((r) => setReport(r)).catch((err) => setError(err.message || String(err))).finally(() => setRunning(false));
  }, []);
  return { report, running, error, run };
}

