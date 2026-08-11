# Gloobal — Project Restructure Report

**Date:** 10 August 2026
**Project root:** `D:\gloobal-new version`
**Status:** Restructure complete and verified. Build green, 166/166 tests passing.

---

## 1. Executive Summary

The Gloobal application previously lived as a single 781 KB, 15,339-line
JSX file (`GloobalApp.jsx`). That file was itself the inlined output of a
modular codebase — every logical module was still labelled with a
`// src/...` origin comment.

It has been split back into **115 individual source files** organised into a
`backend/` domain layer and a `frontend/` React layer.

This was a **code-splitting operation, not a rewrite**. No application logic
was changed. Parity was verified mechanically, not by inspection:

> The rebuilt application file and the original monolith contain
> **14,010 code lines each — 0 missing, 0 extra.**

| Verification | Result |
| --- | --- |
| Rebuilt entry vs. original monolith | 14,010 code lines each — 0 missing, 0 extra |
| Vite production build | Passes — 649.52 kB (185.33 kB gzipped) |
| Vite dev server | Serves and transforms the entry cleanly (HTTP 200) |
| Domain test suite | **166 / 166 passing** |
| Regenerated test bundle vs. previous passing bundle | 2,783 code lines — 0 diffs |

---

## 2. Current Project Structure

```
gloobal-new version/
├── README.md                    Project overview, build model, setup
├── PROJECT_REPORT.md            This report
├── FIXES.md                     Historical bug-fix record
├── implementation_plan.md       The restructure plan
├── memory.txt                   Working log + current status
├── build_app.mjs                Build script (sources → app entry)
├── .gitignore                   Marks generated artifacts as generated
│
├── backend/                     74 files, ~4,751 lines — pure JS, zero React
├── frontend/                    42 files, ~10,700 lines — React / JSX
├── gloobal-essentials-preview/  Vite + React preview app (+ tools/ diagnostics)
├── financial-principles-tests/  166 domain unit tests (Node.js)
├── docs/architecture.md         Architecture diagram (Mermaid)
└── _trash/                      Retired monolith + manifest; safe to delete
```

### 2.1 `backend/` — Domain Logic & Services

74 files, ~4,751 lines. Pure JavaScript, no React dependency anywhere.

```
backend/
├── domain/
│   ├── shared/            ids.js, ChainStore.js, Money.js, financialConstants.js
│   ├── ledger/            LedgerStore, LedgerEngine, ledgerErrors
│   │   └── entities/      LedgerRecord, JournalEntry, LedgerEntryLine
│   ├── accounts/          AccountRegistry
│   │   └── entities/      LedgerAccount, UserAccount, ReserveAccount
│   ├── liquidity/         LiquidityService + LiquidityPool
│   ├── essentials/        EssentialsService, EssentialsPoolService, EssentialsWallet
│   ├── creatorShare/      CreatorShareService + CreatorShareRecord
│   ├── paylater/          PayLaterService + PayLaterRecord
│   ├── risk/              RiskEngine, riskCodes
│   ├── settlement/        SettlementEngine + SettlementBatch, SettlementState
│   ├── receipts/          ReceiptService + Receipt
│   ├── provenance/        LocationResolver, ProvenanceStore, ProvenanceService,
│   │                      LocationObservation
│   ├── disputes/          DisputeService, DisputeStore, disputeCodes
│   ├── transactions/      TransactionOrchestrator, TransactionEventOutbox
│   ├── events/            DomainEvents, EventBus
│   ├── capabilities/      CapabilityState
│   ├── qr/                qrEncoder (standards-compliant, dependency-free)
│   ├── diagnostics/       Logger, HealthMonitor, DiagnosticsService
│   ├── replay/            LedgerReplay
│   ├── resilience/        IdempotencyGuard, OfflineQueue, FaultInjector, RetryPolicy
│   ├── simulation/        FinancialSimulator
│   └── FinancialCore.js   Top-level domain orchestrator
├── data/                  countries, currencies, essentialsBaseline, banks,
│                          coverage, ghScoreCategories, mockData
├── utils/                 idGenerators, currency, format, color, date,
│                          creatorShare, requestId, particles, gloobalQR,
│                          demoGenerators
├── core/transaction/      transactionSnapshot.js
└── services/
    ├── share/             clipboard.js, webShare.js
    └── storage/           coverageStorage.js
```

### 2.2 `frontend/` — React Layer

41 files, ~10,602 lines.

```
frontend/
├── adapters/
│   ├── ledger/            LedgerProvider.jsx, useLedgerProjections,
│   │                      useTransactionActions, useProvenanceAndDisputes
│   └── diagnostics/       useDiagnostics
├── components/
│   ├── buttons/           index.jsx
│   ├── cards/             flags.jsx, misc.jsx
│   ├── charts/            ghRing.jsx
│   ├── common/            backgrounds, brand, gloobalQRCode, coloredId,
│   │                      icons, flipIcons, misc, launchSplash
│   ├── dialogs/           registerLogin.jsx, ReceiptModal.jsx
│   ├── inputs/            dialPads.jsx, codeInputs.jsx
│   └── payments/          PayOptionsSheet.jsx, PayPinModal.jsx
├── screens/
│   ├── Dashboard/         Dashboard.jsx
│   ├── SendMoney/         SendMoney.jsx
│   ├── Coverage/          GloobalCoverageScreen.jsx
│   ├── Banks/             AddBankScreen.jsx
│   └── DevTools/          DiagnosticsScreen.jsx, DisputeCasesSection.jsx
├── features/
│   ├── assets/            AssetsScreen.jsx
│   ├── essentials/        EssentialsScreen.jsx
│   ├── history/           TransactionHistoryScreen, TransactionRow, historyUtils
│   └── paylater/          PayLaterScreen.jsx, PayLaterLedger.jsx
├── hooks/                 useBackClose.js, useAmbientFlags.js
├── constants/             theme.js
├── App.jsx                Main app component (GloobalId)
└── __artifactEntry.jsx    Root wrapper with launch splash
```

---

## 3. How the Build Works — and Why

**This is the most important thing to know before editing the project.**

The original file was a *bundle*: every module shared one global scope and
referenced the others by bare identifier. There are **no `import` statements
between project modules** — and there still aren't.

Converting all of it to true ES modules would have meant hand-wiring several
hundred cross-module imports, with a high risk of silently changing behaviour.
Instead, `build_app.mjs`:

1. Reads the modules in their original evaluation order
   (`BACKEND_MODULES`, then `FRONTEND_MODULES`).
2. Extracts every third-party `import` (React, lucide-react), deduplicates
   them, and hoists them to the top of the output.
3. Strips per-module `export` blocks and appends one default export.
4. Writes `gloobal-essentials-preview/src/GloobalApp.jsx`.

That output file is a **build artifact**. The source of truth is `backend/`
and `frontend/`.

### Two rules this imposes

- **Module order in `build_app.mjs` is semantically significant.** Adding a
  module means inserting its path at the correct position in the list, not
  appending it.
- **Identifiers are global across the whole project.** Every function, class,
  and constant name must be unique project-wide.

Converting the project to real ES modules remains possible as a separate,
deliberate piece of work. It is not required for anything currently working.

---

## 4. Work Completed

### 4.1 Extraction

- Monolith split into 115 files under `backend/` and `frontend/`, following
  the `// src/...` origin comments already present in the source.
- `module_manifest.json` recorded all 116 extracted sections with their
  original paths and line counts. Retired to `_trash/` on 11 Aug once the
  split was verified — it was only meaningful alongside the monolith.

### 4.2 Build Pipeline

- **`build_app.mjs`** written to reassemble the app entry from the organised
  sources, with import hoisting and deduplication.
- **npm scripts wired** in `gloobal-essentials-preview/package.json`:
  `predev` and `prebuild` both run `build_app.mjs`, so the generated entry
  can never go stale relative to the sources.

### 4.3 Build Failures Fixed

The build initially failed with 21 duplicate-symbol errors, then 1.

**Errors 1–20 — duplicated imports.** Each extracted module still carried its
own `import` lines from the monolith. Concatenating them redeclared
`useState`, `useEffect`, `Lock`, `ImageIcon` and others, plus a duplicate
default export. Fixed by hoisting all imports into a single deduplicated
block and stripping per-module export blocks.

**Error 21 — a genuine data-loss bug, root-caused and repaired.**

```
ERROR: The symbol "GloobalQRCode" has already been declared
```

The monolith contained two distinct modules whose paths differed only by
letter case:

- `src/components/common/gloobalQRCode.jsx` (the React import aliases)
- `src/components/common/GloobalQRCode.jsx` (the component itself)

On Windows's case-insensitive filesystem, extraction wrote both to the same
path. The second silently overwrote the first, and the first module's content
— the `useState3` / `useEffect3` / `useMemoQr` import aliases the component
depends on — **was lost**. No error was raised at extraction time; it only
surfaced later as a confusing duplicate-symbol failure.

Fixed by merging both sections into a single
`frontend/components/common/gloobalQRCode.jsx` and removing the duplicate
entry from the module list, with a comment recording why.

### 4.4 Test Suite Migration

`financial-principles-tests/scripts/build-test-bundle.mjs` previously sliced
the monolith by its `// src/...` comment markers. It now builds directly from
the `backend/` module tree.

- Rewritten as an explicit ordered module list rather than text slicing.
- Existing guard against pulling in JSX retained.
- **New guard added**: rejects any stray top-level `import`/`export`, which
  would silently break the shared-scope concatenation.
- No test files needed changing.
- **Verified**: the regenerated bundle is code-identical to the previously
  passing one — 2,783 code lines, 0 diffs.

### 4.5 Documentation

- **`README.md`** — now documents the concatenation build model, the two
  rules it imposes, and the correct dev/test/build commands.
- **`docs/architecture.md`** — layered architecture diagram (Mermaid).
- **Markdown corruption fixed**: `README.md` and `docs/architecture.md` had
  been written with literal backslash-escaped backticks (50 and 12
  occurrences), which broke every code fence and inline-code span in both
  files. Unescaped.
- **Stale references corrected** in `financial-principles-tests/README.md`,
  which still described the old monolith-slicing workflow.
- **`memory.txt`** — a status section appended, superseding the earlier
  working transcript.

---

## 5. Verification Performed

All checks were run after the final change, not incrementally.

**Parity against the original monolith.** Both files normalised (whitespace
and comments stripped), then compared as line multisets:

```
monolith lines 14010   generated 14010
totals missing 0   extra 0
```

**Production build**, from a deliberately deleted artifact to confirm the
`prebuild` hook regenerates it:

```
✓ 1500 modules transformed
dist/assets/index-uYYqNLJ8.js   649.52 kB │ gzip: 185.33 kB
✓ built in 1.59s
```

The output hash was identical across rebuilds — the pipeline is deterministic.

**Dev server**: `npm run dev` runs `predev` (52 imports consolidated), Vite
ready in 400 ms, `http://localhost:5173/` returns 200 and the entry module
transforms cleanly.

**Domain tests**:

```
ℹ tests 166
ℹ pass 166
ℹ fail 0
```

---

## 6. Decisions Taken

The implementation plan left two questions open. Both were resolved:

**1. Keep the monolithic `GloobalApp.jsx`?** — *Kept frozen at first, retired
on 11 Aug.* It sat at the project root as a pre-split reference until the
split had been verified and the first round of fixes landed on the modular
sources. At that point it was both unreferenced and stale, so it moved to
`_trash/` along with `module_manifest.json`. Delete that folder whenever you
are satisfied nothing broke.

**2. Test-suite migration approach?** — *Option B: keep bundle generation,
repoint it at the new structure.* This required zero test-file churn and the
result was verified byte-identical to the previously passing bundle. Option A
(rewriting every test to import from source modules directly) would have been
a larger, riskier change for no verification benefit, given the modules have
no imports to import.

---

## 7. Commands

```bash
# Preview the app (rebuilds entry from sources first)
cd gloobal-essentials-preview
npm install
npm run dev

# Run the domain test suite
cd financial-principles-tests
node scripts/build-test-bundle.mjs     # regenerate after domain changes
node --test tests/*.test.mjs

# Production build (rebuilds entry from sources first)
cd gloobal-essentials-preview
npm run build                          # outputs to dist/

# Rebuild the combined entry file by hand
node build_app.mjs
```

---

## 8. Known Limitations & Suggested Next Steps

Nothing below is blocking. The project builds, runs, and passes its tests.

1. **Modules are not true ES modules.** They share one global scope and are
   concatenated in a fixed order. This is the single largest piece of
   remaining technical debt from the split, and the constraint behind both
   rules in section 3. Migrating to real imports is a well-defined follow-up
   project.
2. **Bundle size**: 649.52 kB exceeds Vite's 500 kB warning threshold. Code
   splitting is not currently possible while everything shares one scope —
   this is downstream of item 1.
3. **No automated regression gate.** The parity check that proved the split
   was lossless was run manually. It would be worth committing as a script so
   any future change to `build_app.mjs` is checked automatically.
4. **Manual UI verification still recommended.** Automated checks confirm the
   app builds, serves, and that the domain layer is correct. Spot-checking
   Dashboard, Send Money, Coverage, and DevTools in a browser is still
   advisable before considering this signed off.
5. **`FIXES.md`** still refers to `GloobalApp.jsx` as the source of truth.
   Left as-is deliberately — it is a historical record of a bug-fix pass that
   genuinely was applied to that file.
