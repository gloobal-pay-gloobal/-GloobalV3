# GLOOBAL — PROJECT ASSESSMENT REPORT

**Date:** 2026-07-21
**Repo:** `C:\Users\Chanchal Sharma\Desktop\Gloobal` (branch `main`, HEAD `e914142`)
**Live frontend:** https://gloobal.netlify.app
**Live backend:** https://gloobal-pay.onrender.com
**Basis:** Direct read of `Backend/server.js` (1545 lines), all 7 Mongoose models, the full `Frontend/src` tree (44 files), deploy configs, and the complete git history.

---

> ### ⚠️ Staleness notice — added 2026-07-29
>
> This assessment reflects the tree at HEAD `e914142` (2026-07-21). `main` is now `2f57b2f`, roughly 30 commits ahead, and `Backend/server.js` has grown from 1545 to **2086 lines**. Two spot-checks against the current tree:
>
> - **§1's "most urgent item" is fixed.** `POST /api/otp/send` no longer returns the OTP in its response body.
> - **Wide-open CORS still stands.** `app.use(cors())` remains unqualified at `server.js:21`.
>
> Everything else below is unverified against current `main`. Features shipped since this report (GH Score, My Assets / cashback seeds, Creator cashback rate, Gloobal ID history and rename gate) are **not assessed here at all** — see `PROGRESS.md` for those. Treat this as a 2026-07-21 snapshot, not a current audit.

---

## 1. EXECUTIVE SUMMARY

Gloobal is a **UI-complete, security-incomplete payments prototype.** The frontend is genuinely good — componentized, lazy-loaded, PWA-hardened, with real security headers and thoughtful cold-start handling. The backend works, and its OTP/PIN *primitives* are correctly built (bcrypt hashing, expiry, attempt caps, lockouts).

But the system has **no authentication layer at all.** There is no JWT, no session, no cookie, no token, no auth middleware. Every endpoint accepts a `symbolId` as a plain string parameter and trusts it completely. Combined with two other findings — the OTP being returned in the API response body, and wide-open CORS — this means **any person on the internet can currently take over any Gloobal account, read any user's profile and full transaction history, and send money as them.** That is not an exaggeration or a theoretical chain; it is three HTTP requests.

Separately: **no money exists in this system.** There are no balances. `LedgerEntry.balanceBefore` and `balanceAfter` are hardcoded to `0`. The dashboard balance is the string literal `"12,480.50"`. Transactions are marked `success` unconditionally with no settlement.

**Honest positioning:** this is a high-fidelity *demo* that convincingly looks like a payment app. It is not a payment app. Distance to industry grade is covered in §8 — the short version is that the code gap is large but tractable, and the regulatory gap is much larger than the code gap.

**Most urgent item:** `POST /api/otp/send` returns the OTP in its own JSON response (`server.js:128`). Fix this before anything else, including before any further feature work.

---

## 2. FRONTEND ARCHITECTURE

**Stack:** React 18.3 + Vite 5 + Tailwind 3, PWA with a generated service worker. Deployed to Netlify. No routing library — navigation is a `stage` string in React state inside `App.jsx`.

### Layout

```
Frontend/src/
├── App.jsx                    (65 KB) — GloobalId root: all auth/onboarding stage machine
├── AppRoot.jsx                — error boundary + suspense wrapper
├── lazyScreens.js             — React.lazy split points for the 4 heavy screens
├── main.jsx, registerServiceWorker.js
├── components/
│   ├── auth/        CountryPicker, LoginAuth, PhoneConnector, PinScreen, PinScreenShell, CircularInButton
│   ├── dashboard/   DashboardScreen.jsx      (164 KB — the mega-component)
│   ├── sendMoney/   SendMoneyScreen.jsx      (64 KB)
│   ├── coverage/    GloobalCoverageScreen.jsx (24 KB)
│   ├── bank/        AddBankScreen, LinkAccountFlow, BankAvatar
│   ├── common/      DialPads (31 KB), CodeEntry, Icons, FlagComponents, GlobeHero, ExplainSheet
│   └── backgrounds/ FinancialAmbient, FlagParticleField
├── services/
│   ├── httpClient.js          — fetch wrapper: JSON, AbortController timeouts, ApiError
│   ├── api/authApi.js         — the entire backend surface, one function per endpoint
│   ├── offlineQueue.js        — IndexedDB replay queue (BUILT BUT UNUSED — dead code)
│   └── db.js                  — minimal IndexedDB helper
├── lib/rateLimiter.js         — client-side attempt throttle (UX only, self-documented as such)
├── constants/                 countries, banks, coverage, finance, identity, dashboardData
├── styles/theme.js            — the `T` design-token object
└── pwa/                       ErrorBoundary, UpdateToast, ScreenFallback, splash
```

### Navigation model

`App.jsx` holds a `stage` string:

```
Registration: phone → otp → secureId → referral → pin → deviceSetup → dashboard
Login:        secureId → loginAuth → dashboard
```

### Notable frontend qualities

- **Real security headers** in `public/_headers` — CSP, HSTS (2yr, preload), `X-Frame-Options: DENY`, `nosniff`, `Permissions-Policy`, `frame-ancestors 'none'`.
- **Cold-start engineering** — Render's free tier sleeps and takes 20–50s to wake. The team added `warmUpBackend()` fired at mount plus 45s timeouts on any call that could be first-of-session, and correctly *doesn't* burn the user's attempt budget when a request times out (`authApi.js:43`, `:85`). This is careful work.
- **Defensive API base resolution** (`httpClient.js:30`) — only trusts `VITE_API_URL` if it's an absolute http(s) URL, defending against a stale relative value silently pointing calls at Netlify.
- **Honest code comments.** `rateLimiter.js` opens by stating it is *not* the rate limit and can be trivially bypassed. This kind of self-documentation is a real asset.

### Frontend problems

- `DashboardScreen.jsx` is **164 KB in one file** — the mega-component problem simply migrated from `GlobalId.jsx` rather than being solved.
- **Balance is fake:** `DashboardScreen.jsx:899` → `const balance = "12,480.50";`
- **No session persistence.** `registeredUser` is React state only. A page refresh logs the user out. (Note: `CLAUDE.md` claims a `gloobal.session.v1` localStorage session — this does not exist in the code.)
- `offlineQueue.js` is fully built, tested-shaped, and **never imported by anything.**
- No unit tests. One Playwright e2e spec (`e2e/gloobal.spec.mjs`).

---

## 3. BACKEND ARCHITECTURE

**Stack:** Node 20, Express 5.2, Mongoose 9.6, bcrypt 6, `@simplewebauthn/server` 13.3, MongoDB Atlas. Deployed to Render.

**Structure: a single 1545-line `server.js`.** No routers, no controllers, no middleware layer, no services. `Backend/src/` exists with `config/database.js`, `controllers/authController.js`, `models/User.js`, `routes/authRoutes.js` — **all four are 0 bytes.** Abandoned refactor scaffolding.

### Endpoint map (all 16, as actually implemented)

| Method | Route | Auth required | Notes |
|---|---|---|---|
| POST | `/api/otp/send` | none | **Returns the OTP in the response body** |
| POST | `/api/otp/verify` | none | bcrypt compare, expiry, attempt cap |
| POST | `/api/register-symbol` | verified OTP | 12-symbol ID, referral chain (depth 3) |
| POST | `/api/login` | PIN | bcrypt, 5-attempt → 10min lockout |
| POST | `/api/pin/set` | **none** | Sets PIN for any symbolId given |
| POST | `/api/pin/verify` | PIN | **Falls back to `1234` if no PIN set** |
| POST | `/api/pin/reset` | verified OTP + mobile match | Correctly gated |
| GET | `/api/profile/:symbolId` | **none** | Returns email + mobile (PII) |
| PUT | `/api/profile/:symbolId` | **none** | Anyone can edit anyone's profile |
| POST | `/api/passkey/status` | none | |
| POST | `/api/passkey/register/options` | **none** | rpID from `Origin` header |
| POST | `/api/passkey/register/verify` | challenge | |
| POST | `/api/passkey/auth/options` | none | |
| POST | `/api/passkey/auth/verify` | challenge | Counter correctly updated |
| GET | `/api/users/resolve` | **none** | Full user enumeration by phone |
| POST | `/api/transactions/send` | PIN | Amount cap, dup guard, idempotency key |
| GET | `/api/transactions/history/:symbolId` | **none** | **Any user's full history** |

### Data model (`Backend/models/`)

- **User** — `symbolId` (unique), `mobileNumber` (unique/sparse, `+91`-normalized), `fullName`, `email`, `passkeys[]` (id, publicKey Buffer, counter, transports, deviceType, backedUp), `referredBy`, `referralChain[]`, `referralCount`, `currentChallenge`.
- **Otp** — `otpHash` (bcrypt), `purpose` enum, `attempts`/`maxAttempts`, `expiresAt` (TTL index), `verifiedAt`, `consumedAt`. Well-designed.
- **Pin** — `pinHash`, `failedAttempts`, `lockedUntil`, `lastVerifiedAt`, `changedAt`. Unique per user.
- **Transaction** — `fromUserId`/`toUserId`, `amount`, `currency`, `type`/`status` enums, `referenceId` (unique), `failureReason`, `metadata` (Mixed). Well-indexed.
- **LedgerEntry** — debit/credit pairs. **`balanceBefore`/`balanceAfter` always written as 0.**
- **Notification**, **AuditLog** — fully modeled with good indexes, **never written to by any route.**

The schema design is genuinely the strongest part of the backend — it anticipates holds, refunds, reversals, and audit trails. The routes just don't use any of it yet.

---

## 4. MISTAKES MADE SO FAR

Drawn from git history and current code state.

### 4.1 Config duplicated across three files, fixed three times
CSP was wrong and had to be corrected in three separate commits, one per copy:
- `373e8ff` — fixed CSP blocking all backend calls (`index.html` meta tag)
- `89374e8` — "Fix **second** CSP source: Netlify's `_headers`"
- `3af94a7` — "Fix **third** stale CSP copy in `vercel.json`"

**The root cause was never fixed.** All three copies still exist and can still drift. `vercel.json` is dead weight — deployment is Netlify.

### 4.2 A shipped regression that broke all registration and login
`fefe63c` — *"Fix critical regression: PIN/Device Verification bounce loop blocking all registration and login."* A total-outage bug reached main. There are no tests that would have caught it, and no PR review step (every merge goes straight to `main`).

### 4.3 OTP length mismatch between frontend and backend
`d818c39` fixed `PROTOTYPE_OTP` to 6 digits to match the frontend's `OTP_LENGTH = 6`. **This inconsistency still partly exists:** `Backend/.env.example` still says `PROTOTYPE_OTP=0000` (4 digits), and `CLAUDE.md` still documents the OTP as fixed at `0000`. A new developer following the example file gets a broken flow.

### 4.4 Whole-frontend replacement twice
`0bc5856` ("Replace Frontend with founder GlobalId PWA 1 reference package") and `6d71eb4` (v2 integration) each swapped the frontend wholesale. This is why `offlineQueue.js` still carries a comment saying *"This app is currently a front-end demo with no real backend"* — stale by two integrations.

### 4.5 Abandoned refactor left in place
`Backend/src/{config,controllers,models,routes}` — four 0-byte files. Someone started splitting the monolith and stopped. Meanwhile `server.js` grew to 1545 lines.

### 4.6 `.env` was committed to git
`afa223d` added `.env`; `23991c9` moved it to `Backend/.env`; `07d2cef` removed it from tracking.

**Verified impact: LOW.** The committed blob contained only `PORT=5000` and `MONGO_URI=mongodb://127.0.0.1:27017/gloobal_db` — a localhost URI, no credentials. The current `Backend/.env` (holding the real Atlas string) is untracked and correctly gitignored. **No live secret was leaked.** The pattern was dangerous, but this specific instance did not cause harm.

### 4.7 The `fullName` field holds a phone number
`server.js:442`: `const cleanFullName = cleanMobileNumber;`

Registration deliberately overwrites the user's name with their phone number. So `fullName` is PII, is displayed in the UI, and is returned by unauthenticated endpoints. Several lookups then search `{ fullName: normalizedPhone }` as a legacy fallback (`server.js:1133`), cementing the confusion.

### 4.8 Documentation drifted from reality
`CLAUDE.md` currently states three things that are false: that `GlobalId.jsx` is a ~5200-line mega-component (it's been componentized), that a `gloobal.session.v1` localStorage session exists (it doesn't), and that the OTP is `0000` (it's `123456`).

### 4.9 No test or review discipline
`Backend/package.json` test script is the npm default `exit 1`. No backend tests exist. No CI. Every commit merges directly to `main`.

---

## 5. RECTIFICATIONS ALREADY DONE

Credit where due — real hardening has landed:

**Credentials**
- OTPs bcrypt-hashed at rest, never stored plaintext.
- OTP expiry (5 min), TTL index for auto-cleanup, attempt cap (5), purpose scoping, and single-use `consumedAt` semantics.
- Registration and PIN reset both gated on a *verified, unconsumed* OTP within a 10-minute window.
- PIN reset additionally verifies the mobile number matches the Secure ID.
- PINs bcrypt-hashed; 5 failed attempts → 10-minute lockout, applied consistently across login, verify, and transaction send.

**Transactions**
- 15-second duplicate window on identical (sender, receiver, amount, currency, note).
- Optional client `idempotencyKey`.
- Self-transfer blocked at two levels (identifier string and resolved user ID).
- Amount cap via `PROTOTYPE_TRANSACTION_MAX_AMOUNT`.
- `pending → success` state machine with a `catch` that marks failures rather than leaving records stuck.

**Frontend**
- Full security header set deployed (CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy).
- CSP `connect-src` corrected to permit the real backend origin.
- API base URL validated against malformed env values.
- Cold-start tolerance (warm-up ping, 45s timeouts, attempt budget preserved on network failure).
- Componentization + `React.lazy` code splitting of the four heavy screens.
- Error boundary, offline page, update toast, correct SW cache headers.

**Repo**
- `.env` removed from tracking; `.gitignore` covers `.env`, `Backend/.env`, `.env.*`, and all `node_modules`.
- WebAuthn passkeys implemented end-to-end including signature counter updates.

---

## 6. SECURITY LOOPHOLES AND BREAK POINTS

Ranked by real-world exploitability. File:line references are to current `main`.

### CRITICAL

**C1 — The OTP is returned in the API response.** `server.js:128`
```js
return res.status(200).json({ ..., prototypeOtp });
```
Anyone can POST any phone number to `/api/otp/send` and read that number's OTP straight out of the JSON. This defeats phone ownership verification entirely — which is the single root of trust for the whole system.

**C2 — No authentication layer exists.** Entire backend.
No JWT, no session, no cookie, no bearer token, no auth middleware. Every route takes `symbolId` as a plain parameter and trusts it. Directly exposed without any credential:
- `GET /api/profile/:symbolId` — anyone's name, email, phone (`server.js:642`)
- `PUT /api/profile/:symbolId` — **edit anyone's profile** (`server.js:673`)
- `GET /api/transactions/history/:symbolId` — **anyone's full transaction history** (`server.js:1480`)
- `POST /api/pin/set` — **set a PIN on any account that doesn't have one** (`server.js:215`)
- `GET /api/users/resolve` — enumerate the entire user base (`server.js:1189`)

**C3 — Full account takeover chain.** C1 + C2 compose into a three-request attack:
1. `POST /api/otp/send` with the victim's number → OTP arrives in the response.
2. `POST /api/otp/verify` with that OTP → verified.
3. `POST /api/pin/reset` with the victim's symbolId + number + a new PIN → attacker owns the account and can send money as them.

No SMS interception, no social engineering, no special access required.

**C4 — Default PIN fallback.** `server.js:297–306`
```js
if (!pinRecord) {
  const prototypePin = process.env.DEFAULT_LOGIN_PIN || '1234';
  if (cleanPin === prototypePin) return res.json({ verified: true, ... });
}
```
Any account without a PIN authenticates with `1234`. This path also **bypasses the lockout entirely** — there is no `Pin` record, so there are no `failedAttempts` to increment. Unlimited guessing against a known constant.

**C5 — CORS open to every origin.** `server.js:18` → `app.use(cors())`
Any website can call this API from any visitor's browser. With no auth (C2), origin restriction was the last remaining control. Both are absent.

### HIGH

**H1 — No server-side rate limiting anywhere.** No `express-rate-limit`, no throttle. `/api/otp/send` in particular is unbounded and does a bcrypt hash (cost 10) per call — that is both a DB-flooding vector and a CPU-exhaustion DoS. When real SMS is wired up, it becomes an unbounded financial liability.

**H2 — WebAuthn rpID derived from the attacker-controllable `Origin` header.** `server.js:754–762`
```js
const requestOrigin = req.get('origin') || 'https://gloobal.netlify.app';
const parsedOrigin = new URL(requestOrigin);
return { rpID: parsedOrigin.hostname, origin: requestOrigin };
```
An attacker sends their own `Origin` and gets a passkey ceremony bound to *their* domain, defeating WebAuthn's core origin-binding guarantee. Must be an allowlist of known origins.

**H3 — No atomicity on money movement.** `server.js:1399–1451`
`Transaction.create()`, then `LedgerEntry.create([...])`, then `status = 'success'` — three separate writes with no MongoDB session/transaction. A failure between them leaves an orphaned transaction or unbalanced ledger. There is no reconciliation job to detect it.

**H4 — Idempotency is a race, not a guarantee.** `server.js:1362–1376`
The key is checked with a `findOne` query, but `metadata.idempotencyKey` has **no unique index**. Two concurrent requests both read "not found" and both insert. Classic double-spend TOCTOU. The 15-second duplicate guard (`server.js:1380`) has the same flaw.

**H5 — Unauthenticated user enumeration with PII.** `server.js:1189`
`GET /api/users/resolve?identifier=...` returns `fullName`, `email`, `mobileNumber`, `symbolId` for any phone number, with no auth and no rate limit. The entire Indian mobile number space can be walked to harvest the full user database.

**H6 — The second factor is optional.** `App.jsx:314` — *"A passkey is optional (Skip for now is always available)."* The passkey is real and correctly implemented, but any user (or attacker who has taken over via C3) can skip it. It provides no security guarantee as deployed.

### MEDIUM

**M1 — Internal error messages leaked to clients.** `server.js:855, 935, 988, 1060` return `error.message` in the response — stack-adjacent detail useful for probing.

**M2 — No `helmet`, no security headers on the backend.** The frontend is well-hardened; the API serves bare.

**M3 — `currentChallenge` is a single slot on the User document,** with no expiry. Concurrent ceremonies clobber each other; a stale challenge stays valid indefinitely.

**M4 — 4-digit PINs permitted** (`server.js:213` allows 4–6). 10,000-value space. Lockout mitigates online guessing but does not apply on the C4 path.

**M5 — AuditLog and Notification models are never written to.** No security telemetry, no anomaly detection, no forensic trail after an incident.

**M6 — `.env` remains in git history** (see §4.6). No live credential was exposed, but the blob is still reachable and history was never purged.

### Assessed and found NOT to be a problem

- **NoSQL injection** — every user input is coerced with `String(...)` before reaching a query, so operator-object injection (`{$ne: null}`) does not work. This is genuinely handled correctly.
- **Password/PIN storage** — bcrypt throughout, no plaintext, correct comparison. Solid.
- **OTP storage** — hashed, expiring, attempt-capped, single-use. Well built.

---

## 7. WHAT "NO MONEY EXISTS" MEANS

Worth stating separately because it's structural, not a bug:

- No `balance` field exists on any model.
- `LedgerEntry.balanceBefore` and `balanceAfter` are written as literal `0` on every entry (`server.js:1425–1427`, `:1440–1442`).
- No balance check before a send — a user with nothing can send ₹5,000.
- `status` is set to `'success'` unconditionally; nothing settles.
- The dashboard balance is the hardcoded string `"12,480.50"`.
- No bank rails, no UPI/NPCI integration, no PSP, no escrow, no nodal account.

The Transaction and LedgerEntry *schemas* are well designed for real money (they model holds, refunds, reversals, double-entry). The logic to use them doesn't exist yet.

---

## 8. DISTANCE FROM INDUSTRY-GRADE FINTECH

Compared against what PhonePe / Google Pay / Paytm / Razorpay actually run.

| Dimension | Industry standard | Gloobal today | Gap |
|---|---|---|---|
| Authentication | OAuth2/JWT, device binding, short-lived refresh tokens | None — bare `symbolId` | **Total** |
| Authorization | Per-resource ownership checks on every call | None | **Total** |
| Money movement | Double-entry ledger, atomic, reconciled daily | Ledger rows with 0 balances, non-atomic | **Total** |
| Bank rails | UPI/NPCI, PSP sponsor bank, nodal account | None | **Total** |
| KYC/AML | Aadhaar/PAN eKYC, sanctions screening, STR filing | None | **Total** |
| Licensing | RBI PPI licence or PSP-sponsor arrangement | None | **Total** |
| Fraud/risk | Real-time ML scoring, velocity rules, device fingerprint | None | **Total** |
| Rate limiting | Multi-layer (WAF, gateway, app) | Client-side only, self-admittedly cosmetic | **Severe** |
| Audit logging | Immutable, tamper-evident, retained 7–10 yrs | Model exists, never written | **Severe** |
| Encryption | Field-level for PII, HSM-backed keys | TLS in transit only | **Severe** |
| Availability | Multi-region, 99.99%, DR drills | Single Render free instance that sleeps | **Severe** |
| Testing | Unit + integration + load + chaos, CI-gated | 1 e2e spec, no backend tests, no CI | **Severe** |
| Compliance | PCI-DSS, SOC 2, RBI data localisation, pen tests | None | **Total** |
| Frontend/PWA | — | **Genuinely competitive** | **Small** |
| Data modeling | — | **Good — anticipates real needs** | **Small** |

### Honest scoring

- **UI / UX / PWA polish: ~75% of industry grade.** The frontend would not embarrass itself next to a real app.
- **Backend engineering: ~20%.** Correct primitives, zero architecture around them.
- **Security posture: ~5%.** Trivially exploitable end-to-end today.
- **Regulatory/financial readiness: ~0%.** Nothing has been started.

**Overall: roughly 15–20% of the way to a shippable fintech product**, and that figure is generous because it weights the strong frontend equally.

### The realistic framing

The engineering gap is perhaps **6–12 months** of focused work for a small team. The **regulatory gap is the real wall**: an RBI Prepaid Payment Instrument licence requires ₹15 crore minimum net worth, or alternatively a sponsor-bank/PSP arrangement (Razorpay, Cashfree, Juspay) that lets you operate under someone else's licence. UPI access is only through an NPCI-certified PSP bank. **No amount of code quality substitutes for this.** Most startups in this position take the PSP-partner route.

---

## 9. RECOMMENDED PRIORITY ORDER

**Immediately (this week — the app is currently exploitable):**
1. Remove `prototypeOtp` from the `/api/otp/send` response. **(C1)**
2. Delete the `DEFAULT_LOGIN_PIN` fallback branch entirely. **(C4)**
3. Lock CORS to the Netlify origin. **(C5)**
4. Add `express-rate-limit` to `/api/otp/*`, `/api/login`, `/api/pin/*`, `/api/transactions/send`. **(H1)**
5. Replace WebAuthn's `Origin`-derived rpID with a hardcoded allowlist. **(H2)**

**Next (2–6 weeks):**
6. Introduce real sessions — JWT or signed httpOnly cookie — and an auth middleware. Then require ownership on every `:symbolId` route. **(C2, C3)**
7. Add a unique compound index on `(fromUserId, metadata.idempotencyKey)`. **(H4)**
8. Wrap transaction + ledger writes in a MongoDB session. **(H3)**
9. Add `helmet`; stop returning `error.message`. **(M1, M2)**
10. Start writing to `AuditLog` on every auth and money event. **(M5)**

**Then (structural):**
11. Split `server.js` into the `src/` router/controller structure already scaffolded — and delete the 0-byte files.
12. Add backend integration tests + CI gating on `main`; stop merging unreviewed.
13. Collapse the three CSP copies into one generated source; delete `vercel.json`.
14. Update `CLAUDE.md` and `.env.example` to match reality.
15. Split `DashboardScreen.jsx` (164 KB).
16. Implement real balances, or clearly label the app a prototype in-product.

**Strategic (parallel track, start conversations now):**
17. Engage a PSP/sponsor bank — this has a long lead time and gates everything else.
18. Budget for a third-party penetration test before any real money touches the system.

---

## 10. CLOSING ASSESSMENT

Gloobal's frontend and data modeling show real craft — the PWA hardening, cold-start handling, and schema foresight are better than typical prototype work, and several code comments are admirably honest about their own limitations.

The backend has the right primitives assembled in the wrong shape: correct bcrypt, correct OTP lifecycle, correct lockouts — with no authentication layer wrapping any of it. The result is a system whose individual security components work and whose overall security posture is nil.

The single highest-value change is not a feature. It is adding sessions and an authorization check, and removing the OTP from that response body. Until then, the app should not be shared publicly, promoted, or given any real user data — and the fake `12,480.50` balance should not be shown to anyone who might mistake it for their own money.

*Report generated by Claude Code — findings verified against source, not inferred from documentation.*
