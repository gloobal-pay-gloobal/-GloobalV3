# tools/

Developer tooling. Nothing here runs in production, and nothing here is
imported by the app, the server, or the build — deleting this folder would
not change what ships.

Runtime and maintenance code deliberately does **not** live here. In
particular `server/scripts/` (e.g. `backfill-country-iso.mjs`,
`seed-countries-currencies.mjs`, `coin-airdrop.mjs`) stays with the server
it maintains: those scripts import the server's own models and connect to
its database, so they are backend code that happens to be run by hand.

| Folder | What it is |
| --- | --- |
| `frontend/` | Diagnostics for the generated app bundle — see its README |
| `backend/` | Diagnostics that talk to the live API |
| `email/` | Report/handoff mailers (Python and Node) |

## Running them

All of these are run from the repository root:

```bash
node tools/frontend/scan-undeclared.mjs
node tools/frontend/probe-screens.mjs
node tools/frontend/probe-panels.mjs
node tools/frontend/probe-stages.mjs
node tools/backend/check-backend.mjs
```

They used to live in `gloobal-essentials-preview/tools/` and were run from
inside that project. They still read `gloobal-essentials-preview/src/GloobalApp.jsx`
and still resolve `react`, `react-dom`, `esbuild` and `rollup` from that
project's `node_modules` — they simply locate it explicitly now instead of
relying on being inside it. So `gloobal-essentials-preview` must have had
`npm install` run before any of the frontend probes will work.
