// src/features/history/TransactionRow.jsx
function TransactionRow({ t, chip, color, sign, ccy, isFirst, onSelect }) {
  const meta = HISTORY_METHOD_META[t.method];
  const MethodIcon = meta?.icon;
  return <div
    onClick={onSelect}
    className="v2-tap"
    role="button"
    tabIndex={0}
    aria-label={`View receipt for ${t.name}, ${t.date}`}
    style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderTop: isFirst ? "none" : `1px solid ${T.line}`, cursor: "pointer" }}
  ><span
    style={{
      width: 36,
      height: 36,
      borderRadius: 11,
      flexShrink: 0,
      background: chip,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 17
    }}
  >{t.flag}</span><span style={{ flex: 1, minWidth: 0 }}><span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span><span style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}><span style={{ fontSize: 11, color: T.inkFaint }}>{t.date}</span>{meta && <span style={{ display: "flex", alignItems: "center", gap: 3, background: T.surfaceAlt, borderRadius: 999, padding: "1.5px 7px 1.5px 5px" }}><MethodIcon size={10} color={T.inkSoft} /><span style={{ fontSize: 9.5, fontWeight: 700, color: T.inkSoft }}>{meta.label}</span></span>}</span></span><span style={{ fontSize: 13.5, fontWeight: 800, color, flexShrink: 0 }}>{sign}{ccy}{t.amount.toFixed(2)}</span></div>;
}

