# archive/

Material from earlier Gloobal codebases, kept for reference. **Nothing here
is built, tested, imported, or deployed.** No script in this repository
reads from this folder.

## `legacy/gloobal-frontend-v1/`

The previous Gloobal frontend, from `gloobal-pay-gloobal/Gloobal.git`
(originally `D:\Desktop\Gloobal\Frontend`). A conventional ES-module
Vite + React + Tailwind app with face-ID enrolment, PWA/service-worker
support and ~40 Playwright e2e specs.

It is **not** an ancestor of the current `frontend/`. The active frontend
uses the concatenation build system (`build_app.mjs`), where every module
shares one global scope; this one uses ordinary imports. They are two
different applications, not two versions of one, which is why this is
archived rather than merged.

Kept mainly for the e2e specs and the face-ID integration, neither of which
has an equivalent in the current app.

**Not archived:** `public/models/` — 13 MB of face-api.js model weights.
Binary, re-downloadable, and not worth carrying in git history. Still on
disk at `D:\Desktop\Gloobal\Frontend\public\models` if ever needed.
`node_modules/`, `dist/`, `test-results/` and `verify-shots/` were likewise
left behind.

## `legacy/docs/`

Documentation from that same repo: backend architecture, database schema,
UPI app structure, plus its project report, progress log and setup guide.
Superseded by `docs/` for anything about the current system, but they
describe design decisions that still hold.
