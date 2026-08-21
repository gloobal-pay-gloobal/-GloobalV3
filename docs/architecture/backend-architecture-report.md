# Gloobal — Backend Architecture Report

**Date:** 15 August 2026
**Scope:** the Gloobal platform as built and deployed
**Companion diagram:** `docs/backend-architecture.svg`

---

## 0. What this report is, and what it is not

This describes the backend **as it exists and runs today**, not a proposal for
one. Every claim below was checked against source before being written:
`Backend/server.js`, `Backend/models/*.js`, `Backend/package.json`, the frontend
tree, and `netlify.toml`. Where something does not exist, this report says so
rather than describing what a system of this kind usually has.

Two things are worth stating up front because they shape everything else:

1. **The API server makes no outbound HTTP calls.** There are no third-party
   integrations consumed server side, no webhooks in either direction, and no
   external API keys in the backend. Every external origin the product touches
   is fetched by the browser and allowlisted in the Content-Security-Policy.

2. **There is no queue, no worker, no cache, and no object storage.** All work
   completes inside the request that asked for it. This is a deliberate
   simplification appropriate to the current stage, and section 8 covers what it
   costs.

---

## 1. Topology

Three independently deployed pieces, all from **one** git repository:
`gloobal-pay-gloobal/GloobalV3`, branch `main`.

| Piece | Runs on | Source in repo | Deploys |
|---|---|---|---|
| Frontend (React PWA) | Netlify — `gloobalv3.netlify.app` | `gloobal-essentials-preview/` (+ `frontend/`, `backend/`) | Auto on push to `main` |
| API (Express 5) | Render — `gloobal-pay.onrender.com` | `server/` | On push to `main` — see the auto-deploy caveat in `docs/deployment/README.md` |
| Database | MongoDB Atlas — `gloobal_db` | — | Managed |

The frontend and the API used to live in separate repositories and were
bridged by hand. They no longer are: one push updates both.

**Order still matters**, because the two targets build independently from the
same commit. A frontend release that calls a route the API has not shipped yet
will fail in production, and Netlify is currently the faster of the two. The
Gloobal Coin rollout was sequenced backend-first for this reason.

---

## 2. Frontend (existing — unchanged by this architecture)

The client is fixed. This architecture connects to it as it stands.

- **React 18 + Vite**, built as a single bundle. All modules share one global
  scope; `build_app.mjs` concatenates `backend/` and `frontend/` sources in a
  fixed dependency order into `GloobalApp.jsx`. There are no ES imports between
  internal modules — a name referenced before its module is emitted is a
  guaranteed `ReferenceError`, which is why `tools/scan-undeclared.mjs` exists.
- **An in-browser double-entry ledger.** `FinancialCore` composes `LedgerEngine`,
  `AccountRegistry`, `Money`, `CoinService`, `PayLaterService`,
  `EssentialsService`, `RiskEngine`, `SettlementEngine`, `TransactionOrchestrator`,
  `ProvenanceService` and `DisputeService`. This is not a display cache: it is a
  real ledger whose entries must balance, and it mirrors what the server
  confirms.
- **API client** — `backend/services/api/`:
  - `httpClient` — 45-second timeout, sized for Render cold starts
  - `rateLimiter` — client-side guard so the app does not spend its own budget
  - `sessionStore` — bearer token in `localStorage`, attached to every
    authenticated call
- **PWA service worker** — Workbox, `registerType: autoUpdate`. It precaches the
  app shell, so **the first visit after a deploy renders the previous bundle**
  and corrects itself on the next visit. This is an operational characteristic,
  not a defect, but it has caused at least one false "the deploy did not land"
  conclusion and is worth knowing.

**Required frontend change: none.** The client already speaks to every route
described here. One conditional case is flagged in section 7.

---

## 3. API / entry layer

Order of middleware, which is also the order a hostile request meets resistance:

1. **CORS allowlist.** Named origins only — the deployed frontends plus
   localhost. This was previously `cors()` with no argument, which answers every
   origin with `Access-Control-Allow-Origin: *`. Requests with no `Origin` at all
   (curl, health checks, server-to-server) are allowed through, because CORS is a
   browser mechanism and refusing them would break non-browser callers without
   stopping anything.
2. **Body cap** — `express.json({ limit: '64kb' })`. Nothing the API accepts is
   near that; the largest legitimate payload is a face descriptor.
3. **Rate limiting** — five independent buckets over a 5-minute window:

   | Bucket | Max | Covers |
   |---|---|---|
   | `otp` | 12 | sending and verifying codes |
   | `credential` | 30 | login, PIN verify/set, passkey assertions |
   | `register` | 8 | account creation |
   | `lookup` | 90 | account lookups |
   | `write` | 150 | ordinary signed-in activity |

   Separate buckets mean registering does not spend the budget needed to log in.
   The `lookup` key is derived from the **caller only, never the ID being looked
   up** — including it would hand an enumerator a fresh bucket per guess, which is
   the one thing that limit exists to prevent. `X-Forwarded-For` is read only at
   the first hop (the one Render sets) and is used purely for bucketing.

   **Caveat:** buckets live in an in-process `Map`, swept by a 60-second
   `setInterval(...).unref()`. This is correct for one instance and silently
   wrong for two. See section 8.

---

## 4. Authentication and authorization

### 4.1 Session token

Not a JWT library — a deliberately small custom token:

```
base64url(JSON.stringify({ sub, symbolId, iat, exp })) + "." + HMAC-SHA256(payload, AUTH_TOKEN_SECRET)
```

- `sub` is the Mongo `_id`, not the Gloobal ID.
- Signature comparison uses `crypto.timingSafeEqual`, **length-checked first**
  because `timingSafeEqual` throws on a length mismatch — which would itself be a
  timing signal.
- Expiry is checked before the account is loaded.
- `AUTH_TOKEN_SECRET` must be set in the environment. If it is absent or changed,
  every existing token becomes invalid.

### 4.2 Two middlewares, two different questions

- **`requireAuth`** — *who is calling?* Resolves the token to a `User` document
  and attaches `req.authUser`. Failure → `401`.
- **`requireSelf(...sources)`** — *is this their own data?* Reads the Gloobal ID
  from path, then body, then query, and compares **by document `_id`, never by
  `symbolId` string**. That distinction matters: an account can rename itself via
  `/api/profile/change-symbol-id`, and comparing strings would lock someone out
  of their own data mid-session. Failure → `403`.

Nearly every account route carries both.

### 4.3 Credential stores

| Credential | Implementation | Notes |
|---|---|---|
| PIN | bcrypt hash, 4–6 digits | **Five failed attempts → 10-minute lockout** on the `Pin` record. This, not the IP rate limit, is the real defence against PIN guessing — no amount of IP rotation gets around it. |
| Passkey | `@simplewebauthn/server` | Genuine WebAuthn assertion. This is the Face ID / fingerprint prompt in the app; it was previously a 700 ms `setTimeout` that always succeeded. |
| Face | `lib/faceCrypto.js`, `lib/faceMatch.js` | Encrypted descriptor stored server side. The image itself is never stored. |
| OTP | `Otp` collection, Mongo TTL index | **No SMS gateway exists.** The code is a fixed prototype value. See section 8. |

---

## 5. Route families

41 routes, all defined in `Backend/server.js`.

| Family | Routes |
|---|---|
| **Identity** | `/api/otp/send`, `/api/otp/verify`, `/api/register-symbol`, `/api/users/available`, `/api/users/resolve` |
| **Credentials** | `/api/login`, `/api/pin/set\|verify\|reset`, `/api/passkey/register/*`, `/api/passkey/auth/*`, `/api/face/*` |
| **Profile & catalogue** | `/api/profile/:symbolId`, `/api/profile/change-symbol-id`, `/api/referrals/:symbolId`, `/api/creator/cashback-rate`, `/api/products/:product`, `/api/interest/*`, `/api/stats`, `/r/:symbolId` |
| **Money** | `/api/transactions/send`, `/api/transactions/history/:symbolId`, `/api/transactions/:symbolId`, `/api/assets/:symbolId`, `/api/assets/plant-seed`, `/api/assets/paylater/:symbolId` |
| **Gloobal Coin** | `/api/coin/mint`, `/api/coin/redeem`, `/api/coin/send`, `/api/coin/:symbolId`, `/api/coin/supply` |

### Two ordering hazards, both currently correct

Express matches routes in declaration order. Two literal paths **must** stay
declared above their parameterised siblings:

- `/api/profile/count` above `/api/profile/:symbolId`
- `/api/coin/supply` above `/api/coin/:symbolId`

Behind the parameterised route, each would 404 with `symbolId === 'count'` /
`'supply'`. There is a regression test for the coin case.

### Deliberately public

`/api/users/available` answers with **one boolean and nothing else**. The
lookup route beside it returns a name, phone number and cashback rate, and
registration was once using *that* to check availability — which meant an
unauthenticated caller could turn a guessed Gloobal ID into somebody's contact
details. Being able to tell a taken ID from a free one is inherent to letting
people choose their own; the mitigation is that it is rate limited and leaks
nothing but that bit.

`/api/coin/supply` and `/api/stats` are also public. Both return aggregates only.

---

## 6. Business logic — where money is actually protected

### 6.1 `withMongoTransaction`

Probes **once** whether the deployment supports multi-document transactions and
remembers the answer, so a standalone mongod does not pay for a doomed
`startSession` on every payment. Atlas is a replica set on every tier, so
production always gets real transactions.

Returns `{ value, atomic }`. When `atomic` is false the caller is responsible for
compensating a partial failure by hand — and the compensation paths are guarded
by `if (!session)`, because inside a transaction the abort already undid the
write and compensating would double-refund.

### 6.2 Transfers

The protection is **the conditional update itself**, not a check in Node:

```js
User.findOneAndUpdate(
  { _id: sender._id, balance: { $gte: numericAmount } },
  { $inc: { balance: -numericAmount } },
)
```

No match means the balance moved between the courtesy check and the write, and
nothing was written — `$inc` either matched and applied or did neither.

The previous implementation read the balance, compared it in Node, and wrote the
whole document back. Ten concurrent sends of 800 against a balance of 1000 all
read 1000, all passed, and all committed: ten success rows recording 8,000 of
movement out of a 1,000 account. `tests/transfer-atomicity.test.mjs` reproduces
exactly that and fails against the old version, which is how it was confirmed to
detect the bug rather than merely pass alongside it.

Each transfer also splits the payee's creator cashback, plants an asset seed for
the payer, and writes a `Transaction` plus two `LedgerEntry` lines **inside the
same transaction**, so the row and the balances commit together or not at all.

`referenceId` is 20 Gloobal symbols, unique-indexed. A well-formed, unused
client-supplied reference is honoured; otherwise the server mints its own. That
is what makes the sender's receipt and the receiver's history row name one
transaction.

### 6.3 Gloobal Coin

The newest subsystem, and fully backed by construction.

- **Mint** — fiat leaves `User.balance`, `CoinReserve.reserve` and
  `CoinReserve.issued` both rise, `User.coinBalance` rises. One `$inc` covers
  both user fields, because fiat leaving and coin arriving are the same event.
- **Redeem** — the exact inverse. The reserve decrement is **guarded**
  (`reserve: { $gte: amount }, issued: { $gte: amount }`): if the reserve cannot
  cover it, the account holds coin the reserve never backed, and the right answer
  is to fail loudly rather than pay out fiat that was never deposited.
- **Send** — coin only. **The reserve is not read or written**, because a
  transfer changes who holds coin, not how much exists.

**The invariant**, checked rather than claimed:

```
CoinReserve.reserve == CoinReserve.issued == sum(User.coinBalance)
```

All three are stored even though any could be derived from the others, and that
redundancy is the point: they are maintained by three separate writes and are
equal only because every operation kept them equal. `GET /api/coin/supply`
reports the comparison; the app renders a red banner when they disagree.

**PIN policy** — mint and redeem take no PIN (value moves between two things one
person owns, and is undone by doing the opposite). `/api/coin/send` requires one,
checked **before the balance is read**, so a wrong PIN learns nothing about what
the account holds.

`Transaction.type` gained `coin_mint`, `coin_redeem`, `coin_send` rather than
reusing `send` — a mint has one party, and recording it as a send would put a
self-transfer in the history of an API that rejects self-transfers everywhere
else. Coin legs are written in `GC` and fiat legs in `INR`, so a reader summing
`send` amounts as fiat cannot pick coin up by accident.

---

## 7. Data

**MongoDB Atlas**, replica set, database `gloobal_db`. 14 models; 12 written by
the API.

| Collection | Purpose |
|---|---|
| `User` | identity, `balance`, `coinBalance`, `passkeys`, `referralChain`, `symbolIdHistory` |
| `Transaction` | 9 types including the 3 coin types; unique `referenceId` |
| `LedgerEntry` | debit/credit lines with `balanceBefore` → `balanceAfter` |
| `CoinReserve` | singleton: `reserve`, `issued`, `reserveCurrency` |
| `Pin` | bcrypt hash, `failedAttempts`, `lockedUntil` |
| `Otp` | TTL index on `expiresAt` (`expireAfterSeconds: 0`) |
| `FaceTemplate` | encrypted descriptor |
| `Referral`, `AssetSeed`, `Interest`, `Product`, `ProductService` | supporting |
| `AuditLog` | **declared, never written** |
| `Notification` | **declared, never written** |

### Seeding and migration

`seedProductCatalogue` runs at boot using `$setOnInsert` — insert-if-absent, so
it can never overwrite an edit made in Atlas. A seed that resets your data on
every restart is a footgun.

That property means the seed **cannot correct a row it already wrote**. The
Gloobal Coin rollout therefore added a narrow migration that matches on the exact
stale note as well as the label, leaving hand-edited rows alone. One part is not
fully safe and is documented as such: flipping `Product { key: 'coin' }` from
`live: false` to `true` cannot distinguish a stale seed from a deliberate
takedown. It was applied because a working coin that the catalogue calls dead is
the worse failure, and reversing it is one Atlas edit.

---

## 8. What is **not** in this architecture

Listed explicitly so nobody assumes otherwise. Each was verified against
`package.json` dependencies and route definitions.

| Absent | Consequence |
|---|---|
| **Cache (Redis)** | Every read goes to Atlas. Rate buckets are process memory. |
| **Queue / background worker** | No BullMQ, Agenda or cron. All work is synchronous in-request. |
| **Object / file storage** | No S3, Cloudinary or multer. Profile photos live in the browser's `localStorage`. |
| **Notifications** | No SMS gateway, push, or email from the API. `report-mailer` is a separate local tool, not part of the deployed service. |
| **Realtime transport** | No WebSocket, SSE, or polling. The client learns of changes only by asking. |
| **Outbound integrations** | The server calls nothing external. |
| **APM / error tracking** | No Sentry, structured logger, metrics or alerting. |

### The entire asynchronous surface

Two mechanisms, and neither is an application job runner:

1. **Mongo TTL index** on `Otp.expiresAt` — expiry runs inside the database.
2. **Rate-bucket sweep** — `setInterval(..., 60_000).unref()`, in-process, not
   durable.

---

## 9. Operations

Application logging is `console.error(...)` in each route's catch block,
collected by Render's platform log stream. Nothing else.

One genuinely self-checking surface exists: `/api/coin/supply` compares three
independently maintained figures and reports the comparison rather than a
conclusion. If they ever disagree, the product says so.

---

## 10. What is actually proven

**Backend — three suites, all passing.** Each runs the real `server.js` against a
throwaway database on the same Atlas cluster, so transaction behaviour matches
production exactly. The run refuses to start if it finds itself connected to
anything else, and drops the database when it ends.

- `coin-supply-invariant.test.mjs` — 47 checks: concurrent mints against one
  balance, concurrent sends of the same coin, and the three-way invariant
  re-asserted after every operation including refused ones.
- `transfer-atomicity.test.mjs` — the ten-concurrent-sends race, plus ledger
  lines matching what the database actually did.
- `auth-and-access.test.mjs` — token forgery and expiry, cross-account reads,
  CORS, rate limiting.

**Frontend — 202 domain tests**, exercising the client ledger independently:
books balance *per currency*, coin cannot be added to fiat, reconciliation
ignores malformed server figures rather than treating them as zero.

**Render-time probes** — `scan-undeclared` (0 undeclared), `probe-panels` (3/3),
`probe-stages` (10/10), `probe-screens` (194 countries).

**Not covered by any test:** passkey and face flows, OTP delivery, the seed
migrations, and every screen's event handlers. `renderToString` never runs
`useEffect`, so interaction-driven failures still need a real browser.

---

## 11. Risks, in the order I would address them

1. **The OTP is a fixed code and there is no SMS gateway.** Anyone can complete
   registration against any phone number they name. This is acceptable for a
   prototype and unacceptable the day real users arrive. It is the single
   biggest gap between this system and a launchable one.
2. **Rate limiting is in-process.** Render must stay at one instance. Scaling
   horizontally would silently multiply every limit by the instance count. Moving
   the buckets to a shared store is a prerequisite for scaling, not a follow-up.
3. **No alerting.** A production 500 is visible only by reading Render's logs by
   hand. There is no signal that anything is wrong.
4. **Free-tier cold starts** of 20–50 seconds. The client already allows 45 s,
   but a first-time visitor meets a long wait.
5. **`AuditLog` and `Notification` are dead schemas.** Either wire them up or
   delete them; a declared-but-empty audit log is worse than none, because it
   implies coverage that does not exist.
6. **Profile photos are browser-local.** They do not follow an account across
   devices. **This is the one item that would require a frontend change** —
   adding object storage means adding an upload path to the client.
7. **Coin's reserve is single-currency.** Coin cannot be minted against or
   redeemed into another currency, which is why "Borderless" remains marked
   *planned* on the Coin screen while the other three are live.
8. **Netlify's MCP deploy tool reports unreliably.** It has returned
   `500 Internal Server Error` on a deploy that succeeded, and 502s from the
   proxy. Verify a deploy by comparing the live asset hash against the local
   build, never by trusting the exit status.

---

## 12. Open questions

- Which SMS provider, and does the prototype OTP path get removed or kept behind
  an environment flag?
- Is horizontal scaling on the roadmap? The answer decides whether shared-store
  rate limiting is urgent or merely eventual.
- Should coin become spendable at merchants? Today `gcoin.payments` is
  deliberately `false` and Scan & Pay settles in fiat, because there is no coin
  payment rail. This is stated in the product rather than hidden.
- Does the reserve need to become multi-currency, and against which currencies?
- Should `AuditLog` be implemented, given money already moves through
  `LedgerEntry`? They may be redundant.

---

*Generated from the codebase on 15 August 2026. Components marked absent were
checked against `package.json` dependencies and route definitions, not assumed.
The companion diagram `backend-architecture.svg` describes the same architecture.*
