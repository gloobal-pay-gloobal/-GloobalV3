# Backend diagnostics

Developer checks that talk to the deployed API. Read-only: nothing here
writes to the database or changes server state.

```bash
node tools/backend/check-backend.mjs
```

## `check-backend.mjs`

Bundles the real client (`backend/services/api/*.js`) and calls the live
backend with it, so it verifies the contract the app actually depends on
rather than a hand-written copy of it. It checks that the API is reachable,
that `GET /api/users/resolve` is refused without a bearer token (that route
returns names, phone numbers and cashback rates, so it must stay signed-in
only), that ID-availability and referral lookups answer correctly, and that
an error comes back as a typed `GloobalApiError` rather than a crash.

Target defaults to `https://gloobal-pay.onrender.com`. Render's free tier
sleeps when idle, so the first call can take 20-50 seconds.

Not to be confused with `server/scripts/`, which is backend maintenance code
that connects to MongoDB and is part of the server, not of this folder.
