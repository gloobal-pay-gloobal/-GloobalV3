# Legacy Gloobal repositories on this machine

Written during the August 2026 consolidation into `D:\gloobalv3`. Records
what else exists locally so nothing is lost track of. None of these is
built or deployed; the only active checkout is `D:\gloobalv3`.

## `D:\Desktop\Gloobal` — `gloobal-pay-gloobal/Gloobal.git`

The previous generation of the project. Last commit `5ba7464`, on `main`.

Everything of value has been brought across:

- `.claude/` (settings, six skills including `prototype-integrator`, the
  pxpipe launcher) → `.claude/` here
- `CLAUDE.md` → `CLAUDE.md` here
- `report-mailer/` → `tools/email/report-mailer/` (without `.env`)
- `docs/`, `SETUP.md`, `PROGRESS.md`, `GLOOBAL_PROJECT_REPORT.md`
  → `archive/legacy/docs/`
- `Frontend/` source → `archive/legacy/gloobal-frontend-v1/`

Its `Backend/` was compared file by file against this repo's `server/`,
ignoring line endings. Only four files differed — `server.js`,
`lib/settlementEngine.js`, `package.json`, `.env.example` — and in every
case the legacy copy was the older one. It holds nothing `server/` lacks,
so nothing was taken from it.

**Still there and deliberately not copied:** its `.git`, its `node_modules`,
`Backend/.env`, `report-mailer/.env`, `Frontend/public/models` (13 MB of
face-api weights), and two untracked git bundles
(`gloobal-feature-multi-currency-pool-stage1.bundle`,
`gloobal-fix-search-error.bundle`).

## `D:\Gloobal project` — same `Gloobal.git`, older

An earlier checkout of the repository above, at commit `7750765`. Its
`.claude/` is byte-identical to Desktop's apart from `settings.local.json`.
Fully superseded; nothing taken.

## `D:\GloobalApp` — `gloobal-pay-gloobal/GloobalApp-.git`

A third repository, at commit `01cd668`, using the same `frontend/` +
`backend/` + `build_app.mjs` layout as this one — a predecessor of the
current structure rather than of the app above.

It has since diverged from this repo in both directions. Known unique to
it: `frontend/components/common/qrCameraScanner.jsx`. Known unique to this
repo: `frontend/components/common/appMap.jsx`. Nothing was merged, because
bringing `qrCameraScanner.jsx` across would add a feature, not reorganise
one.

## `C:\Users\<user>\gloobal-mailer`

Not a repository — a loose folder holding the Python mailer. `mailer.py`,
`config.py`, `fetch_mail.py`, `send.bat` and `secret.txt.example` are now in
`tools/email/`.

**Still there and deliberately not copied:** `secret.txt`, which contains a
live Gmail App Password, and the generated `report.md` / `report.html` /
`progress-report.txt` output.

## `D:\_stale-server-backup-20260820`

An unversioned copy of `server/` that occupied `D:\gloobalv3` before this
consolidation. Verified to contain nothing the repository lacks: four files
differed and all four were older versions of files changed in `e60a0ed`.
Moved aside rather than deleted, and safe to remove once this layout has
been exercised for a while.
