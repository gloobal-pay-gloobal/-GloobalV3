// src/features/history/TransactionHistoryScreen.jsx
import { useState as useState12, useEffect as useEffect11, useRef as useRef9 } from "react";


// src/features/history/TransactionHistoryScreen.jsx
// One toggle only: the parent (History header, in the Account/Profile
// screen) owns historyTab/historyMethodFilter and renders the actual
// Received/Paid buttons — this component just consumes that state via
// props instead of keeping its own separate copy (which used to render
// a second, redundant Receiving/Sending pill directly underneath the
// header's Received/Paid buttons).
function TransactionHistoryScreen({ isActive, sendHistory, receiveHistory = [], dialCountry, ccy, openHistoryDirection, onConsumeOpenHistory, historyTab, setHistoryTab, historyMethodFilter, setHistoryMethodFilter }) {
  const historyScrollRef = useRef9(null);
  const [receipt, setReceipt] = useState12(null);
  const requestCloseReceipt = useBackClose(!!receipt, () => setReceipt(null));
  const routedHistoryRef = useRef9(false);
  // Today / This Week / This Month. Everything below — the two summary
  // tiles, the daily chart and both sides of the pager — reads the same
  // filtered rows, so the period is one choice rather than three
  // separately-scoped views that can disagree with each other.
  const [historyPeriod, setHistoryPeriod] = useState12("week");
  useEffect11(() => {
    if (isActive) {
      if (routedHistoryRef.current) {
        routedHistoryRef.current = false;
      } else {
        setHistoryTab("receiving");
        setHistoryMethodFilter("all");
        setHistoryPeriod("week");
        if (historyScrollRef.current) historyScrollRef.current.scrollLeft = 0;
      }
    }
  }, [isActive]);
  useEffect11(() => {
    if (openHistoryDirection) {
      routedHistoryRef.current = true;
      setHistoryTab(openHistoryDirection);
      setHistoryMethodFilter("all");
      requestAnimationFrame(() => {
        if (historyScrollRef.current) {
          historyScrollRef.current.scrollLeft = openHistoryDirection === "sending" ? historyScrollRef.current.clientWidth : 0;
        }
      });
      if (onConsumeOpenHistory) onConsumeOpenHistory();
    }
  }, [openHistoryDirection]);
  // The header's Received/Paid buttons (the single source of truth for
  // historyTab now) only set state — this keeps the swipeable pager
  // scrolled to match, from any source (header tap or a fresh mount),
  // without fighting the scroll-driven handleHistoryScroll -> setHistoryTab
  // direction below (the small distance check skips a redundant
  // re-scroll while the user is actively swiping).
  useEffect11(() => {
    const el = historyScrollRef.current;
    if (!el) return;
    const target = historyTab === "sending" ? el.clientWidth : 0;
    if (Math.abs(el.scrollLeft - target) > 2) {
      el.scrollTo({ left: target, behavior: "smooth" });
    }
  }, [historyTab]);
  function openHistoryReceipt(t, direction) {
    setReceipt(buildHistoryReceipt(t, direction, dialCountry, ccy));
  }
  function handleHistoryScroll(e) {
    const el = e.currentTarget;
    const idx = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    setHistoryTab(idx === 0 ? "receiving" : "sending");
  }
  // Everything on this screen is scoped to the selected period.
  const periodSendHistory = useMemo5(() => filterHistoryByPeriod(sendHistory, historyPeriod), [sendHistory, historyPeriod]);
  const periodReceiveHistory = useMemo5(() => filterHistoryByPeriod(receiveHistory, historyPeriod), [receiveHistory, historyPeriod]);
  // Daily trend for this history's own data — same day-by-day
  // paid/received bar chart the wallet card uses, so "what does my
  // typical day look like" is answerable from inside History too,
  // not only from the Dashboard's headline chart. The page count
  // follows the period so a month's worth of days isn't cut off at
  // two weeks.
  const historyDailyTrend = useMemo5(
    () => generateDailySpending(periodSendHistory, periodReceiveHistory, historyPeriodMeta(historyPeriod).weekPages),
    [periodSendHistory, periodReceiveHistory, historyPeriod]
  );
  const periodPaidTotal = useMemo5(() => sumHistoryAmount(periodSendHistory), [periodSendHistory]);
  const periodReceivedTotal = useMemo5(() => sumHistoryAmount(periodReceiveHistory), [periodReceiveHistory]);
  return <div><style>{`.history-pager::-webkit-scrollbar { display: none; }`}</style>{
    /* Period tabs — the outermost filter on this screen. The chart and
       both pager panels below are built from the rows these leave in,
       so the tab, the two totals and the list can never describe
       different spans of time. */
  }<div style={{ display: "flex", gap: 6, marginBottom: 12 }}>{HISTORY_PERIODS.map((p) => <button
    key={p.key}
    onClick={() => setHistoryPeriod(p.key)}
    aria-pressed={historyPeriod === p.key}
    className="v2-tap"
    style={{
      flex: 1,
      border: "none",
      borderRadius: 999,
      padding: "9px 0",
      cursor: "pointer",
      fontSize: 12,
      fontWeight: 800,
      background: historyPeriod === p.key ? T.accentSoft : T.surfaceAlt,
      color: historyPeriod === p.key ? T.accent : T.inkFaint,
      transition: "background 0.2s ease, color 0.2s ease"
    }}
  >{p.label}</button>)}</div>{
    /* Received / Paid for the selected period. These used to be a
       lifetime figure sitting above a filtered list, which is how a
       period with no activity in it still showed somebody else's
       number. Both are summed from the same filtered rows the list
       renders. */
  }<div style={{ display: "flex", gap: 10, marginBottom: 14 }}>{[
    { key: "received", label: "Received", sign: "+", value: periodReceivedTotal, color: T.positive, chip: T.positiveSoft },
    { key: "paid", label: "Paid", sign: "−", value: periodPaidTotal, color: T.accent, chip: T.accentSoft }
  ].map((tile) => <div
    key={tile.key}
    style={{ flex: 1, minWidth: 0, borderRadius: T.radiusLg, background: tile.chip, padding: "12px 14px" }}
  ><div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.3, textTransform: "uppercase", color: T.inkSoft }}>{tile.label}</div><div style={{ fontSize: 17, fontWeight: 800, color: tile.color, fontFamily: T.fontDisplay, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tile.sign}{ccy}{tile.value.toFixed(2)}</div></div>)}</div>{
    /* Daily trend — same DailySpendingChart the wallet card uses,
       scoped to just this history's data, giving a quick "average
       day vs a bigger day" read before scrolling the list below. */
  }<div style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, padding: "16px 18px", marginBottom: 14 }}><DailySpendingChart weeks={historyDailyTrend.weeks} totals={historyDailyTrend.totals} symbol={ccy} focusDirection={historyTab === "sending" ? "paid" : "received"} palette="light" /></div>{
    /* Method filter — All / Bank / PayLater / Coin, applied to
       whichever panel (Receiving/Sending) is currently active. The
       Received/Paid direction toggle itself lives in the header
       above (see profileDetail === "History"), not duplicated here. */
  }<div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12, paddingBottom: 2 }}>{["all", "bank", "paylater", "coin"].map((m) => <button
    key={m}
    onClick={() => setHistoryMethodFilter(m)}
    className="v2-tap"
    style={{
      flexShrink: 0,
      border: `1.5px solid ${historyMethodFilter === m ? T.accent : T.line}`,
      borderRadius: 999,
      padding: "6px 13px",
      fontSize: 11.5,
      fontWeight: 700,
      cursor: "pointer",
      color: historyMethodFilter === m ? T.accent : T.inkSoft,
      background: historyMethodFilter === m ? T.accentSoft : "none"
    }}
  >{m === "all" ? "All" : HISTORY_METHOD_META[m].label}</button>)}</div>{
    /* Swipeable pager — Receiving panel first, Sending panel to its
       right; scroll-snap gives a native swipe-right gesture between
       them, synced to the header's Received/Paid toggle via the
       shared historyTab state (scrollHistoryTo / handleHistoryScroll
       keep the two in sync in both directions). */
  }<div
    ref={historyScrollRef}
    onScroll={handleHistoryScroll}
    style={{
      display: "flex",
      overflowX: "auto",
      scrollSnapType: "x mandatory",
      WebkitOverflowScrolling: "touch",
      borderRadius: T.radiusLg,
      scrollbarWidth: "none"
    }}
    className="history-pager"
  >{[
    { key: "receiving", rows: periodReceiveHistory, sign: "+", color: T.positive, chip: T.positiveSoft },
    { key: "sending", rows: periodSendHistory, sign: "\u2212", color: T.accent, chip: T.accentSoft }
  ].map((col) => {
    const filteredRows = historyMethodFilter === "all" ? col.rows : col.rows.filter((t) => t.method === historyMethodFilter);
    return <div key={col.key} style={{ flex: "0 0 100%", scrollSnapAlign: "start", minWidth: 0 }}><div style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, overflow: "hidden" }}>{filteredRows.length === 0 ? <div style={{ padding: "20px 16px", textAlign: "center", fontSize: 12, color: T.inkFaint }}>Nothing {historyPeriodMeta(historyPeriod).emptyLabel}</div> : filteredRows.map((t, i) => <TransactionRow
      // txnId first: the received list is now two sources merged (Creator
      // Share grants and real incoming payments), so name+date alone can
      // repeat across them and React would treat two distinct rows as one.
      key={t.txnId || `${t.name}-${t.date}-${i}`}
      t={t}
      chip={col.chip}
      color={col.color}
      sign={col.sign}
      ccy={ccy}
      isFirst={i === 0}
      onSelect={() => openHistoryReceipt(t, col.key === "sending" ? "sent" : "received")}
    />)}</div></div>;
  })}</div><ReceiptModal receipt={receipt} onClose={requestCloseReceipt} /></div>;
}

