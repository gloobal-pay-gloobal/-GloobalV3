# CLAUDE.md

Guidance for Claude Code working in this repository.

## Paths

| | |
|---|---|
| Repo root | `D:\gloobalv3` |
| Remote | `https://github.com/gloobal-pay-gloobal/GloobalV3.git` |
| Live frontend | https://gloobalv3.netlify.app |
| Live API | https://gloobal-pay.onrender.com |

This is the single active workspace. Other Gloobal folders on this machine
(`D:\Desktop\Gloobal`, `D:\Gloobal project`, `D:\GloobalApp`) are older
repositories kept for reference only — see
`docs/handoffs/legacy-repositories.md`. Do not edit them, and do not copy
from them without checking whether this repo is already ahead.

## Workflow rules

- Check `git status` before editing.
- Work on a branch; do not commit to `main` unless explicitly told to.
- Run `node build_app.mjs` after any change under `backend/` or `frontend/`.
- Run `git status`, `git diff --stat` and `git diff --check` before committing.
- Never push without explicit approval.
- Never commit a `.env`, `secret.txt`, or any credential.
- Never run `npm audit fix` unless asked.

## Layout

```
frontend/                    React source (concatenation build)
backend/                     Local domain simulation, also concatenated
server/                      Real Express + MongoDB API, deployed to Render
gloobal-essentials-preview/  Vite wrapper; consumes the generated bundle
financial-principles-tests/  Domain/financial test suite
build_app.mjs                Concatenates backend/ + frontend/ into the bundle
tools/                       Developer tooling (not shipped)
docs/                        Architecture, deployment, operations, handoffs
archive/                     Reference copies of superseded code
```

### `backend/` and `server/` are different systems

This trips people up constantly, so: **do not merge or rename them.**

- **`backend/`** is a browser-side domain simulation — ledger, accounts,
  settlement, risk, receipts — that runs *inside the app*. It is
  concatenated into the frontend bundle by `build_app.mjs`. It has no
  database and no network listener.
- **`server/`** is the real production API: Express 5 + Mongoose against
  MongoDB Atlas, deployed to Render. `server/server.js` must stay at that
  path — the deployment depends on it.

## The concatenation build system

`frontend/` and `backend/` are **not** ES modules in the normal sense.
`build_app.mjs` concatenates them, in the order listed in its
`FRONTEND_MODULES` / `BACKEND_MODULES` arrays, into a single file:

```
gloobal-essentials-preview/src/GloobalApp.jsx
```

That file is **generated. Never edit it directly** — it is gitignored and
overwritten on every build. Edit the sources under `frontend/` or
`backend/` and re-run the build.

Because the result shares one global scope:

- Top-level `var` names must be globally unique across the whole tree.
- React hook and lucide-icon imports use numbered aliases (`useState19`,
  `ChevronLeft2`). Before adding one, grep the frontend tree for the
  highest existing number and go one past it.
- A new source file must be added to `FRONTEND_MODULES` in `build_app.mjs`
  or it will silently not be included.
- Module order is semantically significant. Definitions must precede use
  for anything evaluated at load time (function declarations hoist; `var`
  initialisers do not).

Do not convert this to standard ES modules.

## Commands

```bash
# Rebuild the bundle (run from the repo root)
node build_app.mjs

# Production build
cd gloobal-essentials-preview && npm run build

# Diagnostics — all from the repo root
node tools/frontend/scan-undeclared.mjs    # undeclared identifiers
node tools/frontend/probe-screens.mjs      # screens x 194 countries
node tools/frontend/probe-panels.mjs       # panel rendering
node tools/frontend/probe-stages.mjs       # registration/login stages
node tools/backend/check-backend.mjs       # live API contract

# Domain tests
cd financial-principles-tests
node scripts/build-test-bundle.mjs && node --test tests/*.test.mjs

# Server
cd server && npm install && node --check server.js
```

### Known non-failures

- `scan-undeclared.mjs` reports `Notification` — a browser global, used
  behind a `typeof` guard in `frontend/components/dialogs/registerLogin.jsx`.
- `probe-screens.mjs` ends with two SSR-only failures
  (`useFinancialCore` outside a provider, missing `getServerSnapshot`).
  Both are expected; see `tools/frontend/README.md`.
- `probe-stages.mjs` exits 2 with "could not find the stage useState
  initialiser". Its regex predates the permissions gate added to
  `frontend/App.jsx`. Pre-existing; the probe needs updating, not the app.

## Environment

`server/.env` (never committed — see `server/.env.example`):

| | |
|---|---|
| `MONGO_URI` | MongoDB Atlas connection string |
| `AUTH_TOKEN_SECRET` | **Required in production.** Stable HMAC signing key, ≥32 chars. The server refuses to start without it when `NODE_ENV=production` or `RENDER=true`, because a boot-generated key invalidates every session on every restart. |
| `PORT` | default 5000 |
| `PROTOTYPE_OTP` | fixed OTP for testing, default `123456` |
| `PROTOTYPE_TRANSACTION_MAX_AMOUNT` | default 5000 |
| `ALLOWED_ORIGINS` | comma-separated CORS allowlist |

Frontend reads `VITE_API_URL`, defaulting to `https://gloobal-pay.onrender.com`.

## Auth

Bearer tokens, not JWTs: an HMAC-SHA256 signature over a base64url payload,
minted only in exchange for a real credential (PIN at `/api/login`, a
verified OTP at registration, or a WebAuthn assertion). Seven-day TTL.
Every route touching an account requires one and checks that the token
names *that* account.

On the client, `backend/services/api/httpClient.js` distinguishes a 401
(token dead → clear it and fire `gloobal:sessionExpired`, which `App.jsx`
turns into a redirect to Login) from `status === 0` (timeout, offline, or
Render cold start → keep the session, it says nothing about validity).
Preserve that distinction; conflating them signs people out for a slow
server.

## Deployment

See `docs/deployment/README.md`. In short: Netlify builds from
`gloobal-essentials-preview/`, Render runs `node server.js` with root
directory `server`. Neither path may move.
