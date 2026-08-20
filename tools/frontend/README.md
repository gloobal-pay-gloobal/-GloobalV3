# Frontend diagnostics

Scripts for catching crashes without clicking through the app. Run them
from the repository root:

```bash
node tools/frontend/scan-undeclared.mjs   # undefined identifiers
node tools/frontend/probe-screens.mjs     # screens, every country + edge cases
node tools/frontend/probe-panels.mjs      # panel rendering
node tools/frontend/probe-stages.mjs      # every registration/login stage
```

They read `gloobal-essentials-preview/src/GloobalApp.jsx`, so run
`node build_app.mjs` first (or `npm run build` inside the preview project,
which does it) after editing `backend/` or `frontend/`. None of them modify
project source.

These used to live in `gloobal-essentials-preview/tools/` and be run from
inside that project. They still depend on it entirely — they `chdir` into
it, read its generated bundle, and resolve `react`, `react-dom`, `esbuild`
and `rollup` from its `node_modules`. They just locate it explicitly now
rather than relying on being inside it, so
`cd gloobal-essentials-preview && npm install` is still a prerequisite.

## Expected non-failures

Two results look like problems and are not:

- `scan-undeclared.mjs` always reports **`Notification`**. It is a browser
  global used behind a `typeof Notification === "undefined"` guard in
  `frontend/components/dialogs/registerLogin.jsx`. The scanner only knows a
  fixed list of globals, so this is a false positive.
- `probe-screens.mjs` exits non-zero on its last two checks
  (`useFinancialCore must be used within a <LedgerProvider>`, and
  `Missing getServerSnapshot`). Both are artefacts of server-rendering a
  tree built for the browser; the header of that script says to expect
  them. Everything above those two lines passing is the real signal.

`probe-stages.mjs` currently exits 2 with *"could not find the stage
useState initialiser"*. That one **is** stale: its regex expects
`useState("phone")`, but `frontend/App.jsx` now initialises the stage
lazily behind a permissions gate. The probe needs updating; the app is
fine.

## `scan-undeclared.mjs`

Parses the built bundle and reports identifiers referenced but never
declared anywhere. Because every module in this project shares one
global scope, such a reference is a guaranteed `ReferenceError` the
moment that line runs. Clean output means no missing module and no
typo'd name.

## `probe-screens.mjs`

Server-renders `GloobalCoverageScreen` and `AddBankScreen` against all
194 countries (registered and not), every stored country selection, and
a set of missing/empty prop edge cases.

The final "whole app" section reports two failures that are **expected
and not bugs** — `renderToString` has no `LedgerProvider` context and no
`getServerSnapshot`. Use `probe-stages.mjs` for whole-app coverage.

## `probe-stages.mjs`

Renders the entire app at each of the 10 `stage` values (phone, otp,
secureId, referral, profile, pin, biometric, dashboard, loginAuth,
loginBiometric) by patching the initial state in a throwaway copy of
the bundle. The copy is deleted after each run; source is untouched.

## What these do not cover

Effects and event handlers. `renderToString` never runs `useEffect`, so
browser-only code and interaction-driven crashes still need a real
browser. These catch render-time failures, which is the majority.
