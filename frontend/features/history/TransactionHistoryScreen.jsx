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
  useEffect11(() => {
    if (isActive) {
      if (routedHistoryRef.current) {
        routedHistoryRef.current = false;
      } else {
        setHistoryTab("receiving");
        setHistoryMethodFilter("all");
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
  // Daily trend for this history's own data — same day-by-day
  // paid/received bar chart the wallet card uses, so "what does my
  // typical day look like" is answerable from inside History too,
  // not only from the Dashboard's headline chart.
  const historyDailyTrend = useMemo5(() => generateDailySpending(sendHistory, receiveHistory), [sendHistory, receiveHistory]);
  return <div><style>{`.history-pager::-webkit-scrollbar { display: none; }`}</style>{
    /* Daily trend — same DailySpendingChart the wallet card uses,
       scoped to just this history's data, giving a quick "average
       day vs a bigger day" read before scrolling the list below. */
  }<div style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, padding: "16px 18px", marginBottom: 14 }}><DailySpendingChart weeks={historyDailyTrend.weeks} totals={historyDailyTrend.totals} symbol={ccy} focusDirection={historyTab === "sending" ? "paid" : "received"} /></div>{
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
    { key: "receiving", rows: receiveHistory, sign: "+", color: T.positive, chip: T.positiveSoft },
    { key: "sending", rows: sendHistory, sign: "\u2212", color: T.accent, chip: T.accentSoft }
  ].map((col) => {
    const filteredRows = historyMethodFilter === "all" ? col.rows : col.rows.filter((t) => t.method === historyMethodFilter);
    return <div key={col.key} style={{ flex: "0 0 100%", scrollSnapAlign: "start", minWidth: 0 }}><div style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, overflow: "hidden" }}>{filteredRows.length === 0 ? <div style={{ padding: "20px 16px", textAlign: "center", fontSize: 12, color: T.inkFaint }}>Nothing yet</div> : filteredRows.map((t, i) => <TransactionRow
      key={`${t.name}-${t.date}`}
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

