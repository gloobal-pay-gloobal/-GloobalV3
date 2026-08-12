// src/components/payments/PayPinModal.jsx
// Step two of the same sequence: a 6-digit OTP, same demo code
// (SEND_OTP) and same PhoneDialPad component Send Money/registration/
// login already use — one PIN entry pattern app-wide, not a second
// implementation. onVerified fires once, on the correct code; the
// caller is responsible for moving on to biometric verification next.
function PayPinModal({ open, onClose, amountLabel, onVerified }) {
  const [pin, setPin] = useState("");
  const [pinRevealed, setPinRevealed] = useState(false);
  const [pinError, setPinError] = useState(false);
  const errorTimer = useRef2(null);
  useEffect(() => {
    if (!open) {
      setPin("");
      setPinError(false);
      if (errorTimer.current) {
        clearTimeout(errorTimer.current);
        errorTimer.current = null;
      }
    }
  }, [open]);
  useEffect(() => {
    if (pin.length < 6) return;
    if (pin === SEND_OTP) {
      errorTimer.current = setTimeout(() => {
        setPin("");
        onVerified();
      }, 280);
    } else {
      setPinError(true);
      errorTimer.current = setTimeout(() => {
        setPin("");
        setPinError(false);
      }, 550);
    }
    return () => clearTimeout(errorTimer.current);
  }, [pin]);
  if (!open) return null;
  return <div
    style={{ position: "fixed", inset: 0, zIndex: 520, background: "rgba(15,12,35,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    role="dialog"
    aria-modal="true"
    aria-label="Enter OTP to confirm payment"
  ><div style={{ width: "100%", maxWidth: 360, background: T.bg, borderRadius: T.radiusXl, padding: "26px 22px 24px", position: "relative" }}><button
    onClick={onClose}
    aria-label="Cancel"
    className="v2-tap"
    style={{ position: "absolute", top: 14, right: 14, width: 32, height: 32, borderRadius: "50%", border: "none", background: T.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
  ><X4 size={16} color={T.inkFaint} /></button><div style={{ width: 44, height: 44, borderRadius: "50%", background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><Lock size={20} color={T.accent} /></div><h3 style={{ fontSize: 17, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay, margin: "0 0 4px" }}>
        Enter OTP
      </h3>{amountLabel && <div style={{ borderRadius: T.radiusMd, border: `1px solid ${T.line}`, background: T.surfaceAlt, padding: "12px 16px", textAlign: "center", margin: "14px 0 4px", fontSize: 20, fontWeight: 800, color: T.negative, fontFamily: T.fontDisplay }}>{amountLabel}</div>}{pinError && <div style={{ fontSize: 12, color: T.negative, fontWeight: 700, textAlign: "center", marginTop: 6 }}>Incorrect OTP</div>}<div style={{ marginTop: 14 }}><PhoneDialPad
    value={pin}
    onChange={setPin}
    minLength={6}
    maxLength={6}
    masked={!pinRevealed}
    onToggleMask={() => setPinRevealed((v) => !v)}
  /></div></div></div>;
}
function ProfileSetupScreen({ onBack, onSubmit, photo, onChangePhoto, docType, onSelectDocType, name, onChangeName }) {
  const fileInputRef = useRef4(null);
  const isDefaultPhoto = photo === G_LOGO_DATA_URI;
  // All three are required now. The photo used to be optional — the
  // Gloobal mark stood in for it indefinitely — which meant accounts could
  // reach the dashboard with no picture at all. `isDefaultPhoto` is the
  // test for "nothing was chosen", since the placeholder is a known data
  // URI rather than an empty value. Two characters is the floor on the
  // name so a single stray keystroke does not count as one.
  const canSubmit = !!docType && name.trim().length >= 2 && !isDefaultPhoto;
  const [logoHeroColor, setLogoHeroColor] = useState6(() => randomLogoFlipColor());
  useEffect6(() => {
    if (!isDefaultPhoto) return;
    const interval = setInterval(() => {
      setLogoHeroColor((prev) => randomLogoFlipColor(prev));
    }, 3e3);
    return () => clearInterval(interval);
  }, [isDefaultPhoto]);
  const DOC_TYPES = [
    { key: "bank", label: "Bank Statement", Icon: Landmark2 },
    { key: "license", label: "Driving Licence", Icon: Car2 },
    { key: "passport", label: "Passport", Icon: Globe2 }
  ];
  const handleFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChangePhoto(reader.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };
  return <div
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 100,
      background: T.bg,
      display: "flex",
      flexDirection: "column",
      fontFamily: T.fontBody
    }}
  ><div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "calc(18px + env(safe-area-inset-top, 0px)) 18px 14px",
      flexShrink: 0
    }}
  ><button
    onClick={onBack}
    aria-label="Back"
    className="v2-tap"
    style={{
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
      flexShrink: 0
    }}
  ><ChevronLeft size={20} /></button><span style={{ flex: 1, textAlign: "center", fontFamily: T.fontDisplay, fontSize: 18, color: T.ink, marginRight: 40 }}><SingleOMark before="" after="NE" /> <span style={{ fontWeight: 500 }}>last step</span></span></div><div
    style={{
      flex: 1,
      minHeight: 0,
      overflowY: "auto",
      WebkitOverflowScrolling: "touch",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "6px 24px 40px",
      boxSizing: "border-box"
    }}
  ><div
    style={{
      width: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 22,
      padding: "26px 20px",
      borderRadius: T.radiusLg,
      border: `1px solid ${T.line}`,
      background: T.surface,
      boxShadow: T.shadowCard,
      boxSizing: "border-box"
    }}
  >{
    /* Profile photo — defaults to the Gloobal 'g' mark until replaced */
  }<div style={{ position: "relative" }}><button
    onClick={() => fileInputRef.current && fileInputRef.current.click()}
    aria-label="Change profile photo"
    className="v2-tap"
    style={{
      width: 96,
      height: 96,
      borderRadius: "50%",
      border: `1.5px solid ${T.line}`,
      background: isDefaultPhoto ? logoHeroColor : T.surface,
      boxShadow: isDefaultPhoto ? `0 10px 24px ${logoHeroColor}40` : T.shadowCard,
      padding: 0,
      cursor: "pointer",
      overflow: "hidden",
      transition: "background 0.4s ease, box-shadow 0.4s ease"
    }}
  ><img
    src={photo}
    alt="Profile"
    style={{
      width: "100%",
      height: "100%",
      objectFit: isDefaultPhoto ? "contain" : "cover",
      padding: isDefaultPhoto ? 13 : 0,
      boxSizing: "border-box",
      filter: isDefaultPhoto ? "brightness(0) invert(1)" : "none"
    }}
  /></button><span
    style={{
      position: "absolute",
      bottom: -2,
      right: -2,
      width: 30,
      height: 30,
      borderRadius: "50%",
      background: T.gradButton,
      border: `2px solid ${T.bg}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      boxShadow: T.shadowCard
    }}
  ><Plus2 size={16} strokeWidth={2.75} /></span><input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} /></div>{
    /* Says why Continue is greyed out while the placeholder is still
       showing. A disabled button with no reason attached reads as a
       broken screen. */
  }{isDefaultPhoto && <span style={{ fontSize: 11.5, fontWeight: 700, color: T.inkFaint, textAlign: "center", marginTop: -12 }}>
            Tap to add a profile photo
          </span>}{
    /* Document type — mandatory single pick */
  }<div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}><span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: T.inkFaint }}>
            Verify with a document
          </span><div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>{DOC_TYPES.map(({ key, label, Icon }) => {
    const active = docType === key;
    return <button
      key={key}
      onClick={() => onSelectDocType(key)}
      className="v2-tap"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        padding: "14px 6px",
        borderRadius: T.radiusMd,
        border: active ? `1.5px solid ${T.accent}` : `1px solid ${T.line}`,
        background: active ? T.accentSoft : T.surface,
        cursor: "pointer",
        boxShadow: active ? "none" : T.shadowCard
      }}
    ><Icon size={20} color={active ? T.accent : T.inkSoft} /><span style={{ fontSize: 10.5, fontWeight: 700, color: active ? T.accent : T.inkSoft, textAlign: "center", lineHeight: 1.25 }}>{label}</span></button>;
  })}</div></div>{
    /* Documented name — pre-filled but editable, must stay non-empty */
  }<div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}><span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: T.inkFaint }}>
            Name on document
          </span><input
    value={name}
    onChange={(e) => onChangeName(e.target.value)}
    placeholder="Full name as shown on document"
    style={{
      width: "100%",
      boxSizing: "border-box",
      padding: "14px 16px",
      borderRadius: T.radiusMd,
      border: `1px solid ${T.line}`,
      background: T.surface,
      fontSize: 14.5,
      fontWeight: 700,
      color: T.ink,
      boxShadow: T.shadowCard
    }}
  /></div></div><button
    onClick={onSubmit}
    disabled={!canSubmit}
    className="v2-tap"
    style={{
      width: "100%",
      border: "none",
      borderRadius: T.radiusMd,
      padding: "15px 0",
      color: "#fff",
      fontSize: 14,
      fontWeight: 800,
      background: canSubmit ? T.gradButton : T.gradButtonDisabled,
      boxShadow: canSubmit ? "0 8px 20px rgba(124,58,237,0.32)" : "none",
      cursor: canSubmit ? "pointer" : "not-allowed",
      opacity: canSubmit ? 1 : 0.7,
      marginTop: 22
    }}
  >
          Continue
        </button></div></div>;
}

