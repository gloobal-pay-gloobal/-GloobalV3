# Diagnostics

Three scripts for catching crashes without clicking through the app. Run
them from the preview project root:

```bash
cd gloobal-essentials-preview
node tools/scan-undeclared.mjs   # undefined identifiers
node tools/probe-screens.mjs     # screens, every country + edge cases
node tools/probe-stages.mjs      # every registration/login stage
```

They read `src/GloobalApp.jsx`, so run `node ../build_app.mjs ..` first
(or `npm run build`, which does it) after editing `backend/` or
`frontend/`. None of them modify project source.

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
