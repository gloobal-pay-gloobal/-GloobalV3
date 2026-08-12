// src/screens/SendMoney/SendMoney.jsx
import { useState as useState15, useEffect as useEffect13, useRef as useRef11, useMemo as useMemo6 } from "react";
import {
  ChevronLeft as ChevronLeft2,
  Search as Search4,
  Phone as Phone2,
  CreditCard as CreditCard4,
  Coins as Coins3,
  Copy as Copy3,
  Check as Check3,
  ChevronUp as ChevronUp2,
  ChevronDown as ChevronDown2,
  ArrowUpDown as ArrowUpDown2,
  ArrowUpRight as ArrowUpRight2,
  ArrowDownLeft as ArrowDownLeft2,
  Send as SendMoneyLucideIcon,
  Zap as Zap4,
  Lock as Lock5,
  X as X4,
  ChevronRight as ChevronRight4,
  Landmark as Landmark6,
  History as History6,
  RefreshCw as RefreshCw4
} from "lucide-react";


// src/screens/SendMoney/SendMoney.jsx
var FLAG_CHIP_PX = { lg: [52, 40], md: [30, 23], sm: [24, 18] };
function Flag({ emoji, size = "md", badge }) {
  const [w, h] = FLAG_CHIP_PX[size];
  return <span className="flag-chip-wrap"><span className={`flag-chip ${size}`}><FlagEmoji flag={emoji} width={w} height={h} radius={0} /></span>{badge && <span className={`flag-badge ${badge}`}>{badge === "send" ? <ArrowUpRight2 size={11} strokeWidth={2.75} /> : <ArrowDownLeft2 size={11} strokeWidth={2.75} />}</span>}</span>;
}
// SEND_OTP — the literal "123456" — used to live here, and was what both
// this screen and PayPinModal compared a typed PIN against. Both now ask
// POST /api/pin/verify instead, so nothing reads it: a hardcoded PIN that
// unlocks payments has no business sitting in the bundle, even unused.
function buildSenderProfile(sender) {
  const s = sender || { name: "United States", iso: "US", dialCode: "+1", flag: "\u{1F1FA}\u{1F1F8}", phoneNumber: "" };
  const digits = (s.phoneNumber || "").trim();
  return {
    country: s.name,
    flag: s.flag,
    phone: digits ? `${s.dialCode} ${digits}` : `${s.dialCode} \u2022\u2022\u2022\u2022 \u2022\u2022 \u2022\u2022`,
    id: `${s.iso}${s.dialCode.replace("+", "")}\u2022\u2022\u2022\u2022\u2022\u2022`,
    currency: COUNTRY_CURRENCY[s.iso] || "USD",
    dialCode: s.dialCode,
    iso: s.iso,
    name: randomName()
  };
}
function buildLocalReceiverPlaceholder(senderProfile) {
  return {
    country: senderProfile.country,
    flag: senderProfile.flag,
    phone: "",
    id: "",
    name: "",
    currency: senderProfile.currency
  };
}
function toCountryLike(senderProfile) {
  return {
    name: senderProfile.country,
    iso: senderProfile.iso,
    dialCode: senderProfile.dialCode,
    flag: senderProfile.flag
  };
}
var ID_SEARCH_LENGTH = 12;
function identityDisplayValue(profile, mode) {
  switch (mode) {
    case "id":
      return profile.id;
    case "mobile":
      return profile.phone;
    case "country":
      return profile.country;
    case "name":
    default:
      return profile.name;
  }
}
function SendMoneyScreen({ onClose, sender, history = [], onOpenPaidHistory, onSendComplete, onExecuteTransaction, onRemoteSend }) {
  const [top, setTop] = useState15(() => buildSenderProfile(sender));
  const [bottom, setBottom] = useState15(() => buildLocalReceiverPlaceholder(buildSenderProfile(sender)));
  const [amount, setAmount] = useState15("");
  const [topOpen, setTopOpen] = useState15(false);
  const [bottomOpen, setBottomOpen] = useState15(true);
  const [copiedKey, setCopiedKey] = useState15(null);
  const [toast, setToast] = useState15(null);
  const [payMethodBankColor, setPayMethodBankColor] = useState15(() => randomLogoFlipColor());
  useEffect13(() => {
    const interval = setInterval(() => {
      setPayMethodBankColor((prev) => randomLogoFlipColor(prev));
    }, 3e3);
    return () => clearInterval(interval);
  }, []);
  const [pinOpen, setPinOpen] = useState15(false);
  const requestClosePin = useBackClose(pinOpen, () => closePin());
  const [pin, setPin] = useState15("");
  const [pinError, setPinError] = useState15(false);
  const [pinRevealed, setPinRevealed] = useState15(false);
  const toastTimer = useRef11(null);
  const copyTimer = useRef11(null);
  const pinErrorTimer = useRef11(null);
  const [receipt, setReceipt] = useState15(null);
  const requestCloseReceipt = useBackClose(!!receipt, () => {
    setReceipt(null);
    setTransactionStatus("idle");
  });
  const [searchStage, setSearchStage] = useState15("dialing");
  // Recipient lookup against GET /api/users/resolve. searchError carries
  // the inline "no such user" message; searchBusy blocks a second lookup
  // and disables Search while one is in flight.
  const [searchBusy, setSearchBusy] = useState15(false);
  const [searchError, setSearchError] = useState15(null);
  // Shows a stored mobile number without printing it in full — the
  // recipient confirmation has to be recognisable to the sender without
  // handing out somebody else's number to anyone who types an ID.
  function maskMobileNumber(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const tail = raw.slice(-4);
    const head = raw.startsWith("+") ? raw.slice(0, 3) : "";
    return `${head}${head ? " " : ""}•••• ${tail}`;
  }
  const [searchMode, setSearchMode] = useState15("id");
  const [idBuffer, setIdBuffer] = useState15("");
  const [mobileBuffer, setMobileBuffer] = useState15("");
  const [searchCountry, setSearchCountry] = useState15(null);
  const [countryDropdownOpen, setCountryDropdownOpen] = useState15(false);
  const [foundDisplayMode, setFoundDisplayMode] = useState15("name");
  const [searchCountryQuery, setSearchCountryQuery] = useState15("");
  const effectiveSearchCountry = searchCountry || toCountryLike(top);
  const [minMobileDigits, maxMobileDigits] = mobileDigitRange(effectiveSearchCountry.iso);
  const filteredSearchCountries = useMemo6(
    () => ALL_COUNTRIES.filter((c) => countryMatches(c, searchCountryQuery)),
    [searchCountryQuery]
  );
  const convertedAmount = useMemo6(
    () => convert(amount, bottom.currency, top.currency),
    [amount, top.currency, bottom.currency]
  );
  useEffect13(() => {
    return () => {
      clearTimeout(toastTimer.current);
      clearTimeout(copyTimer.current);
      clearTimeout(pinErrorTimer.current);
    };
  }, []);
  const [transactionStatus, setTransactionStatus] = useState15("idle");
  // The PIN the backend has already confirmed, held out of visible state so
  // closePin() can wipe the on-screen digits without also destroying the
  // value POST /api/transactions/send still needs.
  const verifiedPinRef = useRef11(null);
  const [pinChecking, setPinChecking] = useState15(false);
  const requestIdRef = useRef11(null);
  const appliedRequestIdRef = useRef11(null);
  async function completePayment() {
    if (appliedRequestIdRef.current === requestIdRef.current) return;
    appliedRequestIdRef.current = requestIdRef.current;
    const now = /* @__PURE__ */ new Date();
    const txnId = genTxnId();
    // The real backend goes FIRST and is authoritative: it re-verifies the
    // PIN, enforces its own duplicate guard and amount ceiling, and writes
    // the Transaction + paired LedgerEntry rows to MongoDB. Only once it
    // has accepted does the local ledger post, so the client can never end
    // up showing money that the server rejected.
    //
    // onRemoteSend reports { ok, skipped, reason }. `skipped` is the honest
    // case, not an error: this screen's receivers are local placeholders
    // with no server identity, so unless the payment is aimed at a real
    // registered Gloobal ID there is no counterparty for the backend to
    // credit. Those still run as a local simulation, exactly as before.
    if (onRemoteSend) {
      const remote = await onRemoteSend({
        txnId,
        amount: convertedAmount,
        currency: top.currency,
        receiver: bottom,
        // The verified PIN, from the ref — `pin` state is "" by now.
        pin: verifiedPinRef.current || "",
        payMethodLabel: payMethod,
        memo: `Send Money to ${bottom.name}`,
        clientRequestId: requestIdRef.current
      });
      if (remote && remote.ok === false && !remote.skipped) {
        verifiedPinRef.current = null;
        setTransactionStatus("failed");
        showToast2(remote.reason || "The server rejected this payment.");
        // Let the same request be retried — the server never posted it.
        appliedRequestIdRef.current = null;
        setTimeout(() => setTransactionStatus("idle"), 1800);
        return;
      }
    }
    // ONE call: risk-check, posting, provenance, complaint window, and
    // (if eligible) the asset-seed grant all happen atomically inside
    // executeTransaction — not a synchronous post here followed by a
    // fire-and-forget completion later. Location is intentionally not
    // part of this call at all (see the location submission below);
    // financial validity never waits on or depends on it.
    const result = onExecuteTransaction
      ? onExecuteTransaction({
          txnId,
          amount: convertedAmount,
          payMethodLabel: payMethod,
          memo: `Send Money to ${bottom.name}`,
          name: bottom.name,
          shareRatePercent: bottom.shareRate ?? 0,
          time: formatClockTime(now),
          now,
          clientRequestId: requestIdRef.current
        })
      : { ok: true, ledgerRecordId: null };
    if (!result.ok) {
      verifiedPinRef.current = null;
      setTransactionStatus("failed");
      showToast2(result.reason || "Insufficient balance");
      setTimeout(() => setTransactionStatus("idle"), 1500);
      return;
    }
    showToast2(
      `Sending ${CURRENCIES[top.currency].label} ${fmt(
        convertedAmount
      )} to ${bottom.country} \xB7 via ${payMethod || "Gloobal Bank"}`
    );
    const { receipt: receipt2, historyEntry } = buildTransactionSnapshot({
      sender: top,
      receiver: bottom,
      amount,
      convertedAmount,
      payMethod,
      now,
      shareRatePercent: bottom.shareRate ?? 0,
      ledgerRecordId: result.ledgerRecordId,
      txnId
    });
    // Held no longer than the send it authorised.
    verifiedPinRef.current = null;
    // The receipt is set before the status flips, so "completed" is never
    // observable without one to show for it.
    setReceipt(receipt2);
    setTransactionStatus("completed");
    if (onSendComplete) onSendComplete(historyEntry);
  }
  const [showPayBiometric, setShowPayBiometric] = useState15(false);
  const [payBiometricScanning, setPayBiometricScanning] = useState15(false);
  // The last gate before money moves. requireBiometric() runs a real
  // WebAuthn assertion against this account's passkey — the Face ID /
  // Touch ID / fingerprint prompt on a phone — and completePayment() (which
  // is what issues POST /api/transactions/send) is only reached once it
  // resolves true.
  //
  // This was a 700ms setTimeout that always succeeded, so the screen asked
  // for a fingerprint and then paid regardless of the answer. A refusal now
  // cancels the transaction outright.
  //
  // transactionStatus is set to "processing" only after the check passes.
  // Setting it up front — as this used to — left the screen stuck mid-send
  // on a refusal, with no transaction and no way back.
  const handlePayBiometricVerify = async () => {
    if (transactionStatus === "processing" || payBiometricScanning) return;
    setPayBiometricScanning(true);
    const ok = await requireBiometric({ pinReason: "Confirm this payment with your PIN." });
    setPayBiometricScanning(false);
    setShowPayBiometric(false);
    if (!ok) {
      // The PIN authorised a send that is not happening. Drop it rather
      // than leaving it available to a later attempt that never passed a
      // check of its own.
      verifiedPinRef.current = null;
      showToast2("Couldn't verify it's you — payment cancelled");
      return;
    }
    // Minted here, after the gate, so a cancelled attempt does not consume
    // an idempotency key that a genuine retry would then be deduplicated
    // against.
    requestIdRef.current = generateRequestId();
    setTransactionStatus("processing");
    completePayment();
  };
  // PIN entry, verified against the backend.
  //
  // Two bugs lived here, and together they made the payment unfinishable.
  //
  // First, the PIN was compared to SEND_OTP — a hardcoded "123456" in this
  // file. The person's real PIN was never checked, and any account whose
  // PIN was not literally 123456 could not get past this step at all.
  //
  // Second, and this is the "PIN required" loop: on success this called
  // requestClosePin(), and closePin() does setPin(""). The biometric step
  // then ran, and by the time completePayment() reached
  // POST /api/transactions/send the pin it forwarded was the empty string.
  // That route requires the PIN in its body and bcrypt-checks it
  // server-side, so it answered 400 "PIN is required before sending
  // transaction." — after the person had entered the right PIN and passed
  // the biometric. No transaction, so no receipt either.
  //
  // The verified PIN is now held in a ref instead of the visible state.
  // closePin() still wipes the on-screen buffer immediately (the digits
  // should not linger on screen), while the ref carries the value the one
  // step further it has to travel. It is cleared the moment the send
  // settles, either way.
  useEffect13(() => {
    if (pin.length < 6 || pinChecking) return;
    let cancelled = false;
    (async () => {
      setPinChecking(true);
      const symbolId = gloobalCurrentSymbolId();
      try {
        if (symbolId) {
          await GloobalApi.verifyPin(symbolId, pin);
        }
        // No symbolId means this device has no signed-in account to check
        // against — the local-simulation path this screen still supports
        // for placeholder receivers. Nothing to verify, nothing to send.
        if (cancelled) return;
        verifiedPinRef.current = pin;
        setPinChecking(false);
        requestClosePin();
        setShowPayBiometric(true);
      } catch (err) {
        if (cancelled) return;
        setPinChecking(false);
        verifiedPinRef.current = null;
        setPinError(true);
        // The backend's own words: it distinguishes a wrong PIN from a
        // locked one ("PIN is temporarily locked", after five tries) and
        // that difference matters to whoever is holding the phone.
        showToast2(gloobalApiIsUnreachable(err) ? "Couldn't reach the server. Try again." : err.message);
        pinErrorTimer.current = setTimeout(() => {
          setPin("");
          setPinError(false);
        }, 550);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pin]);
  function showToast2(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }
  function handleCopy(text, key) {
    const doSet = () => {
      setCopiedKey(key);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopiedKey(null), 1400);
    };
    copyToClipboard(text);
    doSet();
  }
  function handleSwap() {
    setTopOpen((o) => !o);
    setBottomOpen((o) => !o);
  }
  function openSearch() {
    if (searchStage === "dialing") return;
    setSearchStage("dialing");
    setTopOpen(false);
    setBottomOpen(true);
    if (searchStage === "found") {
      setIdBuffer("");
      setMobileBuffer("");
      setSearchCountry(null);
      setSearchCountryQuery("");
      setFoundDisplayMode("name");
      setBottom(buildLocalReceiverPlaceholder(top));
    }
  }
  function toggleSearchMode(e) {
    e.stopPropagation();
    setSearchMode((m) => m === "id" ? "mobile" : "id");
  }
  function selectSearchCountry(c) {
    setSearchCountry(c);
    if (searchMode === "mobile") setMobileBuffer("");
    setSearchCountryQuery("");
    setCountryDropdownOpen(false);
    setBottom((b) => ({ ...b, country: c.name, flag: c.flag }));
  }
  // Looks the recipient up on the backend instead of inventing one.
  //
  // This used to accept anything: whatever twelve symbols were dialled
  // became the recipient, with randomName() standing in for a name and
  // randomLocalPhone() for a number, and the send proceeded against an
  // account that need not exist. Money aimed at a typo was
  // indistinguishable from money aimed at a real person.
  //
  // GET /api/users/resolve takes `identifier` and accepts either a Gloobal
  // ID or a full international mobile number, so one call serves both
  // modes. (Not `?symbolId=` / `?phone=` — this backend reads neither.)
  async function resolveSearch() {
    if (searchBusy) return;
    const c = effectiveSearchCountry;
    const identifier = searchMode === "id" ? idBuffer : `${c.dialCode}${mobileBuffer.replace(/\D/g, "")}`;
    setSearchBusy(true);
    setSearchError(null);
    let user;
    try {
      user = await GloobalApi.resolveUser(identifier);
    } catch (err) {
      setSearchBusy(false);
      // Only a definite 404 means "no such person". A cold start or a 5xx
      // is not an answer about this recipient, and reporting it as one
      // would tell somebody their friend has no Gloobal account.
      setSearchError(
        err instanceof GloobalApiError && err.status === 404
          ? "No Gloobal user found. Check the ID and try again."
          : err.message
      );
      return;
    }
    setSearchBusy(false);
    const grouped = mobileBuffer.replace(/(\d{3})(?=\d)/g, "$1 ");
    setBottom({
      country: c.name,
      flag: c.flag,
      // The recipient's CURRENT registered ID, as the backend holds it —
      // not what was typed. Someone paying an ID that has since been
      // changed is shown, and pays, the ID the account actually has now.
      id: user.symbolId || identifier,
      // fullName is the mobile number on accounts created before the name
      // step existed (register-symbol overwrites it), and a name that is
      // just the number is not a name worth showing.
      name: user.fullName && user.fullName !== user.mobileNumber ? user.fullName : "Gloobal User",
      phone: maskMobileNumber(user.mobileNumber) || (searchMode === "mobile" ? `${c.dialCode} ${grouped}` : ""),
      currency: COUNTRY_CURRENCY[c.iso] || "USD",
      // The receiver's real rate off their own account, not a random one.
      shareRate: Number(user.cashbackRate) || 0
    });
    setSearchStage("found");
    setFoundDisplayMode("name");
    setTopOpen(false);
    setBottomOpen(true);
  }
  function handleAmountChange(e) {
    const v = e.target.value;
    if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) {
      setAmount(v);
    }
  }
  const [payMethodOpen, setPayMethodOpen] = useState15(false);
  const requestClosePayMethod = useBackClose(payMethodOpen, () => setPayMethodOpen(false));
  const [payMethod, setPayMethod] = useState15(null);
  function handleSend() {
    setPayMethod(null);
    setPayMethodOpen(true);
  }
  function choosePayMethod(label) {
    setPayMethod(label);
    requestClosePayMethod();
    setPin("");
    setPinError(false);
    setPinOpen(true);
  }
  function closePin() {
    clearTimeout(pinErrorTimer.current);
    setPinOpen(false);
    setPin("");
    setPinError(false);
  }
  return <div className="app-shell"><style>{`
        * { box-sizing: border-box; }
        .app-shell {
          max-width: 430px;
          margin: 0 auto;
          background: radial-gradient(120% 60% at 50% -10%, #F8F7FC 0%, #F1F0F7 55%, #ECEAF4 100%);
          min-height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          padding: 24px 18px 40px;
          position: relative;
          -webkit-font-smoothing: antialiased;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
        }
        .icon-btn {
          width: 44px;
          height: 44px;
          border-radius: 15px;
          background: #f4f2fb;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #4633C7;
          cursor: pointer;
          transition: transform 0.12s ease, background 0.15s ease, box-shadow 0.15s ease;
          box-shadow: 0 1px 2px rgba(20,18,43,0.04);
        }
        .icon-btn:hover { background: #ece6fb; }
        .icon-btn:active { transform: scale(0.92); background: #e0d8f7; }
        .icon-btn.circle {
          border-radius: 50%;
          background: #fff;
          border: 1.6px solid #7c3aed;
          color: #7c3aed;
          width: 40px;
          height: 40px;
          box-shadow: 0 2px 8px rgba(124,58,237,0.14);
        }
        .icon-btn:focus-visible, .collapse-btn:focus-visible, .copy-btn:focus-visible,
        .currency-select:focus-visible, .swap-btn:focus-visible, .send-btn:focus-visible {
          outline: 2px solid #7c3aed; outline-offset: 2px;
        }
        .title { font-size: 21px; font-weight: 700; color: #14122B; letter-spacing: -0.01em; }

        .search-bar {
          display: flex;
          align-items: center;
          background: #fff;
          border-radius: 999px;
          padding: 13px 14px 13px 16px;
          gap: 12px;
          margin-bottom: 18px;
          border: 1px solid #ECECF3;
          box-shadow: 0 2px 10px rgba(20,18,43,0.04);
          transition: box-shadow 0.15s ease, border-color 0.15s ease;
          cursor: pointer;
        }
        .search-bar:hover { border-color: #E1DCF2; }
        .search-bar:focus-visible { border-color: #d8d2ee; box-shadow: 0 2px 14px rgba(124,58,237,0.12); }
        .search-bar-active { border-color: #d8d2ee; box-shadow: 0 2px 14px rgba(124,58,237,0.1); }
        .search-bar > svg:first-child { color: #7c3aed; flex-shrink: 0; }
        .search-bar-text {
          flex: 1;
          min-width: 0;
          font-size: 13px;
          font-weight: 600;
          color: #14122B;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-variant-numeric: tabular-nums;
          text-align: center;
        }
        .search-mode-toggle {
          flex-shrink: 0;
          width: 32px; height: 32px; border-radius: 50%;
          background: #f4f2fb; border: none; color: #7c3aed;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: transform 0.15s ease, background 0.15s ease;
        }
        .search-mode-toggle:hover { background: #ece6fb; }
        .search-mode-toggle:active { transform: scale(0.88) rotate(180deg); }

        .dial-entry { display: flex; flex-direction: column; align-items: center; gap: 4px; padding-top: 4px; }
        .dial-entry-label { font-size: 13px; font-weight: 700; color: #6B6580; margin: 0 0 14px; text-align: center; }

        .flag-chip-wrap { position: relative; display: inline-flex; flex-shrink: 0; }
        .flag-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 12px;
          background: #fff;
          box-shadow: inset 0 0 0 1px rgba(20,18,43,0.08), 0 1px 3px rgba(20,18,43,0.08);
          overflow: hidden;
        }
        .flag-chip.lg { width: 52px; height: 40px; font-size: 22px; border-radius: 13px; }
        .flag-chip.md { width: 30px; height: 23px; font-size: 13px; border-radius: 7px; }
        .flag-chip.sm { width: 24px; height: 18px; font-size: 11px; border-radius: 6px; }
        .flag-badge {
          position: absolute; bottom: -5px; right: -6px;
          width: 20px; height: 20px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: #fff; border: 2px solid #fff;
          box-shadow: 0 2px 6px rgba(20,18,43,0.18);
        }
        .flag-badge.send { background: #7c3aed; }
        .flag-badge.receive { background: #16A34A; }

        .card {
          background: #fff;
          border-radius: 28px;
          padding: 20px;
          box-shadow: 0 1px 2px rgba(20,18,43,0.03), 0 10px 30px -12px rgba(20,18,43,0.10);
          border: 1px solid rgba(20,18,43,0.03);
          position: relative;
        }
        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
        }
        .card-header-left { display: flex; align-items: center; gap: 11px; min-width: 0; }
        .card-name {
          font-size: 14.5px;
          font-weight: 700;
          color: #14122B;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .collapse-btn {
          background: #F7F6FB;
          border: none;
          color: #7c3aed;
          cursor: pointer;
          display: flex;
          padding: 7px;
          border-radius: 10px;
          transition: transform 0.15s ease, background 0.15s ease;
        }
        .collapse-btn:hover { background: #f4f2fb; }
        .collapse-btn:active { transform: scale(0.85); }

        .contact-block { overflow: hidden; transition: max-height 0.25s ease; }
        .contact-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 2px; }
        .contact-icon {
          width: 36px; height: 36px; border-radius: 11px;
          background: #f4f2fb; color: #7c3aed;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
          box-shadow: inset 0 0 0 1px rgba(124,58,237,0.06);
        }
        .contact-icon.green { background: #E1F5E7; color: #16A34A; box-shadow: inset 0 0 0 1px rgba(22,163,74,0.08); }
        .contact-text {
          flex: 1; font-size: 15px; font-weight: 600; color: #14122B;
          letter-spacing: 0.01em; font-variant-numeric: tabular-nums;
        }
        .copy-btn {
          background: transparent; border: none; color: #C2C0D4; cursor: pointer;
          display: flex; padding: 7px; border-radius: 9px;
          transition: color 0.15s ease, transform 0.15s ease, background 0.15s ease;
        }
        .copy-btn:hover { background: #F7F6FB; color: #8B899E; }
        .copy-btn:active { transform: scale(0.85); }
        .copy-btn.copied { color: #16A34A; }
        .copy-btn.copied:hover { background: #E9FBF0; color: #16A34A; }

        .divider { height: 1px; background: #EFEFF5; margin: 6px 0 14px; }

        .rate-row {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 12px; padding: 0 2px;
        }
        .rate-left {
          display: flex; align-items: center; gap: 8px; font-size: 14.5px; font-weight: 600;
          color: #14122B; font-variant-numeric: tabular-nums;
        }
        .live-dot {
          width: 7px; height: 7px; border-radius: 50%; background: #22C55E; flex-shrink: 0;
          box-shadow: 0 0 0 3px rgba(34,197,94,0.15);
          animation: live-pulse 2s ease-in-out infinite;
        }
        @keyframes live-pulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(34,197,94,0.15); }
          50% { box-shadow: 0 0 0 5px rgba(34,197,94,0.22); }
        }
        .live-text { display: flex; align-items: center; gap: 4px; color: #16A34A; font-size: 14px; font-weight: 700; }
        .live-pill {
          display: flex; align-items: center; gap: 4px; background: #DCFCE7; color: #16A34A;
          font-size: 12.5px; font-weight: 700; padding: 5px 11px; border-radius: 999px; flex-shrink: 0;
        }

        .amount-box { border-radius: 20px; padding: 16px 18px; transition: box-shadow 0.15s ease; }
        .amount-box.indigo { background: linear-gradient(155deg, #EFEDFC, #E7E4FB); box-shadow: inset 0 0 0 1px rgba(124,58,237,0.06); }
        .amount-box.indigo:has(.amount-input:focus) { box-shadow: inset 0 0 0 1.5px rgba(124,58,237,0.35); }
        .amount-box.green { background: linear-gradient(155deg, #EEF9F1, #E5F6EA); box-shadow: inset 0 0 0 1px rgba(22,163,74,0.06); }

        .amount-input {
          border: none; background: transparent; font-size: 27px; font-weight: 800;
          color: #14122B; width: 100%; outline: none; padding: 0; font-family: inherit;
          letter-spacing: -0.01em; font-variant-numeric: tabular-nums;
        }
        .amount-input::placeholder { color: #B9B6D6; }

        .amount-top-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .amount-display {
          font-size: 24px; font-weight: 800; color: #16A34A;
          letter-spacing: -0.01em; font-variant-numeric: tabular-nums;
        }

        .currency-select {
          display: flex; align-items: center; justify-content: center; margin-top: 8px;
          width: 30px; height: 30px;
          background: rgba(255,255,255,0.65); border: none; cursor: pointer;
          color: #14122B; padding: 0;
          border-radius: 50%; transition: background 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease;
          box-shadow: 0 1px 2px rgba(20,18,43,0.05);
        }
        .currency-select:hover { background: rgba(255,255,255,0.95); box-shadow: 0 2px 6px rgba(20,18,43,0.1); }
        .currency-select:active { transform: scale(0.9); }

        .bottom-meta-row { display: flex; align-items: center; justify-content: flex-start; margin-top: 12px; }

        .dropdown-overlay { position: fixed; inset: 0; z-index: 40; }
        .dropdown-menu {
          position: absolute; z-index: 50; top: calc(100% + 8px); left: 0;
          background: #fff; border-radius: 18px; box-shadow: 0 16px 40px -8px rgba(20,18,43,0.22);
          padding: 7px; min-width: 148px; border: 1px solid rgba(20,18,43,0.05);
          max-height: 300px; overflow-y: auto;
        }
        .dropdown-item {
          display: flex; align-items: center; gap: 10px; padding: 9px 10px;
          border-radius: 11px; cursor: pointer; font-size: 14.5px; font-weight: 600; color: #14122B;
          background: transparent; border: none; width: 100%; text-align: left;
          transition: background 0.12s ease;
        }
        .dropdown-item:hover { background: #F3F2F8; }
        .dropdown-item.active { color: #7c3aed; background: #f4f2fb; }

        .flag-grid-menu {
          position: absolute; z-index: 50; top: calc(100% + 10px); left: 0;
          background: #fff; border-radius: 16px; box-shadow: 0 16px 40px -8px rgba(20,18,43,0.22);
          padding: 10px; border: 1px solid rgba(20,18,43,0.05);
          display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px;
          width: 264px; max-height: 240px; overflow-y: auto;
        }
        .flag-grid-item {
          display: flex; align-items: center; justify-content: center;
          border: 1.5px solid transparent; border-radius: 8px; background: transparent;
          padding: 4px; cursor: pointer; transition: background 0.12s ease, border-color 0.12s ease;
        }
        .flag-grid-item:hover { background: #F3F2F8; }
        .flag-grid-item.active { border-color: #7c3aed; background: #f4f2fb; }

        .swap-wrap { display: flex; justify-content: center; margin: -22px 0; position: relative; z-index: 6; }
        .swap-btn {
          width: 46px; height: 46px; border-radius: 50%;
          background: linear-gradient(180deg, #ffffff, #fbfaff);
          border: 1px solid #ECECF3; box-shadow: 0 6px 18px -4px rgba(124,58,237,0.22), 0 1px 2px rgba(20,18,43,0.06);
          display: flex; align-items: center; justify-content: center; color: #7c3aed;
          cursor: pointer; transition: transform 0.25s cubic-bezier(.34,1.56,.64,1), box-shadow 0.15s ease;
        }
        .swap-btn:hover { box-shadow: 0 8px 22px -4px rgba(124,58,237,0.3), 0 1px 2px rgba(20,18,43,0.06); }
        .swap-btn:active { transform: scale(0.88) rotate(180deg); }

        .send-btn {
          width: 100%; margin-top: 22px; border: none; border-radius: 999px; padding: 18px;
          font-size: 16.5px; font-weight: 700; color: #fff; letter-spacing: 0.01em;
          background: linear-gradient(100deg, #3b6ef5, #7b5bf0, #7c3aed);
          display: flex; align-items: center; justify-content: center; gap: 10px;
          cursor: pointer; box-shadow: 0 12px 28px -6px rgba(124,58,237,0.4), inset 0 1px 0 rgba(255,255,255,0.15);
          transition: transform 0.12s ease, box-shadow 0.15s ease;
        }
        .send-btn:hover { box-shadow: 0 14px 32px -6px rgba(124,58,237,0.46), inset 0 1px 0 rgba(255,255,255,0.15); }
        .send-btn:active { transform: scale(0.98); }

        .toast {
          position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
          background: #14122B; color: #fff; padding: 12px 18px; border-radius: 14px;
          font-size: 13.5px; font-weight: 600; max-width: 90%; text-align: left;
          box-shadow: 0 10px 30px rgba(0,0,0,0.25); z-index: 100;
          animation: toast-in 0.2s ease;
          display: flex; align-items: center; gap: 9px;
        }
        .toast-icon {
          width: 20px; height: 20px; border-radius: 50%; background: rgba(34,197,94,0.18);
          color: #4ADE80; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        @keyframes toast-in { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }

        .pin-overlay {
          position: fixed; inset: 0; background: rgba(20,18,43,0.55);
          display: flex; align-items: flex-end; justify-content: center;
          z-index: 200; animation: overlay-in 0.2s ease;
        }
        @keyframes overlay-in { from { opacity: 0; } to { opacity: 1; } }
        .pin-modal {
          width: 100%; max-width: 430px; background: #fff;
          border-radius: 28px 28px 0 0; padding: 28px 24px 36px;
          position: relative; animation: sheet-up 0.28s cubic-bezier(.32,.72,0,1);
        }
        @keyframes sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .pin-close {
          position: absolute; top: 16px; right: 16px; width: 34px; height: 34px;
          border-radius: 50%; background: #F7F6FB; border: none; color: #8B899E;
          display: flex; align-items: center; justify-content: center; cursor: pointer;
          transition: background 0.15s ease;
        }
        .pin-close:hover { background: #EFEDF6; }
        .pin-lock-icon {
          width: 52px; height: 52px; border-radius: 16px; background: #f4f2fb; color: #7c3aed;
          display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;
        }
        .pin-title { text-align: center; font-size: 18px; font-weight: 700; color: #14122B; margin: 0 0 6px; }
        .pin-sub { text-align: center; font-size: 13.5px; color: #8B899E; margin: 0 0 28px; font-weight: 500; line-height: 1.4; }
        .pin-dots { display: flex; justify-content: center; gap: 18px; margin-bottom: 32px; }
        .pin-dots.shake { animation: pin-shake 0.4s ease; }
        @keyframes pin-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        .pin-dot { width: 14px; height: 14px; border-radius: 50%; background: #E4E1F0; transition: background 0.15s ease, transform 0.15s ease; }
        .pin-dot.filled { background: #7c3aed; transform: scale(1.1); }
        .pin-dot.filled.error { background: #EF4444; }
        .pin-keypad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; max-width: 280px; margin: 0 auto; }
        .pin-key {
          aspect-ratio: 1; border-radius: 50%; border: none; background: #F7F6FB;
          font-size: 22px; font-weight: 600; color: #14122B; font-variant-numeric: tabular-nums;
          display: flex; align-items: center; justify-content: center; cursor: pointer;
          transition: background 0.12s ease, transform 0.1s ease;
        }
        .pin-key:hover { background: #f4f2fb; }
        .pin-key:active { transform: scale(0.9); background: #ece6fb; }
        .pin-key.empty { background: transparent; cursor: default; }
        .pin-key.empty:hover, .pin-key.empty:active { background: transparent; transform: none; }

        @media (prefers-reduced-motion: reduce) {
          .icon-btn, .collapse-btn, .copy-btn, .swap-btn, .send-btn, .toast, .live-dot,
          .pin-overlay, .pin-modal, .pin-dots, .pin-key { transition: none; animation: none; }
        }
      `}</style><SendMoneyAmbientBg /><div style={{ position: "relative", zIndex: 1 }}>{
    /* Header — back button on the left, and once a receiver's been
       found, a single flip icon on the right (opposite the
       navigation icon) that cycles BOTH the sender and receiver
       cards together through name → Gloobal ID → mobile number →
       country name. Replaces the old per-card flip button that used
       to sit on the found receiver card's own corner. */
  }<div className="header"><button className="icon-btn circle" onClick={onClose} aria-label="Back"><ChevronLeft2 size={20} /></button><div style={{ display: "flex", alignItems: "center", gap: 10 }}><button className="icon-btn circle" onClick={onOpenPaidHistory} aria-label="Paid history"><History6 size={15} color={T.inkSoft} /></button></div></div>{searchStage !== "closed" && <>{bottomOpen && <>{
    /* RECEIVER CARD — now shown first/up top: their name/ID and
       the editable amount (in their currency) are what matters
       while searching and typing. Hosts the active search dial
       pad until a receiver's resolved, then the normal contact +
       editable amount UI. Hidden entirely (not just collapsed to
       a strip) whenever the sender card is the active side —
       the swap button is the only way to bring it back. */
  }<div className={searchStage === "found" ? "card card-flip-in" : "card"}><div
    style={{
      position: "absolute",
      top: -11,
      left: "50%",
      transform: "translateX(-50%)",
      background: "#fff",
      padding: 3,
      borderRadius: "50%",
      zIndex: 1
    }}
  ><GH2HFlipCircle size={22} /></div><div style={{ height: 14 }} aria-hidden="true" />{
    /* Switches the recipient search between Gloobal ID and phone
       number.

       This was a <span aria-hidden="true"> with no onClick: it looked
       like a control, and toggleSearchMode was defined and ready, but
       nothing ever called it. Tapping did nothing, and because the mode
       could never leave "id", the entire phone-number path below —
       country picker, dial-code tag, PhoneDialPad — was unreachable.
       That is why the flip "did not work" AND the mobile option was
       "missing": one unbound handler, two symptoms.

       Now a real button: labelled, reachable by keyboard, and it says
       which mode it will switch to rather than being decoration. */
  }{searchStage === "dialing" && <button
    type="button"
    onClick={toggleSearchMode}
    aria-label={searchMode === "id" ? "Search by phone number instead" : "Search by Gloobal ID instead"}
    className="v2-tap"
    style={{
      position: "absolute",
      top: -14,
      right: -10,
      minWidth: 40,
      height: 40,
      padding: "0 10px",
      borderRadius: 999,
      border: "1px solid rgba(20,18,43,0.06)",
      background: "#fff",
      color: "#7c3aed",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      cursor: "pointer",
      boxShadow: "0 4px 14px rgba(20,18,43,0.12)",
      zIndex: 3
    }}
  ><RefreshCw4 size={18} style={{ transform: searchMode === "mobile" ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)" }} /><span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.3 }}>{searchMode === "id" ? "ID" : "TEL"}</span></button>}<div className="card-header"><div className="card-header-left" style={{ position: "relative", flex: searchStage === "dialing" ? 1 : void 0 }}>{searchStage === "dialing" ? <div style={{ position: "relative", flexShrink: 0 }}><button
    onClick={() => setCountryDropdownOpen((o) => !o)}
    aria-label={`Country: ${effectiveSearchCountry.name}. Tap to search for someone outside your own country`}
    className="v2-tap"
    style={{ border: "none", background: "none", padding: 0, cursor: "pointer", display: "flex" }}
  ><Flag emoji={bottom.flag} size="lg" badge="receive" /></button>{
    /* Dial code tucked behind the flag as a small tag —
       mobile-only, since a Gloobal ID has no dial code
       of its own. */
  }{searchMode === "mobile" && <span
    style={{
      position: "absolute",
      top: -6,
      left: -8,
      background: "#14122B",
      color: "#fff",
      fontSize: 9.5,
      fontWeight: 800,
      letterSpacing: 0.2,
      padding: "2px 5px",
      borderRadius: 999,
      border: "2px solid #fff",
      boxShadow: "0 2px 6px rgba(20,18,43,0.18)",
      pointerEvents: "none",
      whiteSpace: "nowrap"
    }}
  >{effectiveSearchCountry.dialCode}</span>}</div> : <Flag emoji={bottom.flag} size="lg" badge="receive" />}{searchStage === "found" ? <span className="card-name">{identityDisplayValue(bottom, foundDisplayMode)}</span> : bottom.name && <span className="card-name">{bottom.name}</span>}{
    /* "Gloobal ID" label, aligned with the flag on the header
       row — the chip row + dial pad below already echo what's
       typed, so this is just the field label, not an input. */
  }{searchStage === "dialing" && searchMode === "id" && <span style={{ fontSize: 14.5, fontWeight: 700, color: "#14122B" }}><GloobalWordmark suffix=" ID" /></span>}{
    /* Country field beside the flag while dialing in mobile
       mode — a real typeable search, same country/code
       matching every other country picker in the app uses,
       not just a static label. Typing filters the dropdown
       below live; tapping the flag opens it too. */
  }{searchStage === "dialing" && searchMode === "mobile" && <div
    style={{
      flex: 1,
      minWidth: 0,
      display: "flex",
      alignItems: "center",
      gap: 9,
      background: "#fff",
      border: "1px solid #ECECF3",
      borderRadius: 999,
      padding: "9px 13px",
      boxShadow: "0 2px 10px rgba(20,18,43,0.04)"
    }}
  ><input
    value={searchCountryQuery}
    onChange={(e) => {
      setSearchCountryQuery(e.target.value);
      setCountryDropdownOpen(true);
    }}
    onFocus={() => setCountryDropdownOpen(true)}
    placeholder={effectiveSearchCountry.name}
    aria-label="Search country or code"
    style={{
      flex: 1,
      minWidth: 0,
      border: "none",
      outline: "none",
      background: "none",
      fontSize: 13,
      fontWeight: 600,
      color: "#14122B"
    }}
  /><ChevronDown2 size={14} style={{ color: "#9C96AF", flexShrink: 0 }} /></div>}{countryDropdownOpen && <><div className="dropdown-overlay" onClick={() => setCountryDropdownOpen(false)} /><div className="flag-grid-menu">{filteredSearchCountries.length === 0 && <div style={{ padding: "10px 6px", fontSize: 12.5, color: "#9C96AF", fontWeight: 600 }}>
                          No countries found
                        </div>}{filteredSearchCountries.map((c) => <button
    key={c.iso}
    className={`flag-grid-item ${c.iso === effectiveSearchCountry.iso ? "active" : ""}`}
    onClick={() => selectSearchCountry(c)}
    aria-label={c.name}
    title={c.name}
  ><div style={{ position: "relative", width: 26, height: 20, borderRadius: 5, ...countryGlowStyle(ACTIVE_ISO_SET.has(c.iso), true) }}><div style={{ position: "absolute", inset: 0, borderRadius: 5, overflow: "hidden" }}><FlagEmoji flag={c.flag} width={26} height={20} /></div></div></button>)}</div></>}</div>{searchStage === "found" && <button className="collapse-btn" onClick={() => setBottomOpen((o) => !o)} aria-label="Toggle details">{bottomOpen ? <ChevronUp2 size={20} /> : <ChevronDown2 size={20} />}</button>}</div>{searchStage === "dialing" && <div className="dial-entry">{searchMode === "id" ? <><SymbolChipRow length={ID_SEARCH_LENGTH} value={idBuffer} masked={false} /><div style={{ marginTop: 22, width: "100%" }}><SymbolDialPad value={idBuffer} onChange={(v) => { setSearchError(null); setIdBuffer(v); }} length={ID_SEARCH_LENGTH} /></div></> : <PhoneDialPad
    value={mobileBuffer}
    onChange={(v) => { setSearchError(null); setMobileBuffer(v); }}
    minLength={minMobileDigits}
    maxLength={maxMobileDigits}
  />}{
    /* Inline, under the pad it belongs to. The recipient either exists or
       the send cannot proceed, so this is part of the field rather than a
       transient toast that can be missed. */
  }{searchError && <div role="alert" style={{ marginTop: 12, fontSize: 12.5, fontWeight: 700, color: T.negative, textAlign: "center", lineHeight: 1.45 }}>{searchError}</div>}<SubmitButton
    onClick={resolveSearch}
    disabled={searchBusy || (searchMode === "id" ? idBuffer.length < ID_SEARCH_LENGTH : mobileBuffer.length < minMobileDigits)}
    label={searchBusy ? "Checking…" : "Search"}
  /></div>}{searchStage === "found" && bottomOpen && <><div className="contact-block"><div className="contact-row"><span className="contact-text">{bottom.phone}</span><button
    className="copy-btn"
    onClick={() => showToast2("Calling \u2014 coming soon")}
    aria-label="Call"
  ><Phone2 size={17} /></button></div><div className="contact-row"><span className="contact-text"><ColoredGloobalId id={bottom.id} /></span><button
    className={`copy-btn ${copiedKey === "bottom-id" ? "copied" : ""}`}
    onClick={() => handleCopy(bottom.id, "bottom-id")}
    aria-label="Copy ID"
  >{copiedKey === "bottom-id" ? <Check3 size={17} /> : <Copy3 size={17} />}</button></div></div>{
    /* Creator Share — this is the RECEIVER's own rate, not
       something the sender picks. Prefilled and read-only,
       connected straight to bottom.shareRate (set once
       when this receiver was found). 0% shows as "0.00%",
       1.15% shows as "1.15%", 7% shows as "7.00%" — always
       exactly what's actually on their account, never a
       choice made here. */
  }<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 14 }}><span style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft }}>Creator Share</span><ShareRateFlipCircle percent={bottom.shareRate ?? 0} size={28} staticMode /></div>{
    /* Editable — the amount the RECEIVER is asking for, in
       their own currency (e.g. the $100 a US receiver wants).
       Starts genuinely empty (placeholder shows "0.00") so
       there's nothing to erase before typing. No separate
       "Sending to" caption here anymore — the name/ID are
       already shown above in this same card. */
  }<div className="amount-box green" style={{ marginTop: 4, position: "relative" }}><input
    className="amount-input"
    value={amount}
    onChange={handleAmountChange}
    inputMode="decimal"
    placeholder="0.00"
    aria-label="Amount the receiver is asking for"
  /><span
    style={{
      position: "absolute",
      top: 14,
      right: 16,
      fontSize: 20,
      fontWeight: 800,
      color: T.inkSoft,
      lineHeight: 1
    }}
    aria-label={`Receiver's currency: ${bottom.currency} \u2014 fixed to their account, can't be changed`}
  >{CURRENCY_SYMBOL[bottom.currency] || bottom.currency}</span></div></>}</div></>}{
    /* SWAP — only once a receiver's been found. Flips currency
       sides and, with it, which card is shown big vs as a strip.
       The search bar itself always looks up the receiver, no
       matter which card is currently in front. */
  }{searchStage === "found" && <div className="swap-wrap"><button className="swap-btn" onClick={handleSwap} aria-label="Flip sender and receiver cards"><ArrowUpDown2 size={20} /></button></div>}{
    /* SENDER CARD — hidden entirely (not shown as a collapsed
       strip) unless swapped to active, whether that's while
       searching, while typing the amount, or once a receiver's
       been found — matches the receiver card's own hide/reveal
       behavior. The swap button is the only way to bring it up. */
  }{topOpen && <div className="card card-flip-in" style={{ marginTop: searchStage === "dialing" ? 14 : 0 }}><div className="card-header"><div className="card-header-left"><Flag emoji={top.flag} size="lg" badge="send" /><span className="card-name">{searchStage === "found" ? identityDisplayValue(top, foundDisplayMode) : top.name}</span></div><button className="collapse-btn" onClick={() => setTopOpen((o) => !o)} aria-label="Toggle details">{topOpen ? <ChevronUp2 size={20} /> : <ChevronDown2 size={20} />}</button></div>{topOpen && <><div className="contact-block"><div className="contact-row"><span className="contact-text">{top.phone}</span><button
    className="copy-btn"
    onClick={() => showToast2("Calling \u2014 coming soon")}
    aria-label="Call"
  ><Phone2 size={17} /></button></div><div className="contact-row"><span className="contact-text"><ColoredGloobalId id={top.id} /></span><button
    className={`copy-btn ${copiedKey === "top-id" ? "copied" : ""}`}
    onClick={() => handleCopy(top.id, "top-id")}
    aria-label="Copy ID"
  >{copiedKey === "top-id" ? <Check3 size={17} /> : <Copy3 size={17} />}</button></div></div><div className="divider" /><div className="rate-row"><div className="rate-left"><span className="live-dot" /><span>
                      1 {top.currency} = {fmt(convert(1, top.currency, bottom.currency))} {bottom.currency}</span></div><span className="live-text"><Zap4 size={14} fill="currentColor" /> Live</span></div>{
    /* Read-only — the exact amount that will be paid/debited
       from the sender's own account, converted from whatever
       the receiver is asking for above. Shown large since
       it's the number that matters before paying. */
  }<div className="amount-box indigo"><div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: T.accent, marginBottom: 6 }}>
                    You pay
                  </div><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}><span
    style={{
      fontSize: 34,
      fontWeight: 800,
      color: "#14122B",
      letterSpacing: "-0.01em",
      fontVariantNumeric: "tabular-nums"
    }}
  >{fmt(convertedAmount)}</span><span
    style={{
      display: "flex",
      alignItems: "center",
      gap: 5,
      padding: "6px 11px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.65)",
      fontSize: 13,
      fontWeight: 800,
      color: T.ink,
      letterSpacing: 0.2,
      flexShrink: 0
    }}
    aria-label={`Your currency: ${top.currency} \u2014 fixed to your account, can't be changed`}
  >{top.currency}</span></div></div></>}</div>}{
    /* SEND BUTTON — just my own currency and amount now, nothing
       about what the receiver gets. */
  }{searchStage === "found" && <button
    className="send-btn"
    onClick={handleSend}
    style={{ padding: "14px 18px", marginTop: topOpen ? 0 : 24 }}
  ><span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}><SendMoneyLucideIcon size={18} />
                Send {CURRENCY_SYMBOL[top.currency] || ""}{fmt(convertedAmount)}</span></button>}</>}{
    /* Funding source — the four ways a transfer can be paid. Picking
       one moves straight on to the OTP confirmation. */
  }{payMethodOpen && <div
    className="pin-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="Choose how to pay"
    onClick={requestClosePayMethod}
  ><div className="pin-modal" onClick={(e) => e.stopPropagation()}><button className="pin-close" onClick={requestClosePayMethod} aria-label="Cancel"><X4 size={18} /></button><h3 className="pin-title">Pay with</h3><p className="pin-sub">{CURRENCIES[top.currency].label} {fmt(convertedAmount)}{top.currency !== bottom.currency && <> (≈ {CURRENCY_SYMBOL[bottom.currency] || ""}{fmt(parseFloat(amount) || 0)} {bottom.currency})</>}{" "}
              to {bottom.phone}</p><div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6, textAlign: "left" }}>{[
    { key: "gbank", label: "Gloobal Bank", displayLabel: <GloobalWordmark suffix=" Bank" /> },
    { key: "gpaylater", label: "Gloobal PayLater", displayLabel: <GloobalWordmark suffix=" PayLater" /> },
    { key: "gcoin", label: "Gloobal Coin", displayLabel: <GloobalWordmark suffix=" Coin" /> },
    { key: "local", label: "Local Banks" }
  ].map(({ key, label, displayLabel }) => <button
    key={key}
    onClick={() => choosePayMethod(label)}
    className="v2-tap"
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      width: "100%",
      border: "1px solid #ECECF3",
      background: "#fff",
      borderRadius: 16,
      padding: "12px 14px",
      cursor: "pointer",
      textAlign: "left"
    }}
  ><span
    style={{
      width: 40,
      height: 40,
      borderRadius: 13,
      flexShrink: 0,
      background: key === "gbank" ? payMethodBankColor : "#F1EDFB",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      transition: "background 0.4s ease"
    }}
  >{key === "gbank" ? <img src={G_LOGO_DATA_URI} alt="" style={{ width: 32, height: 32, objectFit: "contain", filter: "brightness(0) invert(1)" }} /> : key === "gpaylater" ? <CreditCard4 size={19} color="#7C3AED" /> : key === "gcoin" ? <Coins3 size={19} color="#7C3AED" /> : <Landmark6 size={19} color="#7C3AED" />}</span><span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: "#14122B" }}>{displayLabel || label}</span><ChevronRight4 size={17} color="#B9B3CC" style={{ flexShrink: 0 }} /></button>)}</div></div></div>}{pinOpen && <div className="pin-overlay" role="dialog" aria-modal="true" aria-label="Enter OTP to confirm transfer"><div className="pin-modal"><button className="pin-close" onClick={requestClosePin} aria-label="Cancel"><X4 size={18} /></button><div className="pin-lock-icon"><Lock5 size={22} /></div><h3 className="pin-title">Enter OTP</h3>{
    /* Just the amount now, in a box — same "card holding the
       thing being verified" concept as registration's OTP
       screen (which shows the phone number in its own card),
       just showing the debit here instead of a long sentence.
       The G-H-2-H mark sits right on the box's own top edge. */
  }<div
    style={{
      position: "relative",
      margin: "18px 0 2px",
      padding: "14px 18px",
      borderRadius: T.radiusMd,
      border: `1px solid ${T.line}`,
      background: T.surfaceAlt,
      textAlign: "center"
    }}
  ><div
    style={{
      position: "absolute",
      top: -11,
      left: "50%",
      transform: "translateX(-50%)",
      display: "flex",
      justifyContent: "center",
      background: T.surface,
      padding: 3,
      borderRadius: "50%",
      zIndex: 1
    }}
  ><GH2HFlipCircle size={22} /></div><div
    style={{
      marginTop: 14,
      fontSize: receiptAmountFontSize(`\u2212${CURRENCY_SYMBOL[top.currency] || ""}${fmt(convertedAmount)}`, 26),
      fontWeight: 800,
      color: T.negative,
      fontFamily: T.fontDisplay,
      lineHeight: 1.15,
      overflowWrap: "anywhere"
    }}
  >
                −{CURRENCY_SYMBOL[top.currency] || ""}{fmt(convertedAmount)}</div></div>{
    /* Same dial pad used for PIN/OTP everywhere else in the app
       (registration, login) instead of this screen's own
       separate keypad — one PIN entry pattern app-wide. Reaching
       6 digits still auto-submits via the pin.length effect
       below, same as before. */
  }<div style={{ marginTop: 8 }}><PhoneDialPad
    value={pin}
    onChange={setPin}
    minLength={6}
    maxLength={6}
    masked={!pinRevealed}
    onToggleMask={() => setPinRevealed((v) => !v)}
  /></div></div></div>}{toast && <div className="toast">{toast.startsWith("Sending") && <span className="toast-icon"><Check3 size={12} strokeWidth={3} /></span>}<span>{toast}</span></div>}<ReceiptModal
    receipt={receipt}
    onClose={requestCloseReceipt}
    onDone={() => {
      setReceipt(null);
      setTransactionStatus("idle");
      onClose();
    }}
  />{
    /* Face ID + fingerprint — required after PIN, before the payment
       actually completes. Backing out just cancels the payment;
       nothing has been sent yet at this point. */
  }{showPayBiometric && <BiometricVerifyScreen
    onBack={() => setShowPayBiometric(false)}
    onVerify={handlePayBiometricVerify}
    scanning={payBiometricScanning}
  />}</div></div>;
}
var SendMoney_default = SendMoneyScreen;

