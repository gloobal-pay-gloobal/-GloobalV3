# Deployment

Two deployments, from the same `main` branch of
`gloobal-pay-gloobal/GloobalV3`. Both depend on the repository layout;
the paths below are load-bearing and must not move.

## Frontend — Netlify

Site `gloobalv3.netlify.app` (id `da547e17-9077-46d0-89d6-fcfb848c60ad`),
configured by `netlify.toml` at the repo root.

| | |
|---|---|
| Base directory | `gloobal-essentials-preview` |
| Build command | `npm run build` |
| Publish directory | `dist` (relative to base) |
| Node version | 20 |

The base is set rather than the app being moved to the root, because the
Vite project's `prebuild` hook runs `node ../build_app.mjs ..` — it reaches
*up and out* to concatenate `backend/` and `frontend/` into
`src/GloobalApp.jsx`. So the whole repository has to be in the deploy
context, and `build_app.mjs` has to stay at the root. Moving either breaks
the build.

`netlify.toml` also carries the SPA rewrite, cache headers, and a CSP whose
`connect-src` names `https://gloobal-pay.onrender.com`. If the API origin
ever changes, that CSP must change with it or every API call is blocked in
a way that looks exactly like the backend being down.

## API — Render

Service **Gloobal Pay** (`srv-d8kft3jbc2fs73cho5e0`), free plan, Singapore.

| | |
|---|---|
| Repository | `https://github.com/gloobal-pay-gloobal/GloobalV3` |
| Branch | `main` |
| Root directory | `server` |
| Build command | `npm install` |
| Start command | `node server.js` |
| URL | https://gloobal-pay.onrender.com |

`server/server.js` must stay at exactly that path. Root directory `server`
plus start command `node server.js` is what the service is configured for;
`server/package.json` also has a `start` script as a fallback.

### Required environment

`AUTH_TOKEN_SECRET` must be set on the service, to a stable random value of
at least 32 characters. The server **refuses to boot without it** when
`NODE_ENV=production` or `RENDER=true`.

This is deliberate. Signing bearer tokens with a key generated at boot
means every restart invalidates every token ever issued — and on Render's
free tier the service sleeps whenever it is idle, so "every restart" is
several times a day. Signed-in people were being shown "Sign in to
continue" on sessions that were never invalid.

Keep the value stable for the life of the deployment. Changing it signs
everyone out once, exactly as a restart used to. It lives only in the
Render dashboard under Environment — never in the repository.

### Auto-deploy is broken — Render needs a manual deploy

The service is configured correctly (`autoDeploy: yes`, trigger `commit`,
repo `GloobalV3`, branch `main`). GitHub is simply not delivering the
webhook, so Render never learns that `main` moved.

The deploy history proves it. A webhook-driven deploy is recorded with
trigger `new_commit`:

| Date | Trigger | Repo the service pointed at |
|---|---|---|
| 2026-08-13 → 2026-08-18 | `new_commit` × 11 | `gloobal-pay-gloobal/Gloobal` (old) |
| 2026-08-19 17:15 | `service_updated` | repointed to `GloobalV3` |
| 2026-08-19 → 2026-08-21 | `manual`, `api`, `service_updated` only | `GloobalV3` |

Not one `new_commit` deploy has fired since the service was repointed.
This is not Render's monorepo path filter (`rootDir: server`) being
selective: commit `7d7a948` **created the entire `server/` tree** and
`a07de64` modified it, and neither produced a `new_commit` deploy.

The cause is the repository rename (`-GloobalV3` → `GloobalV3`) leaving a
stale webhook — pushes showed a `remote: This repository moved` redirect.

**Fix it in the dashboards** (there is no API for this):

1. GitHub → `gloobal-pay-gloobal/GloobalV3` → Settings → Webhooks.
   Delete any hook whose payload URL contains `api.render.com` and still
   names the old repo, or that shows red/failed recent deliveries.
2. Render → **Gloobal Pay** → Settings → Build & Deploy → Repository →
   **Disconnect**, then reconnect to
   `https://github.com/gloobal-pay-gloobal/GloobalV3`, branch `main`,
   root directory `server`. Reconnecting re-creates the webhook.
3. Confirm: push a commit that touches `server/` and check that a deploy
   appears with trigger `new_commit`, not `manual`.

Until that is done, **a change under `server/` needs a manual deploy**
(Render dashboard → Manual Deploy → Deploy latest commit). Netlify is
unaffected and deploys automatically.

Note that Render only rebuilds when files under `rootDir` (`server/`)
change, so a commit touching only docs or frontend leaving Render on an
older commit is correct behaviour, not the bug above.

## Legacy — not part of this deployment

| Thing | State |
|---|---|
| Render service **Gloobal** (`srv-d8g26m19rddc73b11150`) | Still running at `https://gloobal.onrender.com`, deploying from the old `gloobal-pay-gloobal/Gloobal` repo. **Nothing points at it.** Left up deliberately until the single-repo setup is proven; delete it then. |
| GitHub `gloobal-pay-gloobal/Gloobal` | Legacy source of the above. Not the deployment source for anything live. |
| `gloobal.netlify.app`, `gloobalapp.netlify.app`, `gloobal-v2.netlify.app` | Deleted. Any reference to them in active code is a bug. |

## Verifying a deploy

```bash
# API up and enforcing auth (401 is the correct answer with no token)
curl -o /dev/null -w '%{http_code}\n' \
  "https://gloobal-pay.onrender.com/api/users/resolve?identifier=ZZZZZZZZZZZZ"

# Full client-contract check
node tools/backend/check-backend.mjs
```

Startup logs should show `Server running on port 5000` followed by
`Connected to MongoDB Atlas`, with no `FATAL` line and no
`AUTH_TOKEN_SECRET is not set` warning.
