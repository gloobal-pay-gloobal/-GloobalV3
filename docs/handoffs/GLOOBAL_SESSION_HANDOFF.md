# Gloobal — Session Handoff / Context Transfer Document

**Date of session:** 18–20 August 2026
**Purpose:** Complete context transfer so another model or developer can pick up this project without re-discovering anything.
**Status at handoff:** All code work merged to `main`. Two infrastructure tasks outstanding (see §9).

---

## 1. What Gloobal is

Gloobal is a cross-border payments app (React frontend, Express + MongoDB Atlas backend). Users register with a mobile number, create a "Gloobal ID" (a 12-character symbol ID), set a PIN, optionally enroll biometrics, and can then send money to other Gloobal users across countries with live FX conversion. Additional surfaces include Gloobal Bank, Gloobal Coin, PayLater, My Assets, Transaction History, and Gloobal Coverage.

Owner account: `gloobalpay@gmail.com`. There is at least one other active contributor: **Aditya-Raj-oss**, who commits directly to the backend repo (was actively pushing backend fixes during this session — see §6.3).

---

## 2. Infrastructure map (CURRENT, post-consolidation)

This was a major theme of the session. The project had sprawled into 4 Netlify sites and 3–4 GitHub repos. It has been consolidated. **Current true state:**

### GitHub (org: `gloobal-pay-gloobal`)
| Repo | Contents | Status |
|---|---|---|
| `GloobalV3` | Frontend + (now) real backend under `server/` | **The monorepo. Single source of truth.** |
| `Gloobal` | Legacy backend repo | Still exists; no longer the deploy source. Candidate for archive/deletion once monorepo is proven. |

Deleted during session: `GloobalApp-` (unrelated/duplicate app).

### Netlify
| Site | Status |
|---|---|
| `gloobalv3.netlify.app` | **The only live site.** Deploys from `GloobalV3`, branch `main`. |

Deleted during session: `gloobal.netlify.app`, `gloobalapp.netlify.app`, `gloobal-v2.netlify.app`.

### Render (workspace `tea-d8g24fernols73d56i9g`)
| Service | Detail |
|---|---|
| **Gloobal Pay** (`srv-d8kft3jbc2fs73cho5e0`) | The **live API** at `https://gloobal-pay.onrender.com`. Free plan, Singapore region, Node, `npm install` / `node server.js`. Auto-deploys on commit from branch `main`. **Repo has been repointed to `GloobalV3`. Root Directory still needs changing from `Backend` → `server` (see §9).** |
| **Gloobal** (`srv-d8g26m19rddc73b11150`) | Older service at `gloobal.onrender.com`. Not the one the app calls. Left alone. |

### Local folders (Windows machine `sanjeevsantosh1234`)
| Path | Contents |
|---|---|
| `D:\gloobal-new version` | The `GloobalV3` monorepo checkout. **Still needs renaming to `D:\gloobalv3` (see §9).** |
| `D:\Desktop\Gloobal` | Legacy backend repo checkout. Source of the `server/` merge. |
| `D:\gloobalv3` | **Stray empty folder** created by a mis-targeted robocopy. Safe to delete. |

---

## 3. Frontend architecture — CRITICAL QUIRKS

Understanding these prevents a whole class of build failures. Do not skip this section.

### 3.1 The concatenated-bundle build system

The frontend does **not** use normal ES module imports between its own files. Instead:

- Source lives in `frontend/` (React UI) and `backend/` (a **local-only JS domain simulation** — *not* the real server).
- `build_app.mjs` concatenates an ordered list of files (`FRONTEND_MODULES` and `BACKEND_MODULES` arrays) into a single file: `gloobal-essentials-preview/src/GloobalApp.jsx`.
- Vite then compiles only that one generated artifact.

**Consequences:**

1. **Everything shares one global scope.** Top-level `function` declarations hoist across the entire concatenated file, so a function defined in a "later" file can be called by an "earlier" one. This is used deliberately (e.g. `httpClient.js` calls `gloobalAuthToken()` defined later in `sessionStore.js`).
2. **Top-level `var` names must be globally unique across the whole app.** A collision produces a production build error: `The symbol "X" has already been declared`. This bit twice this session.
3. **New files must be added to `FRONTEND_MODULES` in `build_app.mjs`** or they simply won't exist in the build.
4. Always run `node build_app.mjs` after editing source, before building.

### 3.2 Numbered hook/icon import aliases

Because of the single global scope, every source file imports React hooks under **file-specific numbered aliases**:

```js
// App.jsx
import { useState as useState19, useEffect as useEffect15, useRef as useRef13 } from "react";
// Dashboard.jsx
import { useState as useState14, useEffect as useEffect12, useRef as useRef10 } from "react";
// SendMoney.jsx
import { useState as useState15, useEffect as useEffect13, useRef as useRef11, useMemo as useMemo6 } from "react";
```

The same applies to `lucide-react` icons: `Search as Search4`, `Lock as Lock7`, `X as X3`, etc.

**Rule:** before introducing any new hook or icon import, `Grep` the whole `frontend/` tree for the highest existing number of that symbol and use the next one. Bare/unaliased names are usually already taken.

### 3.3 `useBackClose(isOpen, onClose)` — easy to misuse

Located at `frontend/hooks/useBackClose.js`. Wires the hardware/browser Back button to close a full-screen overlay via a `pushState`/`popstate` stack.

**The trap:** the hook *returns* a function. That **returned function** must be used as the actual UI close handler (header X button, row taps, backdrop clicks) — not the `onClose` callback you passed in. If you use the passed-in callback directly, the pushed history entry goes unconsumed and a later real Back press silently gets eaten.

```js
// CORRECT
const requestCloseMap = useBackClose(open, () => setOpen(false));
<button onClick={requestCloseMap}>×</button>

// WRONG — history entry leaks
useBackClose(open, closeMap);
<button onClick={closeMap}>×</button>
```

Precedent to copy: `requestCloseActiveScreen` in `App.jsx`.

### 3.4 `App.jsx` state machine

- A single `stage` string drives the whole pre-dashboard flow: `"permissions"` → `"phone"` → `"otp"` → `"secureId"` → `"referral"` → `"profile"` → `"pin"` → `"biometric"` → `"dashboard"`, plus `"loginAuth"` / `"loginBiometric"`.
- Transitions go through `flipTo(next)`, which animates with a 220 ms delay. **`flipTo` is also where `hasEverRegistered` gets marked** on first reach of `"dashboard"`.
- Login **reuses** the `"secureId"` / `"loginAuth"` / `"loginBiometric"` stages; it's distinguished by the `isLoginAttempt` boolean, not by separate stage values.
- A second, narrower `activeScreen` state (`null` | `"send"` | `"bank"` | `"coverage"`) drives App-level overlays, independent of Dashboard's own internal `show*` booleans (`showGloobalBankInfo`, `showGloobalCoinInfo`, `showPayLater`, `showAssets`, `showEssentials`, `showAboutUs`).

### 3.5 API client

`backend/services/api/httpClient.js` + `gloobalApi.js`:
- Base URL from `VITE_API_URL` if it's an absolute http(s) URL, else falls back to `https://gloobal-pay.onrender.com`.
- 45 s timeout on *every* call (deliberate — Render free tier cold starts take 20–50 s).
- Bearer token read **per request** from the stored session blob (never cached in a variable, because it changes on login/registration/PIN reset/passkey).
- `GloobalApiError` carries `.status`. `status === 0` means "never got an answer" (timeout/offline/cold start) — callers must treat that differently from a real rejection.

### 3.6 PWA

`VitePWA` with `registerType: "autoUpdate"` generates `sw.js` / `workbox-*.js`. **A stale service worker can make a correct deploy look wrong.** When live-vs-local looks different, always test with a hard refresh (Ctrl+Shift+R) or incognito before assuming a merge problem.

---

## 4. Feature work completed this session

All of the following is merged to `main` and live.

### 4.1 Unified living-logo / splash component

**Goal:** make "the logo" and "the splash screen" one identical living 3D flip component.
**User's explicit scope decision:** only the Bank/Coin hero circle — *not* the PIN dial pad, *not* the card flip-icons.

Implementation:
- `frontend/components/common/flipIcons.jsx` — added two components:
  - `LivingLogoBoxVisual` — pure presentational flip box. Props: `front`, `back`, `flipped`, `size="52vw"`, `maxSize=240`, `contentFill="66%"`, `borderRadius="22%"`, `flipMs=500`, `symbolFontSize="33vw"`, `symbolMaxWidth=158`. All defaults chosen to exactly match the splash's original values.
  - `LivingLogoBox` — stateful wrapper; continuous loop, `LIVING_LOGO_FACE_MS = 2000`, uses `shuffledDialSymbols()` from `launchSplash.jsx`.
- `frontend/components/common/launchSplash.jsx` — now renders `<LivingLogoBoxVisual …/>` instead of its old duplicated inline JSX. Keeps its own phase/fade timing. Reduced-motion path still renders a plain static `<img>`.
- `frontend/components/cards/GloobalTaglineCard.jsx` — `ProductScreenHero({ color })` rewritten to render `<LivingLogoBox size={168} shape="circle" />`. The `color` prop is now unused but **kept in the signature** so `GloobalBankScreen.jsx` / `GloobalCoinScreen.jsx` callers didn't need changes.

**3D flip pattern used throughout the codebase:** two absolutely-positioned faces with `backfaceVisibility: hidden`; content on the *currently hidden* face is updated via a step/slots counter so swaps are never visible mid-flip. Same pattern in `FlippingMenuIcon`, `GH2HFlipCircle`, `IdSymbolDots`.

### 4.2 App Map (new feature)

A draggable, edge-snapping floating icon on all screens that opens a searchable full-screen list of destinations.

**New file:** `frontend/components/common/appMap.jsx`
- `loadMapIconPos` / `saveMapIconPos` — localStorage key `gloobal.mapIconPos.v1`
- `AppMapButton` — drag / tap / edge-snap logic
- `AppMapRow`, `AppMapSection` — list rendering
- `AppMapOverlay` — search field + Unlocked/Locked sections
- `AppMapLauncher` — owns open/query state; uses `useBackClose`'s **returned** `requestCloseMap` correctly

**Also edited:**
- `build_app.mjs` — added `"components/common/appMap.jsx"` to `FRONTEND_MODULES`, immediately before `"App.jsx"`
- `App.jsx` — added `hasEverRegistered()` / `markEverRegistered()` (`GLOOBAL_HAS_REGISTERED_KEY = "gloobal.hasEverRegistered.v1"`), `everRegistered` state, `dashboardDeepLink` / `pendingMapDestination` state + effect, `goToRegistrationStart`, `goToLogin`, `applyDashboardDestination`, `goToDashboardDestination`, `handleAppMapLockedPress`, the 13-entry `appMapEntries` array, and `<AppMapLauncher>` as the last element of the outer return
- `Dashboard.jsx` — accepts `deepLinkTarget` / `onConsumeDeepLink`; an effect maps `"bank"`/`"coin"`/`"assets"`/`"paylater"`/`"aboutus"` to the matching `setShow*(true)` then calls `onConsumeDeepLink()`

**User's design decisions (gathered via structured questions — do not re-litigate these):**
- Lock state keys off **"has ever registered"**, not "currently signed in"
- Tapping a locked entry **jumps to the screen that unlocks it**
- Pre-registration entries: Mobile Number, Create Gloobal ID, Referral Code, Login. **Login is never locked** (it's the right destination for a registered-but-signed-out device)
- Locked entries appear in a **separate "Locked" section below** the unlocked ones
- Icon is a **generic map/search icon**, not the brand logo
- **Main destinations only**, not every flow-step screen
- Snap position **persists** across sessions

`hasEverRegistered` was modelled on the existing `hasSeenPermissionsGate()` / `markPermissionsGateSeen()` pattern — both guard against private-mode `localStorage` throws and fall back safely rather than crashing.

### 4.3 Profile card resize

- `Dashboard.jsx` — added module-level `GH_HERO_CIRCLE_SIZE = 136` (up from ~76) and `GH_ID_ROW_RESERVE = 10`; ID row `paddingRight` now uses the reserve; `<IdSymbolDots … oneLine size={48} />`
- `coloredId.jsx` — `IdSymbolDots`: removed the artificial `oneLine` cap (`Math.min(size + 4, 24)` → `size`). Each dot is `flex: 1 1 0` with `maxWidth: dotSize`, so the row already self-limits; the extra cap was only ever making dots smaller than the available space.

**Known limitation, disclosed to the user, not yet resolved:** 12 dots in a strict single-line row on a fixed-width mobile card hit a hard geometric ceiling at roughly **20–25 px per dot** (measured ~20.7 px via Playwright `getBoundingClientRect()`), regardless of how much padding is trimmed. The circle enlargement was a clean win; the dots improved (from ~15 px) but cannot get "much bigger" while staying on one line. **An alternative was offered — wrap to 2 rows of 6 — and the user has never answered.** This is still an open question.

Measured geometry for reference: circle 136×136 at y=97.5 (bottom 233.5); ID row starts y=260 (26.5 px clear, no overlap); card 354×223; ID row width 292 px.

---

## 5. Bugs found and fixed this session

### 5.1 `useRef9` symbol collision — production build failure

`flipIcons.jsx` introduced `useRef9`, which `TransactionHistoryScreen.jsx` already used → `The symbol "useRef9" has already been declared`. Fixed by renaming to `useRef15`. **This is why §3.2's grep-before-you-import rule exists.**

### 5.2 `useBackClose` misuse in `AppMapLauncher`

Caught before shipping. Initial implementation discarded the hook's return value. Fixed per §3.3.

### 5.3 `GH_ID_ROW_RESERVE` sizing backfire

Initially set to `Math.round(GH_HERO_CIRCLE_SIZE * 0.9)` ≈ 122 px on the theory that the row needed to dodge the bigger circle horizontally. This **made the dots smaller** — the opposite of the goal — because the card's existing `aspectRatio` + `flex-end` layout already kept them clear *vertically*. Diagnosed by direct Playwright measurement, then reduced to a 10 px safety margin.

### 5.4 Blank white screen on production — `GLOOBAL_ACCOUNT_SWITCH_EVENT is not defined`

**The single most time-consuming issue of the session. Worth understanding the full arc.**

- **Symptom:** `gloobalv3.netlify.app` rendered a blank white page.
- **Diagnosis:** live browser console (via Chrome MCP tools) showed `ReferenceError: GLOOBAL_ACCOUNT_SWITCH_EVENT is not defined`, thrown during initial mount — before React rendered anything, hence blank.
- **Confirmed:** the user's local disk copies of `sessionStore.js` (line 264) and `__artifactEntry.jsx` both correctly defined/used the symbol. So the delivered source was fine.
- **Root cause:** the fix to `sessionStore.js` had been sitting as an **uncommitted, unstaged working-tree modification** — never committed on *any* branch, ever. Other files that *referenced* the symbol had been committed and merged; the file that *defined* it had not. Netlify built `main`, which was missing the definition.
- **Why it was hard to see:** an earlier `git status` had appeared to show the file as unmodified; `git log --all -S "GLOOBAL_ACCOUNT_SWITCH_EVENT"` found nothing (correctly — there was no commit to find); `git diff main..feature/…` was empty. Each result was individually confusing but collectively consistent with "never committed at all."
- **Fix:** committed as `4f697f8` "Fix account switch notification in sessionStore", merged to `main`.

**Transferable lesson:** when a symbol is undefined in production but present locally, check `git diff HEAD -- <file>` early. "Not in `git status`" and "not in any commit" are different claims and the second one is what mattered.

### 5.5 Send Money used the *sender's* country for the *recipient*

**Real product bug, user-reported.**

In `SendMoney.jsx`'s `resolveSearch()`, once a Gloobal ID search resolved a recipient, the receiver card was built from `effectiveSearchCountry` (`c`) — which is just whichever country flag the **sender** had selected while dialling, defaulting to their own. The resolved `user` object's actual country was never consulted.

Effect: an Indian sender searching an American recipient's Gloobal ID saw the amount dial in **₹ under an Indian flag** — correct person, wrong currency and flag, and (via the `convert` call that reads the same field) the wrong amount had it been sent.

Fix — derive the recipient's real country, with graceful fallbacks:
```js
const recipientCountry =
  ALL_COUNTRIES.find((country) => country.iso === user.countryIso) ||
  matchCountryFromContactNumber(user.mobileNumber).country ||
  c;
```
Then `country`, `flag`, and `currency` all read from `recipientCountry`. The live FX conversion inherits the fix automatically since it reads `bottom.currency`.

`matchCountryFromContactNumber` is the same dial-code longest-prefix matcher the contact picker uses.

### 5.6 "Sign in to continue" — dead session with no way out

**Symptom:** mid-session, Send Money's search would fail with "Sign in to continue" and a disabled Search button, with no route back to an actual sign-in screen.

**Root cause (server-side):** Render's startup log states it plainly:
> `WARNING: AUTH_TOKEN_SECRET is not set. Using a random key generated at boot — every restart will sign everybody out. Set it in the environment.`

Render's free tier spins down when idle. Every cold boot generates a **new** random signing secret, instantly invalidating every previously issued session token. Users looked signed in locally but every authenticated call 401'd.

**Frontend mitigation (shipped):** the app now recovers gracefully instead of stranding people.
- `httpClient.js` — added `var GLOOBAL_SESSION_EXPIRED_EVENT = "gloobal:sessionExpired";` and, in the existing 401 branch that clears the token, added `window.dispatchEvent(new CustomEvent(GLOOBAL_SESSION_EXPIRED_EVENT))`.
- `App.jsx` — a top-level `useEffect15` listens for it and: clears `activeScreen`, clears `dashboardDeepLink`, clears `pendingMapDestination`, shows the toast "Your session expired. Please sign in again.", then calls `goToLogin()`.

Chosen at App level rather than per-screen deliberately: a cleared token signs out the *whole app*, so no individual screen can meaningfully recover on its own.

**Server-side fix (STILL OUTSTANDING — see §9).** The frontend fix stops users getting stuck; it does **not** stop the sign-outs. Only setting `AUTH_TOKEN_SECRET` does that.

---

## 6. Git history and repo consolidation

### 6.1 Commits landed on `GloobalV3` `main`

| Commit | Description |
|---|---|
| `5529485` | Fix registration/login bugs, unify logo+splash, add app map, resize profile card (18 files, +790/−73) |
| `4f697f8` | Fix account switch notification in sessionStore (the blank-screen root cause) |
| `316ec22` | Redirect to Login on session expiry; fix Send Money currency/flag to use recipient's own country |
| `7f28a6b` | Merge PR #4 |
| `7d7a948` | Merge PR #5 — real backend source into monorepo under `server/` |

Working branch used throughout: `feature/app-map-and-profile-card`, then `feature/merge-backend-monorepo`.

### 6.2 The monorepo merge (PR #5)

The legacy `Gloobal` repo was itself a mini-monorepo (`Backend/` = the real Express server, plus an unrelated older `Frontend/`). Only `Backend/` was wanted.

Copied via:
```powershell
robocopy "D:\Desktop\Gloobal\Backend" "D:\gloobal-new version\server" /E /XD node_modules /XF .env
```
Then `server/node_modules/` and `server/.env` were appended to `.gitignore`, and `Test-Path server\.env` was verified to return `False` before committing. **No secrets entered git.**

**Why `server/` and not `backend/`:** `GloobalV3` *already* has a `backend/` folder — the local JS domain simulation used for offline dev. It is **not** the real server. Renaming it would have meant touching every file that references it. Two different things named "backend" now coexist:
- `backend/` = local dev simulation, compiled into the frontend bundle
- `server/` = the real Express + MongoDB API deployed to Render

The real server's `package.json` is named `gloobal-database`, CommonJS, Node 20.x, deps: express 5, mongoose 9, bcrypt, cors, dotenv, @simplewebauthn/server. Its `server.js` is ~228 KB.

### 6.3 Concurrent backend work by another contributor

While this session's frontend fix was being written, **Aditya-Raj-oss** independently pushed matching backend fixes to the `Gloobal` repo:
- `1a32161` — "fix: return countryIso so the client can show the account's real country"
- `3b51228` — "fix: keep the registered country, expose accountId, repoint every renamed reference"
- `5ba7464` — "fix: resolve returns the receiver's country so payments can show it"

These corroborate the §5.5 fix — `user.countryIso` is a real field the backend now returns. **Implication for whoever picks this up: the backend response shape is actively changing. Verify field names against the live API rather than assuming.**

### 6.4 A recurring source of confusion, for the record

Several times the user reported "git is not updated" while looking at the **wrong repository's** commit page (`gloobal-pay-gloobal/Gloobal`, the backend) rather than `GloobalV3`. Separately, "live design is different from local" was most likely a comparison against `gloobalapp.netlify.app` — a completely different app that happened to deploy 30 minutes after `gloobalv3` on the same morning. Both are now resolved by the consolidation. **When something looks out of sync, confirm which repo/site is being looked at before debugging code.**

---

## 7. Working constraints in this environment

Important for any successor agent:

- **No push access to GitHub from the sandbox.** A direct push attempt returned 403. All git operations must be done by the user in their own terminal, with step-by-step guidance.
- **No GitHub admin access** — repo renames, deletions, and PR merges are user-performed.
- **Netlify MCP is connected** (read + some write). Site listing and deploy inspection work. Site *deletion* is not available.
- **Render MCP is connected** (read + env-var write). Service and deploy inspection work.
- **Deliberately not done by the agent:** setting `AUTH_TOKEN_SECRET`. Writing a server signing secret is a security-setting change and was left to the user by choice, not by tooling limitation.
- **`curl`/bash HTTP fetches of the live site are blocked** by sandbox network policy (returns HTTP 000). The Chrome MCP browser tools are the supported path and were decisive for diagnosing §5.4. Do not attempt curl/Python workarounds.
- **The device bridge (`mcp__remote-devices__*`) is intermittent** — it depends on the user's desktop app being open. `device_stage_files` reads from the laptop; `device_commit_files` writes to it and requires a real `fileUuid` from a prior `SendUserFile` call, plus `expectedMtimeMs` to avoid clobbering newer user edits.

### 7.1 Line-ending gotcha

The sandbox working copy of `SendMoney.jsx` had CRLF line endings while the laptop copy had LF, which made `diff` report the entire file as changed. Normalise with `sed -i 's/\r$//'` before diffing, or the real change becomes invisible in the noise.

### 7.2 Verification practice that worked well

Before overwriting any laptop file: `device_stage_files` the current version, then `Grep` for a fix-specific marker string, then `diff` against the sandbox version. This caught the line-ending issue and confirmed no double-patching or overwriting of newer unsynced work. Worth continuing.

### 7.3 Build verification

`npm run build` in `gloobal-essentials-preview` fails in the sandbox for an **unrelated pre-existing reason** — `DebugHarness.jsx` imports `_dbg_*` symbols that `build_app.mjs` doesn't export. This is not caused by any of this session's changes. Workaround used for syntax checking:
```bash
npx esbuild src/GloobalApp.jsx --jsx=automatic --outfile=/tmp/out.js
```
The full `npm run build` **does** succeed on the user's laptop (verified — 23.6 s, 21 precache entries).

---

## 8. Files touched this session (complete list)

**Frontend:**
- `frontend/App.jsx` — app map wiring, `hasEverRegistered`, deep links, session-expiry listener
- `frontend/screens/Dashboard/Dashboard.jsx` — hero circle size, ID row reserve, deep-link handling
- `frontend/screens/SendMoney/SendMoney.jsx` — recipient country/currency/flag fix
- `frontend/components/common/appMap.jsx` — **NEW**
- `frontend/components/common/flipIcons.jsx` — `LivingLogoBoxVisual`, `LivingLogoBox`
- `frontend/components/common/launchSplash.jsx` — uses shared visual
- `frontend/components/common/coloredId.jsx` — removed `oneLine` dot-size cap
- `frontend/components/cards/GloobalTaglineCard.jsx` — hero uses `LivingLogoBox`

**Backend-for-frontend (the simulation layer):**
- `backend/services/api/httpClient.js` — session-expired event
- `backend/services/api/sessionStore.js` — `GLOOBAL_ACCOUNT_SWITCH_EVENT` definition (the blank-screen fix)

**Build:**
- `build_app.mjs` — registered `appMap.jsx`
- `.gitignore` — `server/node_modules/`, `server/.env`

**Added wholesale:**
- `server/**` — the real Express backend (models, controllers, routes, scripts, tests, `server.js`, `package.json`)

---

## 9. OUTSTANDING — what still needs doing

### 9.1 Render Root Directory (BLOCKING — live backend is not deploying)

The Gloobal Pay service now clones `GloobalV3` correctly and picks up merge commit `7d7a948`, but the build fails with:
> `Root directory "Backend" does not exist. Verify the Root Directory configured in your service settings.`

**Fix:** Render dashboard → Gloobal Pay → Settings → Build & Deploy → **Root Directory: `Backend` → `server`** → Save → trigger a deploy. Also confirm Build Command is still `npm install` and Start Command is still `node server.js` (both should remain valid, since `server.js` sits at the top of `server/` exactly as it did inside `Backend/`).

**Note:** the last *successful* deploy is still serving traffic, so this is a silent drift rather than an outage — but no backend change ships until it's fixed.

### 9.2 `AUTH_TOKEN_SECRET` (HIGH — users are being signed out repeatedly)

Render dashboard → Gloobal Pay → Environment → add `AUTH_TOKEN_SECRET` with any long random string. Until this is set, every cold start signs out every user (see §5.6). Setting it triggers one final redeploy and one final mass sign-out, after which sessions survive restarts.

### 9.3 Rename the local folder (LOW)

`D:\gloobal-new version` → `D:\gloobalv3`, for consistency with the repo and Netlify site names. Close VS Code first. Then delete the stray empty `D:\gloobalv3\server` folder left by the mis-targeted robocopy (it is not a git repo, just an accident).

### 9.4 Rename the GitHub repo (LOW, optional)

`GloobalV3` → `gloobalv3` for naming consistency. GitHub redirects the old URL and Netlify/Render link by internal repo ID, so this is low-risk — but afterwards run `git remote set-url origin https://github.com/gloobal-pay-gloobal/gloobalv3.git` locally.

### 9.5 Archive or delete the legacy `Gloobal` repo (LOW)

Once §9.1 is confirmed working and the monorepo has proven itself for a few deploys. **Do not delete before then** — it is the last known-good copy of the backend and the older Render service still points at it.

### 9.6 Unanswered product question

The 12 ID dots on the profile card cannot get meaningfully bigger while constrained to one line (§4.3). A two-rows-of-six layout was offered and **the user has never responded**. Worth re-asking if profile-card polish comes up again.

---

## 10. Suggested first moves for a successor

1. Confirm §9.1 is done — check the Render deploy log for a successful `node server.js` start and `Connected to MongoDB Atlas`.
2. Confirm §9.2 — the `AUTH_TOKEN_SECRET is not set` warning should be **absent** from the startup log.
3. Load `gloobalv3.netlify.app` in incognito, register or sign in, and exercise Send Money against a recipient in a different country — verifying §5.5 end-to-end now that the backend returns `countryIso`.
4. Read §3 before touching any frontend code.
