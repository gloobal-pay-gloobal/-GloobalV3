# Gloobal — Financial Platform

## Repository and deployments

`gloobal-pay-gloobal/GloobalV3` is the **single source of truth**. One
repository, one branch, two deploy targets — no other repository or
deployment source is part of normal development.

| | |
|---|---|
| Local workspace | `D:\gloobalv3` |
| Git | `https://github.com/gloobal-pay-gloobal/GloobalV3.git` |
| Branch | `main` |
| Frontend | Netlify — https://gloobalv3.netlify.app |
| Backend | Render — https://gloobal-pay.onrender.com (root `server`, start `node server.js`) |
| Database | MongoDB Atlas |

### Workflow

```
edit in D:\gloobalv3
        ↓
node build_app.mjs        # after any change under frontend/ or backend/
        ↓
test  (see Diagnostics and financial-principles-tests/)
        ↓
git add → git commit → git push origin main
        ↓
Netlify deploys the frontend   +   Render deploys the API
```

Two caveats on that last step:

- **Render auto-deploy is currently broken.** The GitHub webhook went stale
  when the repository was renamed, so a change under `server/` needs a
  manual deploy from the Render dashboard until it is reconnected. Netlify
  is unaffected. See `docs/deployment/README.md`.
- Render only rebuilds when files under `server/` change, so a docs- or
  frontend-only commit correctly leaves it on an older commit.

Older Gloobal repositories elsewhere on disk (`D:\Desktop\Gloobal`,
`D:\Gloobal project`, `D:\GloobalApp`, `D:\gloobal-new version`) and the
GitHub repo `gloobal-pay-gloobal/Gloobal` are **legacy, reference only**.
Nothing live builds from them. See `docs/handoffs/legacy-repositories.md`.

## Project Structure

This project is organized into two main layers:

### `backend/` — Domain Logic & Services
Pure JavaScript modules with zero React dependency. Contains the financial domain model, services, data, and utilities.

```
backend/
├── domain/           # Core financial domain (DDD)
│   ├── shared/       # Shared value objects (Money, ids, ChainStore)
│   ├── ledger/       # Append-only ledger (records, journal entries, engine)
│   ├── accounts/     # Account entities & registry
│   ├── liquidity/    # Liquidity pool & service
│   ├── essentials/   # My Essentials daily pool & grants
│   ├── creatorShare/ # Creator share cashback
│   ├── paylater/     # Pay Later service
│   ├── risk/         # Risk engine & codes
│   ├── settlement/   # Settlement batches & engine
│   ├── receipts/     # Receipt generation
│   ├── provenance/   # Location-based transaction provenance
│   ├── disputes/     # Dispute case management
│   ├── transactions/ # Transaction orchestrator & event outbox
│   ├── events/       # Domain events & event bus
│   ├── capabilities/ # Feature capability states
│   ├── qr/           # QR code encoder
│   ├── diagnostics/  # Health checks, logger
│   ├── replay/       # Ledger replay for auditing
│   ├── resilience/   # Idempotency, offline queue, fault injection, retry
│   ├── simulation/   # Financial simulator
│   └── FinancialCore.js  # Top-level domain orchestrator
├── data/             # Static data (countries, currencies, baselines, banks)
├── utils/            # Pure utility functions (formatting, color, dates, QR)
├── core/             # Core transaction utilities
└── services/         # Platform services (clipboard, web share, storage)
```

### `frontend/` — React UI Layer
React components, screens, features, hooks, and adapters that consume the backend domain.

```
frontend/
├── adapters/         # React adapters bridging domain → UI
│   ├── ledger/       # LedgerProvider, hooks for projections & actions
│   └── diagnostics/  # Diagnostics hook
├── components/       # Reusable UI components
│   ├── buttons/      # Button components
│   ├── cards/        # Card components (flags, misc)
│   ├── charts/       # Chart components (GH ring)
│   ├── common/       # Shared UI (backgrounds, brand, QR, icons, splash)
│   ├── dialogs/      # Modal dialogs (register/login, receipt)
│   ├── inputs/       # Input components (dial pads, code inputs)
│   └── payments/     # Payment UI (options sheet, PIN modal)
├── screens/          # Full-screen views
│   ├── Dashboard/    # Main dashboard
│   ├── SendMoney/    # Send money flow
│   ├── Coverage/     # Gloobal coverage map
│   ├── Banks/        # Bank management
│   └── DevTools/     # Diagnostics & dispute tools
├── features/         # Feature-specific views
│   ├── assets/       # Assets screen
│   ├── essentials/   # Essentials screen
│   ├── history/      # Transaction history
│   └── paylater/     # Pay Later views
├── hooks/            # Custom React hooks
├── constants/        # Theme & design tokens
├── App.jsx           # Main app component
├── main.jsx          # ReactDOM entry (used by preview)
└── __artifactEntry.jsx  # Artifact wrapper with splash screen
```

### `server/` — the real API

Express 5 + Mongoose against MongoDB Atlas, deployed to Render. Not to be
confused with `backend/` above: `backend/` is a domain simulation that runs
in the browser as part of the bundle, `server/` is the production backend
with a database behind it. They are deliberately separate and must not be
merged. See `docs/deployment/README.md`.

### Other Directories

- `gloobal-essentials-preview/` — Vite + React dev server for previewing the app
- `financial-principles-tests/` — domain-layer unit tests (Node.js)
- `tools/` — developer tooling: bundle diagnostics, API checks, mailers.
  Nothing here ships. See `tools/README.md`.
- `docs/` — architecture, deployment, operations, and session handoffs
- `archive/` — reference copies of superseded code; nothing builds from it
- `_trash/` — the retired pre-split monolith and its extraction manifest.
  Gitignored. Nothing uses them; safe to delete. See `_trash/README.md`.

## How the Build Works

The modules under `backend/` and `frontend/` were extracted from a single
bundled file in which every module shared one scope and referenced the
others by bare identifier — there are no `import`s between them. Rather
than hand-wiring hundreds of cross-module imports, `build_app.mjs`
concatenates the modules in their original evaluation order, hoists and
deduplicates the third-party imports, and writes
`gloobal-essentials-preview/src/GloobalApp.jsx`.

That generated file is a build artifact. **The source of truth is
`backend/` and `frontend/`.**

Two consequences worth knowing:

- Module order in `build_app.mjs` is significant. Adding a module means
  adding it to the right position in `BACKEND_MODULES` / `FRONTEND_MODULES`.
- Identifiers are global across all modules, so names must stay unique
  project-wide.

## Getting Started

### Preview the App
```bash
cd gloobal-essentials-preview
npm install
npm run dev        # runs build_app.mjs first, then vite
```

### Run Tests
```bash
cd financial-principles-tests
node scripts/build-test-bundle.mjs     # regenerate after domain changes
node --test tests/*.test.mjs
```

### Build for Production
```bash
cd gloobal-essentials-preview
npm run build      # runs build_app.mjs first; outputs to dist/
```

### Rebuild the Combined Entry File by Hand
```bash
node build_app.mjs
```

## Backend & Database

The app talks to the existing Gloobal backend — the same one the earlier
build used, not a new one:

| | |
|---|---|
| API | `https://gloobal-pay.onrender.com` (Express 5, deployed on Render) |
| Database | MongoDB Atlas, reached **only** through that API |
| Source | `server/` in this repository |

The client lives in `backend/services/api/`:

| File | Purpose |
|---|---|
| `httpClient.js` | fetch wrapper, timeouts, `GloobalApiError`, cold-start warm-up |
| `rateLimiter.js` | client-side attempt throttle (UX speed bump, not the real limit) |
| `sessionStore.js` | `gloobal.session.v1` in localStorage — not a security token |
| `gloobalApi.js` | the endpoint surface, as one global `GloobalApi` object |

Point it elsewhere with `VITE_API_URL` — see `.env.example`.

**The browser never connects to MongoDB.** There is no driver and no
connection string in this bundle; `MONGO_URI` stays in `server/.env` on
the server. Never put a secret behind a `VITE_` variable — those are
inlined into the public bundle.

Render's free tier sleeps when idle, so the first request of a session can
take 20-50s. `GloobalApi.warmUp()` should be fired at app mount, and the
auth calls already use a 45s timeout instead of the 15s default.

Check connectivity any time (read-only, writes nothing):
```bash
cd gloobal-essentials-preview
node tools/check-backend.mjs
```

### What is wired

| Stage | Call | Effect in MongoDB |
|---|---|---|
| phone | `POST /api/otp/send` | writes an `Otp` document |
| otp | `POST /api/otp/verify` | marks it verified |
| secureId | `GET /api/users/resolve` | read-only availability check |
| pin | `POST /api/register-symbol` → `POST /api/pin/set` | **creates the `User` + bcrypt PIN** |
| loginAuth | `POST /api/login` | verifies against the stored hash |
| login by mobile | `GET /api/users/resolve` | finds the Secure ID behind a number |
| Send Money | `POST /api/transactions/send` | writes `Transaction` + paired `LedgerEntry` |

Registration is OTP-gated server-side: `/api/register-symbol` returns 403
unless a verified OTP exists for that number, so the phone and OTP steps
are what make an account possible at all.

### Two behaviours worth knowing

**Transactions are backend-first.** The server re-verifies the PIN,
applies its own duplicate guard and amount ceiling, and writes the rows —
and only then does the local ledger post. A server rejection posts
nothing anywhere, so the UI can never show money the backend refused.

**A payment only reaches the database when both parties are real
accounts.** The receiver pickers in this build are local placeholders with
no server identity, so payments aimed at them have no counterparty in
MongoDB to credit and stay a local simulation — reported as `skipped`,
not as a failure. Anything carrying a resolvable Gloobal ID goes remote.
Closing that gap means sourcing receivers from `/api/users/resolve`.

The local domain layer in `backend/domain/` (FinancialCore, LedgerEngine)
remains as the projection the UI reads and the 166 tests cover. It is a
mirror of server truth for payments, not a second source of it.

### Crash Diagnostics
Render-time checks that do not need a browser. They moved out of
`gloobal-essentials-preview/tools/` and are now run from the repo root —
see `tools/README.md`:
```bash
node tools/frontend/scan-undeclared.mjs   # identifiers referenced but never declared
node tools/frontend/probe-screens.mjs     # screens x 194 countries + edge cases
node tools/frontend/probe-panels.mjs      # panel rendering
node tools/frontend/probe-stages.mjs      # all 10 registration/login stages
node tools/backend/check-backend.mjs      # live API contract
```
They still read `gloobal-essentials-preview/src/GloobalApp.jsx` and still
resolve their dependencies from that project, so it needs `npm install`
first.

## Deployment

The deployable artifact is `gloobal-essentials-preview/dist`. `netlify.toml`
at the repo root carries the whole configuration, so a Netlify "Import from
Git" picks the build settings up automatically — do not re-enter them in the
dashboard, or the two definitions will drift.

| Setting | Value | Why |
| --- | --- | --- |
| Base directory | `gloobal-essentials-preview` | The app's `prebuild` runs `node ../build_app.mjs ..`, which reads `backend/` and `frontend/` from the repo root, so the root must be in the deploy context. |
| Build command | `npm run build` | Regenerates `src/GloobalApp.jsx`, then `vite build`. |
| Publish directory | `dist` (relative to base) | |
| Node | 20 | |

`src/GloobalApp.jsx` is generated and git-ignored — a clean clone has no copy
of it, and `prebuild` recreates it. Verified: a fresh clone plus `npm ci` plus
`npm run build` produces the same asset hashes as a local build.

### Headers

`netlify.toml` sets the security headers and a CSP whose allowlist is derived
from the origins the bundle actually requests — `flagcdn.com` (flags),
`logo.clearbit.com` (bank logos), `raw.githubusercontent.com` (the GlobeHero
earth texture), Google Fonts, and `gloobal-pay.onrender.com` (the API).
Adding an origin to the app means adding it here too, or the browser blocks
it silently in production while dev keeps working.

`'unsafe-inline'` in `style-src` is load-bearing: the screens style
themselves with inline `style={{…}}` and embedded `<style>` blocks.
`script-src` has no such escape.

### PWA

`vite-plugin-pwa` generates the manifest and an `autoUpdate` service worker
that precaches the app shell, so a reload or an offline launch still boots.
`sw.js` and `manifest.webmanifest` are served `max-age=0, must-revalidate` —
a cached service worker pins every installed client to an old bundle with no
in-app way out.
