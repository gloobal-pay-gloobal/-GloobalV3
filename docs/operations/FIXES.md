# Gloobal — bug-fix pass (Claude Opus 4.8)

All fixes were applied to the single source of truth `GloobalApp.jsx` and
propagated to the preview project. Verified: production build succeeds,
166/166 domain tests pass, lint clean (0 errors).

## Bugs fixed

1. Escape sequences rendered as literal text (JSX text nodes don't
   interpret `\uXXXX` / `\xXX`). Replaced with real characters:
   - Dashboard "Paid" amount: `\u2212` -> `−` (real minus)
   - My Essentials footnote: `\u2014` -> `—`
   - Dispute cases empty state: `\u2014` -> `—`
   - Dispute case row: `\xB7` -> `·`

2. PayPinModal cancel race: cancelling the OTP within the ~280ms
   success window still fired onVerified() (payment advanced). Now the
   pending timer is cleared when the modal closes.

3. GH Score back-button history desync: the on-screen back button
   bypassed `requestCloseGhScore`, leaving a phantom browser-history
   entry (dead back-press on mobile). Close path now routed through
   `requestCloseGhScore`; internal navigation unchanged.

## How to run

Preview:            cd gloobal-essentials-preview && npm install && npm run dev
Production build:   cd gloobal-essentials-preview && npm run build   (outputs dist/)
Tests (no install): cd financial-principles-tests && node --test "tests/**/*.test.mjs"

The rebuilt dist/ is included, ready to serve as a static SPA.
