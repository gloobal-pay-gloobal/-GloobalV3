// src/App.jsx
import { useState as useState19, useEffect as useEffect15, useRef as useRef13 } from "react";
import {
  ChevronLeft as ChevronLeft4,
  Lock as Lock7,
  History as History8,
  RefreshCw as RefreshCw6,
  Fingerprint as Fingerprint2,
  ImageIcon
} from "lucide-react";


// The decorative white circle on the registration/phone screen read as a
// ghost sitting behind the REGISTRATION badge and the phone input card,
// so it is switched off. Kept behind a flag rather than deleted because
// it is a real interactive element (handleHeroCircleTap), not just art —
// flip this to true to bring it back.
var SHOW_PHONE_HERO_CIRCLE = false;

// src/App.jsx
function GloobalId() {
  const stageRef = useRef13(null);
  const particlesRef = useRef13([]);
  const elsRef = useRef13({});
  const rafRef = useRef13(null);
  const dimsRef = useRef13({ w: 0, h: 0 });
  const frameRef = useRef13(0);
  const [, forceRender] = useState19(0);
  const [verifying, setVerifying] = useState19(false);
  // Root-level toast — used by flows that complete above any single
  // screen (Scan & Pay, the business "Pay" sheet) after those screens
  // have already closed, so there's no longer a screen-local toast to
  // borrow. Same visual language as every other screen's toast pill.
  const [rootToast, setRootToast] = useState19(null);
  const showToast = (msg) => {
    setRootToast(msg);
    setTimeout(() => setRootToast(null), 1800);
  };
  const [heroCircleColors, setHeroCircleColors] = useState19(() => [
    randomLogoFlipColor(),
    randomLogoFlipColor(),
    randomLogoFlipColor(),
    randomLogoFlipColor()
  ]);
  useEffect15(() => {
    const interval = setInterval(() => {
      const i = Math.floor(Math.random() * 4);
      setHeroCircleColors((prev) => {
        const next = [...prev];
        next[i] = randomLogoFlipColor(prev[i]);
        return next;
      });
    }, 1200);
    return () => clearInterval(interval);
  }, []);
  const [heroCircleTapped, setHeroCircleTapped] = useState19(false);
  const handleHeroCircleTap = () => {
    setHeroCircleTapped(true);
    setTimeout(() => setHeroCircleTapped(false), 1400);
  };
  const [accountCreatedAt] = useState19(() => /* @__PURE__ */ new Date());
  const [essentialsIHaveEnough, setEssentialsIHaveEnough] = useState19(false);
  const handleToggleEssentialsIHaveEnough = () => setEssentialsIHaveEnough((v) => !v);
  const [sendMoneyHistory, setSendMoneyHistory] = useState19(SEND_MONEY_HISTORY_SEED);
  const { openComplaint, submitLocationObservation } = useProvenanceAndDisputes();
  // Best-effort, fire-and-forget location report for a transaction
  // that has ALREADY completed. This is deliberately the only
  // fire-and-forget piece left anywhere in the transaction flow — by
  // design, since location must never gate or delay financial
  // validity. It calls the same submitLocationObservation() interface
  // a real receiver device would call with its own reading; here it's
  // this device reporting its own (sender-role) observation.
  const reportSenderLocation = (txnId) => {
    (async () => {
      const observation = await captureBrowserGeo().catch(() => new LocationObservation({ status: LOCATION_STATUS.UNAVAILABLE }));
      submitLocationObservation({ txnId, role: "sender", observation });
    })();
  };
  const handleSendMoneyComplete = (entry) => {
    // Tags which side of the account (Personal/Creator) this
    // transaction belongs to, for the role-separated history/chart
    // split in DashboardScreen — not to be confused with the
    // sender/receiver location role used just above.
    setSendMoneyHistory((h) => [{ ...entry, role: activeShareRole }, ...h]);
    // Posting + completion + provenance + complaint window + asset-seed
    // eligibility already happened atomically inside executeTransaction
    // (called from SendMoneyScreen.completePayment, via
    // onExecuteTransaction) before this history entry ever existed.
    // Nothing financial is fired-and-forgotten here — only the location
    // report, which is independent by design (see reportSenderLocation).
    reportSenderLocation(entry.txnId);
  };
  // POST /api/transactions/send — the authoritative leg of a payment.
  // Runs before the local ledger posts (see SendMoneyScreen.completePayment),
  // so a server rejection means nothing is posted anywhere.
  //
  // Returns { ok } | { ok: false, reason } | { ok: true, skipped: true }.
  // `skipped` is deliberate and not a failure: a payment can only be
  // recorded server-side when BOTH parties are real registered accounts.
  // This build's receiver pickers are local placeholders, so anything
  // aimed at one of those has no counterparty in MongoDB to credit and
  // stays a local simulation. Scan & Pay against a real scanned Gloobal
  // ID, or any receiver carrying a resolvable symbolId, goes remote.
  const handleRemoteSend = async ({ amount, currency, receiver, pin: sendPin, payMethodLabel, memo, clientRequestId }) => {
    const senderSymbolId = registeredUser && registeredUser.symbolId;
    const receiverSymbolId = receiver && (receiver.gloobalId || receiver.symbolId || receiver.id);
    if (!senderSymbolId) return { ok: true, skipped: true, reason: "not signed in against the backend" };
    if (!receiverSymbolId) return { ok: true, skipped: true, reason: "receiver has no Gloobal ID" };
    try {
      await GloobalApi.sendTransaction({
        senderSymbolId,
        receiverSymbolId,
        amount,
        currency: currency || "INR",
        note: memo || "",
        pin: sendPin,
        payMethod: payMethodLabel || "",
        // The backend also runs a 15-second identical-resend guard; this
        // makes the dedup explicit rather than time-based.
        idempotencyKey: clientRequestId || ""
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err.message };
    }
  };
  const handleReportTransactionIssue = (txnId, reason) => openComplaint({ txnId, raisedBy: "sender", reason });
  const bankBalance = useBankBalance();
  const { executeTransaction, settleEssentialsToBank, settleReferralToBank, applyEssentialsPoolSubsidy } = useTransactionActions();
  const [usedQrCodes, setUsedQrCodes] = useState19(() => /* @__PURE__ */ new Set());
  const [showScanScreen, setShowScanScreen] = useState19(false);
  // Backdrop color behind the QR/scan area — same "pick one random
  // hero color per session" pattern as the Bank/Coin/About Us info
  // screens, so the scanner isn't locked to a single fixed tint.
  const [scanHeroColor] = useState19(() => randomLogoFlipColor());
  // Scan & Pay now follows the same options -> PIN -> biometric
  // sequence Send Money established, for real payments (amountCents >
  // 0). A zero-amount scan is just an identity confirm — no money
  // moves, so it skips straight to biometric, same as before.
  const [scanPayOptionsOpen, setScanPayOptionsOpen] = useState19(false);
  const [scanPayPinOpen, setScanPayPinOpen] = useState19(false);
  const [scanPayMethod, setScanPayMethod] = useState19(null);
  // "My Code" can double as a payment request: typing an amount here
  // embeds it into the SAME QR (encodeGloobalQR already supports
  // amountCents) instead of a separate request flow — the scanning
  // side already renders any nonzero amount as "Payment request".
  const [requestAmount, setRequestAmount] = useState19("");
  const [requestOpen, setRequestOpen] = useState19(false);
  const requestCents = Math.round((parseFloat(requestAmount) || 0) * 100);
  const [scanScreenTab, setScanScreenTab] = useState19("scan");
  const [scanCameraAccessGranted, setScanCameraAccessGranted] = useState19(false);
  const [scanPendingPayment, setScanPendingPayment] = useState19(null);
  const [scanError, setScanError] = useState19(null);
  const [showScanBiometric, setShowScanBiometric] = useState19(false);
  const [scanBiometricScanning, setScanBiometricScanning] = useState19(false);
  const handleQrScanned = (rawCode) => {
    setScanError(null);
    if (usedQrCodes.has(rawCode)) {
      setScanError("This QR code has already been used.");
      return;
    }
    const decoded = decodeGloobalQR(rawCode);
    if (!decoded) {
      setScanError("This isn't a valid Gloobal QR code.");
      return;
    }
    setScanPendingPayment({ ...decoded, rawCode });
  };
  // Scan & Pay runs through the exact same canonical executeTransaction
  // lifecycle as Send Money and Pay a Business — no separate posting
  // path. A real txnId is minted up front and the whole risk-check +
  // post + provenance + complaint-window + grant-eligibility sequence
  // happens in one atomic call, synchronously, before the UI shows
  // success. The paid QR also becomes a normal history entry, so it's
  // reportable from the same Receipt/History UI Send Money already
  // uses — no new screens.
  const handleScanBiometricVerify = () => {
    if (scanBiometricScanning || !scanPendingPayment) return;
    setScanBiometricScanning(true);
    setTimeout(() => {
      setScanBiometricScanning(false);
      setShowScanBiometric(false);
      setUsedQrCodes((prev) => new Set(prev).add(scanPendingPayment.rawCode));
      const amount = scanPendingPayment.amountCents / 100;
      const ccy = CURRENCY_SYMBOL[COUNTRY_CURRENCY[dialCountry.iso] || "USD"] || "$";
      if (amount > 0) {
        const txnId = genTxnId();
        const now = /* @__PURE__ */ new Date();
        // My Essentials daily pool applies here — before the real
        // payment, as its own separate step (see
        // TransactionOrchestrator#applyEssentialsPoolSubsidy). Not a
        // payment method the person picks; it's a standing daily
        // subsidy from the platform's own reserve that just makes
        // part of this Scan & Pay already covered by the time the
        // real risk check runs. Capped at today's baseline for this
        // country; whatever's left resets tomorrow.
        const dailyEssentialsLimit = computeEssentialsBaseline(dialCountry.iso).dailyTotal;
        applyEssentialsPoolSubsidy({ requestedAmount: amount, dailyLimit: dailyEssentialsLimit, now });
        const result = executeTransaction({
          txnId,
          amount,
          payMethodLabel: scanPayMethod,
          memo: "Scan & Pay",
          name: scanPendingPayment.gloobalId,
          shareRatePercent: 0,
          time: formatClockTime(now),
          now,
          clientRequestId: generateRequestId()
        });
        if (result.ok) {
          const historyEntry = {
            name: scanPendingPayment.gloobalId,
            date: now.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            amount,
            status: "completed",
            method: scanPayMethod && scanPayMethod.includes("PayLater") ? "paylater" : "bank",
            time: formatClockTime(now),
            txnId,
            shareRate: 0,
            ledgerRecordId: result.ledgerRecordId,
            role: activeShareRole
          };
          setSendMoneyHistory((h) => [historyEntry, ...h]);
          reportSenderLocation(txnId);
        } else {
          setScanError(result.reason || "Payment failed \u2014 insufficient balance");
        }
      }
      setShowScanScreen(false);
      setScanPendingPayment(null);
      showToast(amount > 0 ? `Paid ${ccy}${amount.toFixed(2)} \u2014 verified and locked` : "Gloobal ID verified and locked");
    }, 900);
  };
  const [demoScanTarget] = useState19(() => {
    const demoId = genSuggestedId(12);
    return { name: "Priya S.", code: encodeGloobalQR({ gloobalId: demoId, amountCents: 25e3 }) };
  });
  // Business/travel "Pay" flow (Dashboard's More sheet) also runs
  // through executeTransaction — the same one canonical lifecycle as
  // Send Money and Scan & Pay. No separate ledger-posting path is left
  // anywhere in the app; an Essentials grant can only ever come from a
  // real, first-time completion inside executeTransaction.
  const handlePayBusiness = ({ key, label, chip, amount, cashbackRate, payMethodLabel = null }) => {
    if (amount <= 0) return;
    const txnId = genTxnId();
    const now = /* @__PURE__ */ new Date();
    const methodKey = !payMethodLabel ? "bank" : payMethodLabel.includes("PayLater") ? "paylater" : "bank";
    const result = executeTransaction({
      txnId,
      amount,
      payMethodLabel,
      memo: `Pay ${label}`,
      name: label,
      shareRatePercent: (cashbackRate || 0) * 100,
      time: formatClockTime(now),
      now,
      clientRequestId: generateRequestId()
    });
    if (!result.ok) {
      showToast(result.reason || "Insufficient balance");
      return;
    }
    const historyEntry = {
      name: label,
      date: now.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      amount,
      status: "completed",
      method: methodKey,
      time: formatClockTime(now),
      txnId,
      shareRate: (cashbackRate || 0) * 100,
      ledgerRecordId: result.ledgerRecordId,
      role: activeShareRole
    };
    setSendMoneyHistory((h) => [historyEntry, ...h]);
    reportSenderLocation(txnId);
  };
  const assetSeeds = useEssentialsGrants();
  const paylaterHistory = usePaylaterHistory();
  const handleSettleAssetsToBank = (amount) => {
    if (amount <= 0) return;
    settleEssentialsToBank(amount);
  };
  const handleSettleReferralToBank = (amount) => {
    if (amount <= 0) return;
    settleReferralToBank(amount);
  };
  const handleExecuteTransaction = executeTransaction;
  const [stage, setStage] = useState19("phone");
  const [flipping, setFlipping] = useState19(false);
  const [secureId, setSecureId] = useState19("");
  // A second, separate Gloobal ID for the Creator side of the account
  // — scanning/showing "your code" while in Creator mode now shares a
  // real, different identifier than Personal mode, not the same
  // secureId reused for both. Generated once per account, stably, the
  // same way suggestedRegId is.
  const [creatorId] = useState19(() => genSuggestedId(12));
  // Mirrors DashboardScreen's own shareRole (that component owns the
  // toggle and all of its UI) up to this level, purely so the Scan
  // screen — rendered here, outside DashboardScreen — knows which of
  // the two Gloobal IDs to show/act as under "My Code".
  const [activeShareRole, setActiveShareRole] = useState19("user");
  // Same mirror pattern — DashboardScreen owns myShareRate (the
  // Creator Share % this account offers), the QR edge badge here just
  // needs to read the current value.
  const [activeMyShareRate, setActiveMyShareRate] = useState19(1);
  const [scanShareIconFlipped, setScanShareIconFlipped] = useState19(false);
  useEffect15(() => {
    const interval = setInterval(() => setScanShareIconFlipped((f) => !f), 2500);
    return () => clearInterval(interval);
  }, []);
  const [suggestedRegId] = useState19(() => genSuggestedId(12));
  const [referralCode, setReferralCode] = useState19("");
  const [pin, setPin] = useState19("");
  const [otp, setOtp] = useState19("123456");
  const [dialCountry, setDialCountry] = useState19(() => TOP_COUNTRIES.find((c) => c.iso === "IN") || TOP_COUNTRIES[0]);
  const [phoneNumber, setPhoneNumber] = useState19("");
  const [showPicker, setShowPicker] = useState19(false);
  const [phoneDialOpen, setPhoneDialOpen] = useState19(false);
  const [showLoginFace, setShowLoginFace] = useState19(false);
  const [isLoginAttempt, setIsLoginAttempt] = useState19(false);
  const [loginEntryMode, setLoginEntryMode] = useState19("id");
  const [loginMobileBuffer, setLoginMobileBuffer] = useState19("");
  const [loginMobileCountry, setLoginMobileCountry] = useState19(null);
  const [showLoginPicker, setShowLoginPicker] = useState19(false);
  const [loginCountrySearch, setLoginCountrySearch] = useState19("");
  const [countrySearch, setCountrySearch] = useState19("");
  const [activeScreen, setActiveScreen] = useState19(null);
  const requestCloseActiveScreen = useBackClose(activeScreen !== null, () => setActiveScreen(null));
  const [showDiagnostics, setShowDiagnostics] = useState19(() => typeof window !== "undefined" && window.location.hash === "#diagnostics");
  useEffect15(() => {
    const onHashChange = () => setShowDiagnostics(window.location.hash === "#diagnostics");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  const closeDiagnostics = () => {
    setShowDiagnostics(false);
    if (typeof window !== "undefined" && window.location.hash === "#diagnostics") {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  };
  const [dashboardHistoryDirection, setDashboardHistoryDirection] = useState19(null);
  const [pendingOpenMyShare, setPendingOpenMyShare] = useState19(false);
  const [secureIdRevealed, setSecureIdRevealed] = useState19(false);
  const [referralRevealed, setReferralRevealed] = useState19(false);
  const [otpRevealed, setOtpRevealed] = useState19(false);
  const [pinRevealed, setPinRevealed] = useState19(false);
  const [loginMobileRevealed, setLoginMobileRevealed] = useState19(false);
  const [regBiometricScanning, setRegBiometricScanning] = useState19(false);
  const [profilePhoto, setProfilePhoto] = useState19(G_LOGO_DATA_URI);
  const [docType, setDocType] = useState19(null);
  const [documentedName, setDocumentedName] = useState19("");
  const [loginAuthPin, setLoginAuthPin] = useState19("");
  const [loginAuthRevealed, setLoginAuthRevealed] = useState19(false);
  const [loginBiometricScanning, setLoginBiometricScanning] = useState19(false);
  const SECURE_ID_LENGTH = 12;
  const REFERRAL_LENGTH = 12;
  const PIN_LENGTH = 6;
  const OTP_LENGTH2 = 6;

  // --- Real backend (Express + MongoDB Atlas, on Render) ----------------
  //
  // Identity is server-owned from here down. Every stage below calls the
  // real API in backend/services/api/ instead of the setTimeout mocks it
  // used to, so an account created here exists in MongoDB and can be
  // logged into from any other Gloobal frontend against the same backend.
  //
  // authError carries the backend's own message rather than a rewritten
  // one — it already says useful things like "PIN must be 4 to 6 digits"
  // and "Please verify OTP before registration".
  const [authError, setAuthError] = useState19(null);
  const [authBusy, setAuthBusy] = useState19(false);
  // What the backend returned for this account. The whole app keys off
  // registeredUser.symbolId once past registration.
  const [registeredUser, setRegisteredUser] = useState19(null);

  // The backend normalises 10/11/12-digit forms server-side, but sending
  // the full international number means non-India dial codes survive
  // instead of being assumed to be +91.
  // (The login-side equivalent is built inside handleSubmitSecureId —
  // effectiveLoginCountry is declared further down this component.)
  const fullMobileNumber = `${dialCountry.dialCode || ""}${phoneNumber.replace(/\D/g, "")}`;

  // Render's free tier sleeps when idle and takes 20-50s to wake. Firing
  // one throwaway request at mount means the backend is already booting
  // while the person picks a country and types their number, instead of
  // that wait landing inside the OTP call's own timeout.
  useEffect15(() => {
    GloobalApi.warmUp();
  }, []);

  // Restore whose account this device last used. Not a security token and
  // not a login: it only pre-fills the identity, and reaching the
  // dashboard still costs the PIN check below.
  useEffect15(() => {
    const restored = GloobalApi.loadSession();
    if (!restored) return;
    setRegisteredUser(restored.user);
    if (restored.user.symbolId) setSecureId(restored.user.symbolId);
    if (restored.phoneNumber) setPhoneNumber(restored.phoneNumber);
    setIsLoginAttempt(true);
    setStage("secureId");
  }, []);

  // Any stage change clears a stale error so a fixed problem doesn't keep
  // showing the message from the previous attempt.
  useEffect15(() => {
    setAuthError(null);
  }, [stage]);
  const flipTo = (next) => {
    setFlipping(true);
    setTimeout(() => {
      setStage(next);
      setFlipping(false);
    }, 220);
  };
  const effectiveLoginCountry = loginMobileCountry || dialCountry;
  const [loginMinLen, loginMaxLen] = mobileDigitRange(effectiveLoginCountry.iso);
  const loginMobileComplete = loginMobileBuffer.length >= loginMinLen;
  const handleSubmitSecureId = async () => {
    // Login by mobile number: resolve it to the Secure ID behind it, so
    // the PIN step that follows has a real symbolId to authenticate.
    if (isLoginAttempt && loginEntryMode === "mobile") {
      if (!loginMobileComplete || authBusy) return;
      setAuthBusy(true);
      setAuthError(null);
      try {
        const identifier = `${effectiveLoginCountry.dialCode || ""}${loginMobileBuffer.replace(/\D/g, "")}`;
        const user = await GloobalApi.resolveUser(identifier);
        setRegisteredUser(user);
        setSecureId(user.symbolId || "");
        flipTo("loginAuth");
      } catch (err) {
        setAuthError(err.message);
      } finally {
        setAuthBusy(false);
      }
      return;
    }
    if (secureId.length !== SECURE_ID_LENGTH || authBusy) return;
    if (isLoginAttempt) {
      flipTo("loginAuth");
      return;
    }
    // Registration: warn early if this ID is already somebody's. Only an
    // explicit "taken" blocks — an unclear answer (cold start, 5xx) lets
    // the person continue, because POST /api/register-symbol is the real
    // uniqueness authority and a flaky lookup must not lock anyone out.
    setAuthBusy(true);
    setAuthError(null);
    try {
      const { available } = await GloobalApi.checkSymbolAvailability(secureId);
      if (available === false) {
        setAuthError("That Gloobal ID is already taken. Try another.");
        return;
      }
      flipTo("referral");
    } finally {
      setAuthBusy(false);
    }
  };
  // The referral code is only carried here; it is submitted as part of
  // registration at the PIN step. Skipping leaves it empty, which the
  // backend accepts.
  const handleSubmitReferral = () => {
    if (referralCode.length === REFERRAL_LENGTH) flipTo("pin");
  };
  // The account is actually created here — this is the one write that
  // matters. Two calls in order: register-symbol creates the User in
  // MongoDB, then pin/set stores its bcrypt PIN hash. If the PIN call
  // fails the user exists without a PIN, which /api/pin/set can retry, so
  // the error is surfaced rather than rolled back.
  const handleSubmitPin = async () => {
    if (pin.length !== PIN_LENGTH || authBusy) return;
    setAuthBusy(true);
    setAuthError(null);
    try {
      const result = await GloobalApi.register({
        fullName: fullMobileNumber,
        mobileNumber: fullMobileNumber,
        symbolId: secureId,
        referredBy: referralCode || ""
      });
      setRegisteredUser(result.user);
      await GloobalApi.setPin(result.user.symbolId || secureId, pin);
      // A bad referral code never fails the registration, so this is the
      // only place it can be reported.
      if (result.referralWarning) setAuthError(result.referralWarning);
      flipTo("biometric");
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthBusy(false);
    }
  };
  const handleRegBiometricVerify = () => {
    if (regBiometricScanning) return;
    setRegBiometricScanning(true);
    setTimeout(() => {
      setRegBiometricScanning(false);
      flipTo("profile");
    }, 700);
  };
  const handleSubmitProfile = () => {
    if (!docType || !documentedName.trim()) return;
    // Persist whose account this device just finished registering, so a
    // refresh comes back to the lock screen instead of the phone screen.
    if (registeredUser) GloobalApi.saveSession(registeredUser, phoneNumber);
    flipTo("dashboard");
  };
  // POST /api/login — Secure ID + PIN, verified server-side against the
  // bcrypt hash. The backend locks the account for 10 minutes after 5 bad
  // attempts and says so in its message, which is surfaced as-is.
  const handleSubmitLoginAuth = async () => {
    if (loginAuthPin.length !== PIN_LENGTH || authBusy) return;
    setAuthBusy(true);
    setAuthError(null);
    try {
      const symbolId = (registeredUser && registeredUser.symbolId) || secureId;
      const result = await GloobalApi.login(symbolId, loginAuthPin);
      setRegisteredUser(result.user);
      GloobalApi.saveSession(result.user, phoneNumber);
      setLoginAuthPin("");
      flipTo("loginBiometric");
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthBusy(false);
    }
  };
  const handleLoginBiometricVerify = () => {
    if (loginBiometricScanning) return;
    setLoginBiometricScanning(true);
    setTimeout(() => {
      setLoginBiometricScanning(false);
      flipTo("dashboard");
    }, 700);
  };
  const handleBackFromSecureId = () => {
    if (isLoginAttempt) {
      setIsLoginAttempt(false);
      setLoginEntryMode("id");
      setLoginMobileBuffer("");
      setLoginMobileCountry(null);
      setShowLoginFace(false);
      flipTo("phone");
    } else {
      flipTo("otp");
    }
  };
  const requestBackFromSecureId = useBackClose(stage === "secureId", handleBackFromSecureId);
  const requestBackFromReferral = useBackClose(stage === "referral", () => flipTo("secureId"));
  const requestBackFromPin = useBackClose(stage === "pin", () => flipTo("referral"));
  const requestBackFromRegBiometric = useBackClose(stage === "biometric", () => flipTo("pin"));
  const requestBackFromProfile = useBackClose(stage === "profile", () => flipTo("biometric"));
  const requestBackFromLoginAuth = useBackClose(stage === "loginAuth", () => {
    setLoginAuthPin("");
    flipTo("secureId");
  });
  const requestBackFromLoginBiometric = useBackClose(stage === "loginBiometric", () => flipTo("loginAuth"));
  useEffect15(() => {
    const stage2 = stageRef.current;
    dimsRef.current = { w: stage2.clientWidth, h: stage2.clientHeight };
    for (let i = 0; i < 8; i++) {
      const p = makeParticle(dimsRef.current.w, dimsRef.current.h);
      p.y = Math.random() * dimsRef.current.h;
      p.spawnY = p.y + dimsRef.current.h * 0.5;
      p.scale = 1;
      p.opacity = 0.15 + Math.random() * 0.5;
      particlesRef.current.push(p);
    }
    forceRender((n) => n + 1);
    const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;
    const tick = () => {
      frameRef.current += 1;
      const { w, h } = dimsRef.current;
      const arr = particlesRef.current;
      for (const p of arr) {
        p.x += p.vx;
        p.y += p.vy;
        p.twinklePhase += p.twinkleSpeed;
      }
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const a = arr[i];
          const b = arr[j];
          const ra = Math.max(a.pw, a.ph) * a.scale / 2;
          const rb = Math.max(b.pw, b.ph) * b.scale / 2;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1e-4;
          const minDist = (ra + rb) * 0.9;
          if (dist < minDist) {
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = minDist - dist;
            a.x -= nx * overlap * 0.5;
            a.y -= ny * overlap * 0.5;
            b.x += nx * overlap * 0.5;
            b.y += ny * overlap * 0.5;
            const push = 0.18;
            a.vx -= nx * push;
            a.vy -= ny * push * 0.25;
            b.vx += nx * push;
            b.vy += ny * push * 0.25;
            a.vx = Math.max(-1.3, Math.min(1.3, a.vx));
            b.vx = Math.max(-1.3, Math.min(1.3, b.vx));
            a.vy = Math.max(-1.6, Math.min(-0.15, a.vy));
            b.vy = Math.max(-1.6, Math.min(-0.15, b.vy));
          }
        }
      }
      for (const p of arr) {
        const distFromBottom = h - p.y;
        if (distFromBottom < 60) {
          p.opacity = Math.min(0.9, distFromBottom / 60);
        } else {
          p.opacity = 0.35 + Math.abs(Math.sin(p.twinklePhase)) * 0.55;
        }
        const traveled = p.spawnY - p.y;
        const growthRatio = Math.min(1, traveled / (h * 0.5));
        const eased = 1 - Math.pow(1 - growthRatio, 3);
        p.scale = GROWTH_START_SCALE + (1 - GROWTH_START_SCALE) * eased;
        const el = elsRef.current[p.id];
        if (el) {
          el.style.transform = `translate(${p.x}px, ${p.y}px) scale(${p.scale})`;
          el.style.opacity = p.opacity;
        }
      }
      let changed = false;
      particlesRef.current = arr.filter((p) => {
        const alive = p.y > -30 && p.x > -30 && p.x < w + 30;
        if (!alive) changed = true;
        return alive;
      });
      if (frameRef.current % 10 === 0 && particlesRef.current.length < MAX_PARTICLES) {
        particlesRef.current.push(makeParticle(w, h));
        changed = true;
      }
      if (changed) forceRender((n) => n + 1);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);
  // POST /api/otp/send. The backend records an Otp document against this
  // number; register-symbol later refuses (403) unless it finds a verified
  // one, so this step is what makes registration possible at all.
  const handleVerify = async () => {
    if (verifying || stage !== "phone") return;
    const digits = phoneNumber.replace(/\D/g, "");
    const [minLen, maxLen] = mobileDigitRange(dialCountry.iso);
    if (digits.length < minLen || digits.length > maxLen) return;
    setVerifying(true);
    setAuthError(null);
    try {
      await GloobalApi.sendOtp(fullMobileNumber, "registration");
      flipTo("otp");
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setVerifying(false);
    }
  };
  const [otpVerifying, setOtpVerifying] = useState19(false);
  // POST /api/otp/verify. On success the backend marks the OTP verified;
  // nothing is created yet — the account itself is written at the PIN step.
  const handleSubmitOtp = async () => {
    if (otp.length !== OTP_LENGTH2 || otpVerifying) return;
    setOtpVerifying(true);
    setAuthError(null);
    try {
      await GloobalApi.verifyOtp(fullMobileNumber, otp, "registration");
      flipTo("secureId");
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setOtpVerifying(false);
    }
  };
  const handleStartOver = () => {
    // Explicit sign-out: drop the remembered identity too, or the mount
    // effect restores it straight back to the lock screen.
    GloobalApi.clearSession();
    setRegisteredUser(null);
    setAuthError(null);
    setVerifying(false);
    setPhoneNumber("");
    setPhoneDialOpen(false);
    setShowLoginFace(false);
    setIsLoginAttempt(false);
    setLoginEntryMode("id");
    setLoginMobileBuffer("");
    setLoginMobileCountry(null);
    setShowLoginPicker(false);
    setLoginCountrySearch("");
    setSecureId("");
    setReferralCode("");
    setPin("");
    setOtp("123456");
    setLoginAuthPin("");
    setLoginBiometricScanning(false);
    flipTo("phone");
  };
  return <div
    ref={stageRef}
    style={{
      position: "fixed",
      inset: 0,
      width: "100%",
      height: "100%",
      background: "#ffffff",
      overflow: "hidden",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    }}
  >{particlesRef.current.map((p) => <div
    key={p.id}
    ref={(el) => {
      if (el) elsRef.current[p.id] = el;
      else delete elsRef.current[p.id];
    }}
    style={{
      position: "absolute",
      top: -(p.ph / 2),
      left: -(p.pw / 2),
      width: p.pw,
      height: p.ph,
      userSelect: "none",
      pointerEvents: "none",
      willChange: "transform, opacity",
      opacity: p.opacity
    }}
  ><FlagSignShape sign={p.sign} flag={p.flag} box={p.box} /></div>)}{
    /* Center focal circle — fills the previously-empty middle of
       this background. Outer wrapper is static (fixes true
       centering — an earlier version baked translate into the spin
       keyframe itself, which could drift). Center stays plain white;
       the boundary always has a subtle low-opacity colored glow, and
       tapping the circle boosts that same glow to a higher opacity
       briefly before it settles back down. Rotation shows as a
       subtle white shine sweeping around the ring. */
  }{SHOW_PHONE_HERO_CIRCLE && stage === "phone" && !phoneNumber && !phoneDialOpen && <button
    onClick={handleHeroCircleTap}
    aria-label="Gloobal ID"
    style={{
      position: "absolute",
      top: "38%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: 176,
      height: 176,
      borderRadius: "50%",
      background: "#fff",
      border: "none",
      padding: 0,
      cursor: "pointer",
      boxShadow: heroCircleTapped ? `0 0 0 1px rgba(0,0,0,0.04), 0 0 30px 8px ${heroCircleColors[0]}70, 0 0 55px 16px ${heroCircleColors[2]}55` : `0 0 0 1px rgba(0,0,0,0.04), 0 0 22px 4px ${heroCircleColors[0]}28, 0 0 40px 8px ${heroCircleColors[2]}1c`,
      transition: "box-shadow 0.4s ease",
      overflow: "hidden",
      zIndex: 0
    }}
  ><div
    style={{
      position: "absolute",
      inset: -20,
      background: "conic-gradient(rgba(255,255,255,0) 0deg, rgba(255,255,255,0.9) 25deg, rgba(255,255,255,0) 70deg, rgba(255,255,255,0) 360deg)",
      animation: "pureSpin 4s linear infinite",
      pointerEvents: "none"
    }}
  /></button>}{
    /* Back — sits in the same top-left corner regardless of stage,
       separate from the flipping card itself so it never overlaps or
       shifts the card's own corner controls (eye toggles, flip icons).
       The Secure ID / Referral corner tab used to sit left-aligned here
       too and could collide with this button on shorter screens; it's
       now centered on the card instead, so the two can never overlap.
       Covers the steps that had no way back: registration's Secure ID
       (→ OTP), login's Secure ID (→ phone), and Referral (→ Secure ID). */
  }{(stage === "secureId" || stage === "referral") && <button
    onClick={stage === "referral" ? requestBackFromReferral : requestBackFromSecureId}
    aria-label="Back"
    className="v2-tap"
    style={{
      position: "absolute",
      top: "calc(18px + env(safe-area-inset-top, 0px))",
      left: "calc(18px + env(safe-area-inset-left, 0px))",
      width: 40,
      height: 40,
      borderRadius: "50%",
      border: `1px solid ${T.line}`,
      background: T.surface,
      color: T.ink,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      boxShadow: T.shadowCard,
      zIndex: 25
    }}
  ><ChevronLeft4 size={20} /></button>}{
    /* "Gloobal ID" wordmark — now shown on every early registration/
       login screen: phone entry, Secure ID (creating a new one,
       logging in with an existing one, or logging in by phone), and
       referral — not just the very first phone screen. */
  }{(stage === "phone" || stage === "secureId" || stage === "referral") && <div
    style={{
      position: "absolute",
      top: "calc(22px + env(safe-area-inset-top, 0px))",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 20,
      fontSize: 22,
      fontWeight: 800,
      letterSpacing: 0.5,
      color: T.ink,
      fontFamily: T.fontDisplay
    }}
  ><GloobalWordmark suffix=" ID" withSymbols /></div>}<div
    style={{
      position: "absolute",
      top: "calc(74px + env(safe-area-inset-top, 0px))",
      left: "50%",
      bottom: "6%",
      transform: "translateX(-50%)",
      width: "92%",
      maxWidth: 340,
      zIndex: 20,
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-end",
      overflowY: "auto",
      WebkitOverflowScrolling: "touch"
    }}
  ><div style={{ perspective: 800, position: "relative", flexShrink: 0 }}><div
    style={{
      position: "relative",
      width: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      transform: flipping ? "rotateY(90deg)" : "rotateY(0deg)",
      transition: "transform 0.22s ease"
    }}
  >{
    /* The Secure ID / Referral card itself — unmoved, unchanged:
       same shadows, border radius, corner label, and counter as
       before. Just the card; the dial and button now live below
       it instead of inside it. */
  }<div
    style={{
      position: "relative",
      zIndex: 1,
      width: "100%",
      minHeight: stage === "phone" ? 96 : 100,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "18px 14px",
      borderRadius: T.radiusLg,
      boxShadow: T.shadowFloat,
      border: `1px solid ${T.line}`,
      background: T.surface,
      boxSizing: "border-box",
      overflow: "visible"
    }}
  >{
    /* Corner shine — soft, low-opacity colored glows at each
       corner, clipped to their own inset wrapper so the
       card's own overflow:visible (needed for the corner
       label/counter) stays untouched. Center stays plain
       white — this is decoration at the edges only. */
  }<div style={{ position: "absolute", inset: 0, borderRadius: T.radiusLg, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}><div style={{ position: "absolute", top: -30, left: -30, width: 100, height: 100, borderRadius: "50%", background: `radial-gradient(circle, ${POSITION_COLORS[0]}22, transparent 70%)` }} /><div style={{ position: "absolute", top: -30, right: -30, width: 100, height: 100, borderRadius: "50%", background: `radial-gradient(circle, ${POSITION_COLORS[2]}22, transparent 70%)` }} /><div style={{ position: "absolute", bottom: -30, left: -30, width: 100, height: 100, borderRadius: "50%", background: `radial-gradient(circle, ${POSITION_COLORS[3]}1c, transparent 70%)` }} /><div style={{ position: "absolute", bottom: -30, right: -30, width: 100, height: 100, borderRadius: "50%", background: `radial-gradient(circle, ${POSITION_COLORS[1]}1c, transparent 70%)` }} /></div>{stage === "phone" && <PhoneConnector
    country={dialCountry}
    phoneNumber={phoneNumber}
    onOpenPicker={() => setShowPicker(true)}
    onOpenDial={() => setPhoneDialOpen(true)}
    dialOpen={phoneDialOpen}
    onActivate={handleVerify}
    verifying={verifying}
    showLogin={showLoginFace}
    onLoginTap={() => {
      setIsLoginAttempt(true);
      setLoginEntryMode("id");
      setLoginMobileBuffer("");
      setLoginMobileCountry(null);
      flipTo("secureId");
    }}
  />}{
    /* Flip to log in — on the card's own boundary now, not on
       the call button, same treatment as the Secure ID card's
       flip icon. Keeps a slow, continuous spin on its own (not
       tied to being tapped) so it reads as "this can be flipped"
       at a glance instead of sitting there looking static. */
  }{stage === "phone" && <button
    onClick={() => {
      setShowLoginFace(true);
      setIsLoginAttempt(true);
      setLoginEntryMode("id");
      setLoginMobileBuffer("");
      setLoginMobileCountry(null);
      flipTo("secureId");
    }}
    aria-label="Flip to log in"
    className="v2-tap"
    style={{
      position: "absolute",
      top: -20,
      right: -18,
      width: 48,
      height: 48,
      borderRadius: "50%",
      border: `1.5px solid ${T.line}`,
      background: T.surface,
      color: T.accent,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      boxShadow: T.shadowRaised,
      zIndex: 3
    }}
  ><RefreshCw6 size={22} style={{ animation: "iconAttention 2s linear infinite" }} /></button>}{stage === "phone" && <span
    style={{
      position: "absolute",
      top: -11,
      left: 16,
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 7,
      padding: "3px 9px",
      fontSize: 10,
      fontWeight: 800,
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: T.accent,
      boxShadow: T.shadowCard,
      minWidth: 44,
      textAlign: "center",
      whiteSpace: "nowrap"
    }}
  ><CyclingBadge words={["Registration", <GloobalWordmark key="g" withSymbols />, "Id"]} intervalMs={2600} /></span>}{stage === "secureId" && <span
    style={{
      position: "absolute",
      top: -11,
      left: 16,
      transform: "none",
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 7,
      padding: "3px 9px",
      fontSize: 10,
      fontWeight: 800,
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: T.accent,
      boxShadow: T.shadowCard,
      minWidth: 44,
      textAlign: "center",
      whiteSpace: "nowrap"
    }}
  >{isLoginAttempt ? <CyclingBadge words={["Login", <GloobalWordmark key="g" withSymbols />, "Id"]} intervalMs={2600} /> : <CyclingBadge words={["Create", "Secure", <GloobalWordmark key="g" withSymbols />, "Id"]} intervalMs={2600} />}</span>}{stage === "referral" && <span
    style={{
      position: "absolute",
      top: -11,
      left: 16,
      transform: "none",
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 7,
      padding: "3px 9px",
      fontSize: 10,
      fontWeight: 800,
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: T.accent,
      boxShadow: T.shadowCard,
      whiteSpace: "nowrap"
    }}
  >
                  Referral ID
                </span>}{stage === "otp" && <span
    style={{
      position: "absolute",
      top: -11,
      left: 16,
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 7,
      padding: "3px 9px",
      fontSize: 10,
      fontWeight: 800,
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: T.accent,
      boxShadow: T.shadowCard
    }}
  >
                  Verify OTP
                </span>}{
    /* Edit number — flips back to the phone step, same corner
       spot the flip-to-login icon uses on that step. */
  }{stage === "otp" && <button
    onClick={() => flipTo("phone")}
    aria-label="Edit phone number"
    className="v2-tap"
    style={{
      position: "absolute",
      top: -11,
      right: 16,
      background: "none",
      border: "none",
      color: T.accent2,
      fontSize: 10.5,
      fontWeight: 700,
      cursor: "pointer",
      padding: "3px 4px"
    }}
  >
                  Edit number
                </button>}{
    /* Eye toggle: mask/reveal the code — same on both
       registration and login, but only relevant in ID mode.
       Shifted left of its usual spot on login so it doesn't
       collide with the bigger flip-to-mobile icon in the
       top-right corner. */
  }{
    /* Eye toggle for OTP — shifted left of "Edit number" so the
       two controls don't collide in the same top-right corner. */
  }{stage === "otp" && <button
    onClick={() => setOtpRevealed((v) => !v)}
    aria-label={otpRevealed ? "Hide OTP" : "Show OTP"}
    className="v2-tap"
    style={{
      position: "absolute",
      top: -11,
      right: 90,
      width: 24,
      height: 24,
      borderRadius: "50%",
      border: `1px solid ${T.line}`,
      background: T.surface,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      boxShadow: T.shadowCard,
      zIndex: 2
    }}
  ><MaskEyeIcon open={otpRevealed} color={T.inkSoft} /></button>}{stage === "secureId" && (!isLoginAttempt || loginEntryMode === "id") && <button
    onClick={() => setSecureIdRevealed((v) => !v)}
    aria-label={secureIdRevealed ? "Hide Secure ID" : "Show Secure ID"}
    className="v2-tap"
    style={{
      position: "absolute",
      top: -11,
      right: isLoginAttempt ? 68 : 16,
      width: 24,
      height: 24,
      borderRadius: "50%",
      border: `1px solid ${T.line}`,
      background: T.surface,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      boxShadow: T.shadowCard,
      zIndex: 2
    }}
  ><MaskEyeIcon open={secureIdRevealed} color={T.inkSoft} /></button>}{
    /* Eye toggle for the mobile login number — same boundary
       spot the Secure ID eye uses in ID mode (right: 68, clear
       of the bigger flip-to-mobile icon in the corner). */
  }{stage === "secureId" && isLoginAttempt && loginEntryMode === "mobile" && <button
    onClick={() => setLoginMobileRevealed((v) => !v)}
    aria-label={loginMobileRevealed ? "Hide mobile number" : "Show mobile number"}
    className="v2-tap"
    style={{
      position: "absolute",
      top: -11,
      right: 68,
      width: 24,
      height: 24,
      borderRadius: "50%",
      border: `1px solid ${T.line}`,
      background: T.surface,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      boxShadow: T.shadowCard,
      zIndex: 2
    }}
  ><MaskEyeIcon open={loginMobileRevealed} color={T.inkSoft} /></button>}{
    /* Flip to mobile — login only. Fixed to the card's top-right
       corner (not tied to the card's height, which changes
       between ID and mobile content) so it's always in the same
       reachable spot in both modes. Twice the size of the eye
       toggle, and visibly rotates on tap. */
  }{stage === "secureId" && isLoginAttempt && <button
    onClick={() => setLoginEntryMode((m) => m === "id" ? "mobile" : "id")}
    aria-label={`Switch to ${loginEntryMode === "id" ? "mobile number" : "Gloobal ID"}`}
    className="v2-tap"
    style={{
      position: "absolute",
      top: -20,
      right: -18,
      width: 48,
      height: 48,
      borderRadius: "50%",
      border: `1.5px solid ${T.line}`,
      background: T.surface,
      color: T.accent,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      boxShadow: T.shadowRaised,
      zIndex: 3
    }}
  ><RefreshCw6
    size={22}
    style={{
      transform: loginEntryMode === "mobile" ? "rotate(180deg)" : "rotate(0deg)",
      transition: "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)"
    }}
  /></button>}{stage === "referral" && <button
    onClick={() => setReferralRevealed((v) => !v)}
    aria-label={referralRevealed ? "Hide Referral ID" : "Show Referral ID"}
    className="v2-tap"
    style={{
      position: "absolute",
      top: -11,
      right: 16,
      width: 24,
      height: 24,
      borderRadius: "50%",
      border: `1px solid ${T.line}`,
      background: T.surface,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      boxShadow: T.shadowCard
    }}
  ><MaskEyeIcon open={referralRevealed} color={T.inkSoft} /></button>}{stage === "secureId" && (!isLoginAttempt || loginEntryMode === "id") && <SymbolChipRow length={SECURE_ID_LENGTH} value={secureId} masked={!secureIdRevealed} />}{stage === "secureId" && isLoginAttempt && loginEntryMode === "mobile" && <div style={{ position: "relative", display: "flex", alignItems: "center", width: "100%", gap: 10 }}><button
    onClick={() => setShowLoginPicker(true)}
    aria-label={`Country: ${effectiveLoginCountry.name}. Tap to change`}
    style={{ flexShrink: 0, width: 46, height: 40, borderRadius: 13, border: `1px solid ${T.line}`, background: T.surface, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}
  ><FlagEmoji flag={effectiveLoginCountry.flag} width={38} height={32} radius={6} dropShadow="drop-shadow(0 4px 10px rgba(76,29,149,0.18))" /></button>{
    /* Masked by default, revealed with the eye toggle that
       now sits on the card's boundary (top-right corner)
       instead of inline here — same spot the Secure ID eye
       uses in ID mode. */
  }<div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", background: T.surfaceAlt, border: `1px solid ${T.line}`, borderRadius: T.radiusMd, padding: "9px 13px" }}><span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, letterSpacing: loginMobileRevealed ? 0 : 2, color: loginMobileBuffer ? T.ink : T.inkFaint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{loginMobileBuffer ? loginMobileRevealed ? loginMobileBuffer.replace(/(\d{3})(?=\d)/g, "$1 ") : loginMobileBuffer.replace(/\d/g, "\u2022").replace(/(.{3})(?=.)/g, "$1 ") : "Mobile number"}</span></div></div>}{stage === "referral" && <SymbolChipRow length={REFERRAL_LENGTH} value={referralCode} masked={!referralRevealed} />}{stage === "otp" && <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: "100%" }}><span style={{ fontSize: 11.5, color: T.inkFaint, fontWeight: 600, textAlign: "center" }}>
                    Enter the code sent to {dialCountry.dialCode} {phoneNumber}</span><SymbolChipRow length={OTP_LENGTH2} value={otp} masked={!otpRevealed} boxSize={34} justify="center" /></div>}</div>{
    /* Symbol dial pad — same compact grid-button pattern as
       PhoneDialPad, sized down so the card, dial, and button all
       stay fully visible together on one screen. */
  }{stage === "secureId" && (!isLoginAttempt || loginEntryMode === "id") && <div style={{ marginTop: 32, position: "relative", zIndex: 1, width: "100%" }}><SymbolDialPad value={secureId} onChange={setSecureId} length={SECURE_ID_LENGTH} /></div>}{
    /* Two ready-made IDs — creation only, never shown while
       logging in, since login needs the person's existing ID,
       not a fresh suggestion. */
  }{stage === "secureId" && !isLoginAttempt && <SuggestedIdRow id={suggestedRegId} onPick={setSecureId} />}{stage === "secureId" && isLoginAttempt && loginEntryMode === "mobile" && <div style={{ marginTop: 28, position: "relative", zIndex: 1, width: "100%" }}><PhoneDialPad
    value={loginMobileBuffer}
    onChange={setLoginMobileBuffer}
    minLength={loginMinLen}
    maxLength={loginMaxLen}
    onSubmit={handleSubmitSecureId}
  /></div>}{stage === "referral" && <div style={{ marginTop: 32, position: "relative", zIndex: 1, width: "100%" }}><SymbolDialPad value={referralCode} onChange={setReferralCode} length={REFERRAL_LENGTH} /></div>}{stage === "phone" && phoneDialOpen && <div style={{ marginTop: 28, position: "relative", zIndex: 1, width: "100%" }}><PhoneDialPad
    value={phoneNumber}
    onChange={setPhoneNumber}
    minLength={mobileDigitRange(dialCountry.iso)[0]}
    maxLength={mobileDigitRange(dialCountry.iso)[1]}
    onSubmit={handleVerify}
  /></div>}{
    /* OTP dial pad — the numeric code is 6 digits, entered with
       the exact same dial pad as the mobile number step, not the
       symbol dial used for the 12-character Secure/Referral ID. */
  }{stage === "otp" && <div style={{ marginTop: 28, position: "relative", zIndex: 1, width: "100%" }}><PhoneDialPad value={otp} onChange={setOtp} minLength={OTP_LENGTH2} maxLength={OTP_LENGTH2} onSubmit={handleSubmitOtp} processing={otpVerifying} /></div>}{stage === "secureId" && !isLoginAttempt && <div style={{ marginTop: 20 }}><SubmitButton
    onClick={handleSubmitSecureId}
    disabled={secureId.length !== SECURE_ID_LENGTH || authBusy}
    label={authBusy ? "Checking…" : "Submit"}
  /></div>}{stage === "secureId" && isLoginAttempt && loginEntryMode === "id" && <div style={{ marginTop: 20, display: "flex", justifyContent: "center" }}><CircularInButton onClick={handleSubmitSecureId} disabled={secureId.length !== SECURE_ID_LENGTH} size={44} /></div>}{stage === "referral" && <div style={{ marginTop: 20, display: "flex", flexDirection: "column", alignItems: "center" }}><SubmitButton
    onClick={handleSubmitReferral}
    disabled={referralCode.length !== REFERRAL_LENGTH}
  /><button
    onClick={() => flipTo("pin")}
    style={{
      marginTop: 10,
      border: "none",
      background: "none",
      color: T.accent2,
      fontSize: 12,
      fontWeight: 700,
      cursor: "pointer",
      padding: "6px 8px"
    }}
  >
                  Skip for now
                </button></div>}{stage === "otp" && <div style={{ marginTop: 20, display: "flex", flexDirection: "column", alignItems: "center" }}><button
    onClick={() => setOtp("")}
    style={{
      border: "none",
      background: "none",
      color: T.accent2,
      fontSize: 12,
      fontWeight: 700,
      cursor: "pointer",
      padding: "6px 8px"
    }}
  >
                  Resend code
                </button></div>}</div></div></div>{stage === "phone" && !phoneDialOpen && <div style={{ position: "absolute", left: "50%", bottom: "3%", transform: "translateX(-50%)", zIndex: 20, width: "100%", padding: "0 16px", display: "flex", justifyContent: "center" }}><span
    style={{
      fontSize: 9.5,
      fontWeight: 700,
      letterSpacing: 0.4,
      color: T.inkFaint,
      textTransform: "uppercase",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      maxWidth: "100%"
    }}
  >
            Cashless · Taxless · Borderless · Limitless
          </span></div>}{stage === "pin" && <PinScreen
    value={pin}
    length={PIN_LENGTH}
    onChange={setPin}
    onSubmit={handleSubmitPin}
    onBack={requestBackFromPin}
    revealed={pinRevealed}
    onToggleReveal={() => setPinRevealed((v) => !v)}
  />}{stage === "biometric" && <BiometricVerifyScreen
    onBack={requestBackFromRegBiometric}
    onVerify={handleRegBiometricVerify}
    scanning={regBiometricScanning}
  />}{stage === "profile" && <ProfileSetupScreen
    onBack={requestBackFromProfile}
    onSubmit={handleSubmitProfile}
    photo={profilePhoto}
    onChangePhoto={setProfilePhoto}
    docType={docType}
    onSelectDocType={setDocType}
    name={documentedName}
    onChangeName={setDocumentedName}
  />}{stage === "loginAuth" && <LoginAuthScreen
    value={loginAuthPin}
    length={PIN_LENGTH}
    onChange={setLoginAuthPin}
    onSubmit={handleSubmitLoginAuth}
    onBack={requestBackFromLoginAuth}
    revealed={loginAuthRevealed}
    onToggleReveal={() => setLoginAuthRevealed((v) => !v)}
  />}{stage === "loginBiometric" && <BiometricVerifyScreen
    onBack={requestBackFromLoginBiometric}
    onVerify={handleLoginBiometricVerify}
    scanning={loginBiometricScanning}
  />}{stage === "dashboard" && <Dashboard_default
    dialCountry={dialCountry}
    onLogout={handleStartOver}
    onOpenSend={(opts) => {
      setActiveScreen("send");
    }}
    onOpenBank={() => setActiveScreen("bank")}
    onOpenCoverage={() => setActiveScreen("coverage")}
    onOpenScan={() => setShowScanScreen(true)}
    myGloobalId={secureId}
    creatorId={creatorId}
    myName={documentedName}
    openHistoryDirection={dashboardHistoryDirection}
    onConsumeOpenHistory={() => setDashboardHistoryDirection(null)}
    pendingOpenMyShare={pendingOpenMyShare}
    onConsumePendingMyShare={() => setPendingOpenMyShare(false)}
    profilePhoto={profilePhoto}
    onChangeProfilePhoto={setProfilePhoto}
    sendHistory={sendMoneyHistory}
    bankBalance={bankBalance}
    assetSeeds={assetSeeds}
    onPayBusiness={handlePayBusiness}
    paylaterHistory={paylaterHistory}
    accountCreatedAt={accountCreatedAt}
    onSettleAssetsToBank={handleSettleAssetsToBank}
    onSettleReferralToBank={handleSettleReferralToBank}
    essentialsIHaveEnough={essentialsIHaveEnough}
    onToggleEssentialsIHaveEnough={handleToggleEssentialsIHaveEnough}
    onShareRoleChange={setActiveShareRole}
    onMyShareRateChange={setActiveMyShareRate}
  />}{
    /* Scan to pay — real decode/lock logic, simulated camera input
       since there's no actual camera access here. Tapping the demo
       target is standing in for "the camera detected this code." */
  }{showScanScreen && <div style={{ position: "fixed", inset: 0, zIndex: 400, background: T.bg, display: "flex", flexDirection: "column", overflow: "hidden" }}><DashboardAmbientBg /><div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 12, padding: "calc(18px + env(safe-area-inset-top, 0px)) 18px 14px", flexShrink: 0 }}><button
    onClick={() => {
      setShowScanScreen(false);
      setScanPendingPayment(null);
      setScanError(null);
      setScanCameraAccessGranted(false);
      setScanScreenTab("scan");
    }}
    aria-label="Back"
    className="v2-tap"
    style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: T.surface, boxShadow: T.shadowCard, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
  ><ChevronLeft4 size={20} color={T.ink} /></button><span style={{ fontSize: 16, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>{scanScreenTab === "myCode" ? "My Gloobal QR code" : "Scan to pay"}</span></div>{
    /* Scan / My Code — same two-way pattern as any scanner: scan
       someone else's code, or show your own for them to scan.
       "My Code" shows a real, separate ID per role — Personal mode
       shares secureId (the same one the Receive screen uses),
       Creator mode shares creatorId — never the same code for both,
       since scanning them means different things (a plain transfer
       vs. one that carries Creator Share). */
  }<div style={{ position: "relative", zIndex: 1, display: "flex", gap: 8, padding: "0 18px 14px", flexShrink: 0 }}>{[
    { key: "scan", label: "Scan" },
    { key: "myCode", label: "My Code" }
  ].map((tab) => <button
    key={tab.key}
    onClick={() => setScanScreenTab(tab.key)}
    className="v2-tap"
    style={{
      flex: 1,
      border: "none",
      borderRadius: 999,
      padding: "10px 0",
      background: scanScreenTab === tab.key ? T.gradButton : T.surfaceAlt,
      color: scanScreenTab === tab.key ? "#fff" : T.inkFaint,
      fontSize: 13,
      fontWeight: 800,
      cursor: "pointer",
      transition: "background 0.18s ease, color 0.18s ease"
    }}
  >{tab.label}</button>)}</div>{scanScreenTab === "myCode" ? <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", gap: 16 }}><div
    style={{
      position: "relative",
      background: `${scanHeroColor}14`,
      borderRadius: 28,
      padding: 16,
      transition: "background 0.4s ease"
    }}
  ><div style={{ background: "#fff", borderRadius: T.radiusXl, padding: 18, boxShadow: T.shadowCard }}><GloobalQRCode code={encodeGloobalQR({ gloobalId: activeShareRole === "merchant" ? creatorId : secureId, amountCents: requestCents })} size={200} /></div>{
    /* Same Creator Share edge badge the Receive screen's QR shows —
       one consistent "here's my share rate" affordance wherever your
       code is displayed. Sits on the box's own right edge, clear of
       the Request controls below. */
  }<div style={{ position: "absolute", top: "50%", right: 0, transform: "translate(50%, -50%)", perspective: 200 }}><button
    onClick={() => {
      setShowScanScreen(false);
      setScanScreenTab("scan");
      setPendingOpenMyShare(true);
    }}
    aria-label={`My Share, currently ${activeMyShareRate}%`}
    className="v2-tap"
    style={{ display: "flex", border: "none", background: "none", padding: 0, cursor: "pointer" }}
  ><span
    style={{
      position: "relative",
      width: 40,
      height: 40,
      borderRadius: "50%",
      transformStyle: "preserve-3d",
      transition: "transform 0.5s cubic-bezier(.4,.15,.2,1)",
      transform: scanShareIconFlipped ? "rotateY(180deg)" : "rotateY(0deg)"
    }}
  ><span style={{ position: "absolute", inset: 0, borderRadius: "50%", backfaceVisibility: "hidden", background: T.gradButton, boxShadow: "0 4px 12px rgba(124,58,237,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}><PieChart size={17} color="#fff" /></span><span
    style={{
      position: "absolute",
      inset: 0,
      borderRadius: "50%",
      backfaceVisibility: "hidden",
      transform: "rotateY(180deg)",
      background: T.gradButton,
      boxShadow: "0 4px 12px rgba(124,58,237,0.3)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}
  ><span style={{ fontSize: 11.5, fontWeight: 800, color: "#fff" }}>{activeMyShareRate}%</span></span></span></button></div></div><div style={{ textAlign: "center" }}><div style={{ fontSize: 13, color: T.inkFaint, marginBottom: 6 }}>{activeShareRole === "merchant" ? "Your Creator ID" : "Your Gloobal ID"}</div><ColoredGloobalId id={activeShareRole === "merchant" ? creatorId : secureId} /></div>{
    /* Request — turns this same code into a payment request by
       embedding an amount (encodeGloobalQR already supports
       amountCents; the scanning side already renders it as "Payment
       request" with a Pay button instead of a plain Confirm — this
       is just the missing UI to set that amount from here). Covers
       generate (type an amount, the code above updates immediately)
       and receive (share/show that same code); nothing here sends a
       request to a specific person — that's Send Money, a different
       screen, one screen already covers "pay someone", not "ask
       someone to pay me". */
  }<div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>{requestCents > 0 && <div style={{ textAlign: "center", fontSize: 12.5, fontWeight: 700, color: T.positive }}>
        Requesting {CURRENCY_SYMBOL[COUNTRY_CURRENCY[dialCountry.iso] || "USD"] || "$"}{(requestCents / 100).toFixed(2)}
      </div>}{requestOpen ? <div style={{ display: "flex", gap: 8 }}><input
    value={requestAmount}
    onChange={(e) => {
      const v = e.target.value;
      if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) setRequestAmount(v);
    }}
    placeholder="Amount to request"
    inputMode="decimal"
    autoFocus
    style={{ flex: 1, border: `1px solid ${T.line}`, borderRadius: T.radiusMd, padding: "12px 14px", fontSize: 14, fontWeight: 700, color: T.ink, background: T.surface, outline: "none" }}
  /><button
    onClick={() => setRequestOpen(false)}
    className="v2-tap"
    style={{ border: "none", borderRadius: T.radiusMd, padding: "0 20px", background: T.gradButton, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}
  >
            Done
          </button></div> : <button
    onClick={() => setRequestOpen(true)}
    className="v2-tap"
    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", border: `1.5px solid ${T.line}`, borderRadius: 999, padding: "12px 0", background: T.surface, color: T.ink, fontSize: 13.5, fontWeight: 800, cursor: "pointer" }}
  ><ArrowDownLeft2 size={15} color={T.accent} />{requestCents > 0 ? "Change requested amount" : "Request an amount"}</button>}{requestCents > 0 && !requestOpen && <button
    onClick={() => {
      setRequestAmount("");
      setRequestOpen(false);
    }}
    className="v2-tap"
    style={{ border: "none", background: "none", padding: 0, fontSize: 12, fontWeight: 700, color: T.inkFaint, cursor: "pointer", alignSelf: "center" }}
  >
          Clear request
        </button>}</div></div> : <>{!scanCameraAccessGranted ? (
    // Matches the reference screenshot's real permission-request
    // pattern. There's no actual camera API in this environment,
    // so "Allow Access" can't request a genuine permission — it
    // moves into the same simulated-scan flow below, honestly,
    // rather than pretending to grant something real.
    <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", padding: "10px 24px 0" }}><h1 style={{ fontSize: 28, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay, margin: "10px 0 0" }}>
                Scan any QR code
              </h1><div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, paddingBottom: 60 }}><div
      style={{
        width: 200,
        height: 200,
        borderRadius: "50%",
        background: `${scanHeroColor}1A`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background 0.4s ease"
      }}
    ><ScannerIcon size={72} animated /></div><div style={{ textAlign: "center" }}><div style={{ fontSize: 19, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay, marginBottom: 8 }}>
                    Allow Camera Access
                  </div><div style={{ fontSize: 13, color: T.inkFaint, lineHeight: 1.5, maxWidth: 260 }}>
                    We need access to your camera to scan QR codes. (No real camera in this environment — this leads to a simulated scan instead.)
                  </div></div><button
      onClick={() => setScanCameraAccessGranted(true)}
      className="v2-tap"
      style={{
        border: "none",
        borderRadius: 999,
        padding: "14px 40px",
        background: T.gradButton,
        color: "#fff",
        fontSize: 14.5,
        fontWeight: 800,
        cursor: "pointer",
        boxShadow: "0 8px 20px rgba(124,58,237,0.28)"
      }}
    >
                  Allow Access
                </button><button
      onClick={() => setScanCameraAccessGranted(true)}
      className="v2-tap"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        border: "none",
        background: "none",
        color: T.accent,
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer"
      }}
    ><ImageIcon size={17} />
                  Upload from gallery
                </button></div><div style={{ paddingBottom: "calc(26px + env(safe-area-inset-bottom, 0px))" }}><div
      style={{
        width: "100%",
        background: T.surfaceAlt,
        border: `1px solid ${T.line}`,
        borderRadius: 999,
        padding: "15px 20px",
        fontSize: 14.5,
        color: T.inkFaint
      }}
    >
                  Enter Mobile Number to Pay
                </div></div></div>
  ) : <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", gap: 20 }}>{!scanPendingPayment ? <><div
    style={{
      width: 280,
      height: 280,
      borderRadius: 28,
      border: `2px dashed ${scanHeroColor}66`,
      background: `${scanHeroColor}0D`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "background 0.4s ease, border-color 0.4s ease"
    }}
  ><ScannerIcon size={80} animated /></div><div style={{ fontSize: 12.5, color: T.inkFaint, textAlign: "center", lineHeight: 1.5 }}>
                  No real camera in this environment — tap the demo code below to simulate a scan.
                </div><button
    onClick={() => handleQrScanned(demoScanTarget.code)}
    className="v2-tap"
    style={{ border: "none", background: "none", padding: 0, cursor: "pointer" }}
  ><div style={{ background: "#fff", borderRadius: T.radiusLg, padding: 14, boxShadow: T.shadowCard }}><GloobalQRCode code={demoScanTarget.code} size={180} /></div><div style={{ fontSize: 11, color: T.inkFaint, marginTop: 8 }}>Tap to simulate scanning {demoScanTarget.name}'s code</div></button>{scanError && <div style={{ fontSize: 12.5, color: T.negative, textAlign: "center", fontWeight: 700 }}>{scanError}</div>}</> : <div style={{ width: "100%", maxWidth: 340, borderRadius: T.radiusXl, background: T.surface, boxShadow: T.shadowCard, border: `1px solid ${T.line}`, padding: "28px 24px", textAlign: "center" }}><div style={{ fontSize: 12, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 10 }}>{scanPendingPayment.amountCents > 0 ? "Payment request" : "Gloobal ID"}</div>{scanPendingPayment.amountCents > 0 && <div style={{ fontSize: 32, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay, marginBottom: 14 }}>{CURRENCY_SYMBOL[COUNTRY_CURRENCY[dialCountry.iso] || "USD"] || "$"}{(scanPendingPayment.amountCents / 100).toFixed(2)}</div>}<div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 20 }}><ColoredGloobalId id={scanPendingPayment.gloobalId} /></div><button
    onClick={() => {
      if (scanPendingPayment.amountCents > 0) {
        setScanPayOptionsOpen(true);
      } else {
        setShowScanBiometric(true);
      }
    }}
    className="v2-tap"
    style={{
      width: "100%",
      border: "none",
      borderRadius: T.radiusMd,
      padding: "14px 0",
      background: T.gradButton,
      color: "#fff",
      fontSize: 14,
      fontWeight: 800,
      cursor: "pointer"
    }}
  >
                  Verify & {scanPendingPayment.amountCents > 0 ? "Pay" : "Confirm"}</button><button
    onClick={() => setScanPendingPayment(null)}
    className="v2-tap"
    style={{ width: "100%", border: "none", background: "none", padding: "12px 0 0", fontSize: 12.5, color: T.inkFaint, cursor: "pointer" }}
  >
                  Cancel
                </button></div>}</div>}</>}</div>}<PayOptionsSheet
    open={scanPayOptionsOpen}
    onClose={() => setScanPayOptionsOpen(false)}
    onChoose={(label) => {
      if (label === "Gloobal Coin") {
        showToast("Gloobal Coin isn't live yet \u2014 paying via Gloobal Bank instead");
      }
      setScanPayMethod(label === "Gloobal Coin" ? null : label);
      setScanPayOptionsOpen(false);
      setScanPayPinOpen(true);
    }}
  /><PayPinModal
    open={scanPayPinOpen}
    onClose={() => setScanPayPinOpen(false)}
    amountLabel={scanPendingPayment ? `\u2212${CURRENCY_SYMBOL[COUNTRY_CURRENCY[dialCountry.iso] || "USD"] || "$"}${(scanPendingPayment.amountCents / 100).toFixed(2)}` : null}
    onVerified={() => {
      setScanPayPinOpen(false);
      setShowScanBiometric(true);
    }}
  />{showScanBiometric && <BiometricVerifyScreen
    onBack={() => setShowScanBiometric(false)}
    onVerify={handleScanBiometricVerify}
    scanning={scanBiometricScanning}
  />}{activeScreen === "send" && <div style={{ position: "fixed", inset: 0, zIndex: 190, overflowY: "auto", WebkitOverflowScrolling: "touch" }}><SendMoney_default
    onClose={requestCloseActiveScreen}
    sender={{ ...dialCountry, phoneNumber }}
    history={sendMoneyHistory}
    onSendComplete={handleSendMoneyComplete}
    onExecuteTransaction={handleExecuteTransaction}
    onRemoteSend={handleRemoteSend}
    onOpenPaidHistory={() => {
      requestCloseActiveScreen();
      setDashboardHistoryDirection("sending");
    }}
  /></div>}{activeScreen === "bank" && <ScreenErrorBoundary name="Add bank" onClose={requestCloseActiveScreen}><AddBankScreen onClose={requestCloseActiveScreen} country={dialCountry} /></ScreenErrorBoundary>}{activeScreen === "coverage" && <ScreenErrorBoundary name="Gloobal Coverage" onClose={requestCloseActiveScreen}><GloobalCoverageScreen
    onClose={requestCloseActiveScreen}
    dialCountry={dialCountry}
    sendHistory={sendMoneyHistory}
    isFullyRegistered={stage === "dashboard"}
    onOpenMyShare={() => {
      requestCloseActiveScreen();
      setPendingOpenMyShare(true);
    }}
  /></ScreenErrorBoundary>}{
    /* Backend errors, shown over every stage — the PIN and login screens
       are their own full-screen overlays, so an in-card banner would be
       invisible on exactly the steps most likely to fail. The backend's
       own message is surfaced as-is ("PIN must be 4 to 6 digits",
       "Please verify OTP before registration", "Account locked"), since
       it is already more specific than anything generic here. */
  }{authError && <div
    role="alert"
    onClick={() => setAuthError(null)}
    style={{
      position: "fixed",
      left: "50%",
      transform: "translateX(-50%)",
      bottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
      zIndex: 999,
      width: "calc(100% - 40px)",
      maxWidth: 340,
      padding: "12px 16px",
      borderRadius: 14,
      background: "#FEF2F2",
      border: "1px solid rgba(220,38,38,0.3)",
      boxShadow: "0 10px 30px rgba(0,0,0,0.14)",
      color: "#B91C1C",
      fontSize: 12.5,
      fontWeight: 600,
      lineHeight: 1.45,
      textAlign: "center",
      cursor: "pointer"
    }}
  >{authError}</div>}{showDiagnostics && <DiagnosticsScreen onClose={closeDiagnostics} />}{showPicker && <CountryPickerScreen
    topCountries={TOP_COUNTRIES}
    countries={ALL_COUNTRIES}
    search={countrySearch}
    onSearch={setCountrySearch}
    onSelect={(c) => {
      setDialCountry(c);
      setShowPicker(false);
      setCountrySearch("");
    }}
    onClose={() => {
      setShowPicker(false);
      setCountrySearch("");
    }}
  />}{showLoginPicker && <CountryPickerScreen
    topCountries={TOP_COUNTRIES}
    countries={ALL_COUNTRIES}
    search={loginCountrySearch}
    onSearch={setLoginCountrySearch}
    onSelect={(c) => {
      setLoginMobileCountry(c);
      setLoginMobileBuffer("");
      setShowLoginPicker(false);
      setLoginCountrySearch("");
    }}
    onClose={() => {
      setShowLoginPicker(false);
      setLoginCountrySearch("");
    }}
  />}<style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes phoneFlipPop { from { transform: scale(0.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes badgePop { from { transform: translateY(-3px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes iconAttention { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .phone-flip-btn { animation: phoneFlipPop 0.28s cubic-bezier(0.22, 1, 0.36, 1); }
        /* Ambient dashboard motion \u2014 floating financial symbols, drifting
           dots, and slow geometric outlines. Transform/opacity only, so
           these stay on the compositor thread. */
        @keyframes finDrift {
          0% { transform: translate3d(0, 0, 0) rotate(var(--r0)); opacity: 0; }
          12% { opacity: var(--peak-op); }
          88% { opacity: var(--peak-op); }
          100% { transform: translate3d(var(--dx), var(--dy), 0) rotate(var(--r1)); opacity: 0; }
        }
        @keyframes finDotPulse {
          0%, 100% { transform: translate3d(0, 0, 0) scale(0.7); opacity: 0; }
          50% { transform: translate3d(0, -6px, 0) scale(1); opacity: var(--peak-op); }
        }
        @keyframes finGlow {
          0%, 100% { filter: none; }
          50% { filter: drop-shadow(0 0 6px currentColor) brightness(1.5); }
        }
        @keyframes finGeoSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          [aria-hidden="true"] span, [aria-hidden="true"] div { animation: none !important; opacity: 0 !important; }
        }
        @keyframes signalWave {
          0%, 100% { transform: scale(0.6); opacity: 0.3; box-shadow: none; }
          50% { transform: scale(1.35); opacity: 1; box-shadow: 0 0 6px 2px rgba(124,58,237,0.55); }
        }
        button:focus-visible {
          outline: 2px solid #3b6ef5;
          outline-offset: 2px;
        }
        /* Shared Version 2 tap/row feedback \u2014 used across registration,
           dashboard, country picker, and PIN screens for a consistent,
           lightweight "premium" press feel. Purely visual, no logic. */
        .v2-tap { transition: transform 0.1s ease, box-shadow 0.15s ease, background 0.15s ease; }
        .v2-tap:active { transform: scale(0.94); }
        .v2-row { transition: background 0.15s ease; }
        .v2-row:hover { background: rgba(124,58,237,0.05); }
        .v2-row:active { background: rgba(124,58,237,0.09); }
        @keyframes successPop {
          0% { transform: scale(0.5); opacity: 0; }
          60% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .v2-success-pop { animation: successPop 0.35s cubic-bezier(.34,1.56,.64,1); }
        /* GH Score dashboard indicator \u2014 a soft circle that blinks through
           a rotating set of light colors instead of showing a static
           score card. Color-cycle and opacity-blink run as two separate
           animations so the color changes read as "random" against the
           blink's own rhythm rather than always landing in sync. */
        @keyframes ghColorCycle {
          0%   { background: #FDE68A; }
          14%  { background: #A7F3D0; }
          28%  { background: #BFDBFE; }
          42%  { background: #FBCFE8; }
          57%  { background: #DDD6FE; }
          71%  { background: #FED7AA; }
          85%  { background: #FCA5A5; }
          100% { background: #FDE68A; }
        }
        @keyframes ghBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
        .gh-blink-circle {
          animation: ghColorCycle 7s linear infinite, ghBlink 1.6s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
          .v2-tap:active { transform: none; }
        }
      `}</style>{rootToast && <div
    style={{
      position: "fixed",
      bottom: "calc(28px + env(safe-area-inset-bottom, 0px))",
      left: "50%",
      transform: "translateX(-50%)",
      background: "#15132A",
      color: "#fff",
      fontSize: 13.5,
      fontWeight: 600,
      padding: "10px 18px",
      borderRadius: 999,
      zIndex: 9999,
      whiteSpace: "nowrap",
      boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
      pointerEvents: "none"
    }}
  >{rootToast}</div>}</div>;
}

