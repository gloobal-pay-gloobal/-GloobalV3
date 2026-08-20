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

### Auto-deploy is currently unreliable

The service has `autoDeploy: yes` on `commit`, but a push to `main` on
2026-08-20 did not trigger a deploy and had to be started by hand. The
GitHub repository was renamed at some point (`-GloobalV3` → `GloobalV3`)
and the webhook appears to have been left pointing at the old name; the
push showed a `remote: This repository moved` redirect.

Until that is fixed in the Render dashboard (Settings → Build & Deploy →
reconnect the repository), assume a push may need a manual deploy. The
local remote has been repointed to the canonical URL.

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
