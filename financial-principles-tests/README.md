# Financial-principles conflicts found + fixed, and stress tests

Run with: `node --test "tests/**/*.test.mjs"` (Node 18+, no install).

The bundle files `app_bundle_testonly.mjs` and `src/data/essentialsBaseline.js`
are generated from the `../backend/` module tree (the source of truth) by
`scripts/build-test-bundle.mjs` — regenerate them after any domain-layer
change:

    node scripts/build-test-bundle.mjs

The script concatenates the pure-JS domain modules in the project's
evaluation order and guards against accidentally pulling in JSX or a
stray `import`/`export`, so the tests always exercise exactly what
ships.

## My Essentials daily pool pass — a genuinely separate concept from Creator Share

Correction from the previous pass: "My Essentials" and "Essentials
grants" (Creator Share cashback, `EssentialsService`/`EssentialsGrant`)
had been conflated — they share the word "essentials" and a ledger
account name, but they're not the same thing. My Essentials is a
**daily liquidity pool the platform funds directly from its own
reserve**, for Food/Water/Shelter/Creativity spending — not something
the user pays into, not a payment method they pick, and not connected
to PayLater or Creator Share at all.

1. New `EssentialsPoolService` — completely separate from
   `EssentialsService`. Tracks `usedToday`/`trackedDate`; the daily
   limit is supplied by the caller (currently the country's Essentials
   baseline total) rather than hardcoded, since the real limit policy
   isn't finalized yet. There's no explicit "reset" — usage is simply
   measured against the current calendar date every time it's checked,
   so a new day means the full limit is available again automatically.
2. `TransactionOrchestrator#applyEssentialsPoolSubsidy` — a **separate
   atomic operation** from `executeTransaction`, reusing the exact same
   lock/snapshot/event-staging/rollback machinery. It tops up the
   user's own bank balance directly from the platform reserve (a real,
   ledger-conserving `DebitEntry(bank)`/`CreditEntry(reserve)`, the
   same shape Opening Balance uses), capped at whatever's left of
   today's limit. Once applied, it's real spendable bank balance for
   the rest of the day — not tied to one specific purchase attempt,
   matching "the baseline amount becomes spendable directly, no
   separate funding step."
3. Scan & Pay now calls this once, before the real payment, so the
   subsidized amount is already real bank balance by the time the
   payment's own risk check runs — it can turn an otherwise-unaffordable
   payment into an affordable one, verified end-to-end.
4. New `ESSENTIALS_POOL_APPLIED` domain event, staged/published exactly
   like every other transaction-owned event — never live mid-call, never
   duplicated, timestamped with the call's own authoritative `now`.
5. The My Essentials screen now shows a real "Left today" figure next
   to the daily limit, backed by actual ledger state.
6. **Explicitly verified separate from Creator Share/PayLater**: a
   subsidy never creates a grant or touches PayLater due, and the
   PayLater auto-settlement built in the previous pass is completely
   untouched and still verified working.

## essentialsPool.test.mjs — 15 tests (new this pass)

Basic mechanics (real ledger top-up, capped at the daily limit,
depletes across multiple requests, exhausted returns zero with no
ledger entry); daily reset (measured against the current date, not a
manual action); zero/negative-input no-ops; end-to-end proof that
applying the subsidy turns an otherwise-failing payment into a
succeeding one; explicit separation from Creator Share grants and
PayLater due (before and after — including a full grant + auto-settle
scenario proven still intact); events (published exactly once, none
for a no-op, correct payload, authoritative timestamp); atomicity
(ledger failure rolls back the usage counter too, not just the
ledger; a failed attempt publishes no success event); re-entrancy (the
subsidy shares the executeTransaction lock, correctly rejects a nested
attempt, and releases properly afterward); and conservation (bank and
reserve move by exactly the same amount in opposite directions, never
more or less).

## Dual receipts + PayLater auto-settlement priority pass

1. **"Received" history no longer gated to Creator mode.** Cashback/
   Creator Share you earn from a payment you make belongs to you
   regardless of which mode you were in when you sent it. A Send
   Money/Scan & Pay/Pay-a-Business transaction that carries a Creator
   Share rate now produces two real entries visible in your own
   history either way: a Paid entry (the amount sent) and — once the
   grant lands — a Received entry (the cashback), both feeding the
   same Dashboard chart and History screen. Previously the Received
   side only showed in Creator mode.
   - **Not implemented, and not fabricated:** a real second set of
     receipts for the counterparty ("Jio's side") — this is a
     single-device prototype with no second account to generate real
     receipts for. Building that would mean inventing data for an
     account that doesn't exist, which this project has consistently
     avoided (see the location-observation work).
2. **PayLater auto-settlement priority**, matching the worked example
   (owe 100, pay 50 manually, 50 left; earn a new 100 in Creator
   Share; the new grant settles the remaining 50 first, the other 50
   is free): `TransactionOrchestrator#completeTransaction` now checks
   outstanding PayLater due immediately after a grant is created, and
   auto-settles `min(due, grant's accrued value)` from Essentials into
   PayLater via a new `SettlementEngine#settleEssentialsToPayLater` —
   a real, ledger-conserving transfer between the user's own accounts
   (Essentials debited/reduced, PayLater liability credited/reduced),
   not just a smaller number shown somewhere. It's part of the same
   atomic transaction: if anything after it fails, the settlement
   rolls back along with the grant.
3. **Real bug found and fixed along the way:** `PayLaterService#computeAvailable`'s
   `due` figure was computed by summing pending draw records and never
   actually reflected any settlement, auto or manual — so the "Pending
   dues" figure shown in the PayLater screen (and the domain-level risk
   check) would never go down even after a real settlement moved real
   ledger money. Fixed by switching `due` to the real
   `paylaterPayable` liability account balance (the actual source of
   truth) when `userAccounts` is available, both in the domain
   (`computeAvailable`) and in the UI layer (new `usePaylaterDue()`
   hook feeding `computePaylaterAvailable`).

## paylaterAutoSettlementPriority.test.mjs — 7 tests (new this pass)

The exact worked example (owe 100 → pay 50 → 50 left → earn 100 →
auto-settle 50, due becomes 0); a grant larger than the due settles
only the due, never more; a grant smaller than the due settles only
what it can, due stays partially outstanding; no due at all means no
auto-settlement and the grant is fully free; a transaction with no
Creator Share never triggers a settlement even with due outstanding;
the settlement's effect on each account matches a pure transfer
exactly (Essentials nets grant-minus-settled, the liability drops by
exactly the settled amount); and atomicity — if a later stage fails
after the auto-settlement's real work already happened, the
settlement rolls back along with everything else.

## Transaction event outbox completeness pass — PayLater and Essentials now staged too

The previous pass staged Ledger and Provenance events but left a gap:
`PayLaterService` and `EssentialsService` had no `eventBus` field at all
(their two domain events, `PAYLATER_DRAW_RECORDED` and
`ESSENTIALS_GRANT_ADDED`, were defined in the `DomainEvent` enum but
never actually emitted anywhere). This pass closes it:

1. Both services now take an `eventBus` in their constructor (same
   additive, optional pattern as `LedgerEngine`/`ProvenanceService`)
   and genuinely emit their event on success — `PAYLATER_DRAW_RECORDED`
   after a real draw posts, `ESSENTIALS_GRANT_ADDED` after a real grant
   posts. Both timestamps (`drawnAt`/`grantedAt`) use the transaction's
   authoritative `now`, same as every other event in the chain.
2. `TransactionOrchestrator#stageEvents()` now swaps FOUR services'
   `eventBus` to the transaction's outbox, not two — `payLaterService`
   and `essentialsService` alongside `ledgerEngine` and
   `provenanceService`. Any future transaction-owned event source just
   needs adding to this one list.
3. Rollback discards the whole batch, exactly as before — a
   `PAYLATER_DRAW_RECORDED` or `ESSENTIALS_GRANT_ADDED` from a stage
   that later failed never reaches committed history, and never
   consumes a sequence number.

## transactionEventOutboxCompleteness.test.mjs — 12 tests (new this pass)

The 7 required failure/success scenarios (ledger→provenance→PayLater
succeed then Essentials fails; ledger→PayLater succeed then completion
fails; ledger→Essentials succeed then a later stage fails; a successful
PayLater transaction publishes its event exactly once; a successful
Essentials transaction publishes its event exactly once; a duplicate of
an already-committed transaction adds no duplicate events; a retry
after rollback succeeds cleanly with events exactly once) plus the
required verification checks: PayLater/Essentials both have a live
eventBus outside any transaction, authoritative-`now` timestamps on
both new event types, rolled-back events never consuming a sequence
number, the re-entrancy lock still protecting a PayLater+Essentials
transaction, and location staying fully independent (no location
supplied, no fabrication, transaction still completes).

## Transaction/event consistency pass — transactional outbox, re-entrancy lock, deterministic timestamps

The rollback mechanism from the previous pass correctly undid STATE on
failure, but domain EVENTS had already been published live, synchronously,
as each mutation happened — so a listener (Logger, diagnostics, anything
subscribed to the bus) could observe `ledger.entry.posted` or
`provenance.completed` for a transaction that moments later got rolled
back and never actually happened. Separately, nothing stopped a
re-entrant call from starting a second mutating transaction while one
was still mid-flight, which — since rollback restores stores to a
snapshot taken *before* that window — could silently erase whatever
the second transaction had committed in between. And several places
independently called `new Date()` for what should have been one shared
transaction timestamp.

1. **Transactional event outbox.** New `TransactionEventOutbox` — a
   pure buffer (`emit()` just appends; nothing is ever dispatched to a
   listener). `TransactionOrchestrator#stageEvents()` temporarily
   swaps `ledgerEngine.eventBus` and `provenanceService.eventBus` to a
   fresh outbox for the duration of `executeTransaction`'s mutating
   window. On success, the outbox is discarded via `restore()` and its
   contents are replayed onto the real bus, in original order,
   *after* state mutation is final (`#flushStaged`). On failure, the
   outbox is discarded outright — nothing in it ever reaches the real
   bus — and exactly one `TRANSACTION_FAILED` event is emitted instead,
   after rollback. `RISK_EVALUATED` (pre-mutation, no state change) is
   intentionally NOT staged — it fires live either way, since it's not
   a "committed-looking" fact about anything that happened.
2. **Re-entrancy lock.** A private `#locked` boolean on
   `TransactionOrchestrator`, set immediately before the snapshot is
   taken and released in a `finally`. A second `executeTransaction`
   call arriving while one is already inside its mutating/snapshot
   window is rejected immediately with `{ok:false, code:"TRANSACTION_LOCKED"}`
   — no mutation attempted, so there's nothing for the first
   transaction's eventual rollback to corrupt. Risk evaluation and the
   replay-read path are exempt (no mutation, safe to run reentrantly).
3. **Deterministic timestamps.** `executeTransaction`'s own `now` is
   threaded through every posting/record it makes — `applyDeduction`
   → `LedgerEngine.postJournalEntry` → `LedgerStore.append` →
   `LedgerRecord.postedAt`, `PayLaterService.recordDraw`,
   `EssentialsService.addGrant`, and `ProvenanceService.recordCompletion`
   → `ChainStore.append` → `recordedAt` — all as an *optional*
   parameter, defaulting to `new Date()` only when omitted, so every
   other non-transactional call site (opening balance, settlements,
   diagnostics) is unchanged. One transaction, one timestamp, shared
   by every fact and event it produces.

Everything else — the double-entry ledger, closed-loop conservation,
`executeTransaction()` as the one canonical lifecycle, both
idempotency layers, the snapshot/rollback mechanism itself, Send
Money/Scan & Pay/Pay a Business, PayLater rollback, the 30-minute
complaint window, the 24-hour receiver response window, independent
sender/receiver location observations, UNKNOWN location handling, My
Essentials gating, and asset-seed rules — is unchanged.

## transactionEventConsistency.test.mjs — 12 tests (new this pass)

Successful-transaction events published exactly once; ledger failure
(PayLater draw throws) produces no committed success events; provenance
failure discards the already-staged ledger event too; asset-seed
failure discards both the staged ledger event AND the staged provenance
event; PayLater-draw-then-completion-failure discards the draw's own
ledger event; retry-after-rollback publishes events exactly once;
duplicate-after-commit touches the event bus not at all (pure read);
a re-entrancy/concurrency test proving a nested transaction attempt is
rejected by the lock while another is mid-flight, that the locked
transaction's own rollback doesn't erase an unrelated already-committed
baseline transaction, and that the lock releases correctly afterward;
event payload timestamps matching the transaction's authoritative `now`
(both on success and via `TRANSACTION_FAILED.failedAt`); implicit
(un-supplied) `now` still producing exactly one shared timestamp across
every effect of a call; and rolled-back events never consuming a
committed sequence number, with contiguous seq numbers verified across
a rollback-then-success sequence.

## Transaction atomicity pass — a true transactional boundary

The previous pass made `executeTransaction()` the one canonical entry
point, with two layers of duplicate-request idempotency. It did NOT,
however, protect against a mid-sequence failure: if ledger posting
succeeded but a later stage (provenance recording, the complaint
window, or the asset-seed grant) then threw, the already-posted ledger
entries (and any PayLater draw) were left committed with nothing to
show for them — a real partial-state gap.

This pass closes it:

1. **`LedgerStore`, `ChainStore`, `EssentialsService`, and
   `PayLaterService`** each gained `snapshot()`/`restore(snapshot)`
   methods — a shallow copy-and-swap of their internal record arrays
   (safe because records are append-only and never mutated in place).
2. **`TransactionOrchestrator`** gained private
   `#captureSnapshot()`/`#restoreSnapshot()` helpers that capture/
   restore all four stores together.
3. **`executeTransaction()`** now takes the snapshot immediately after
   risk evaluation passes (the last point before any mutation) and
   wraps the rest of the sequence — ledger post, PayLater draw,
   provenance/completion record, complaint-window creation (part of
   that same record), and the asset-seed grant — in a single
   `try/catch`. Any exception anywhere in that sequence restores every
   store to its exact pre-transaction state and returns
   `{ ok: false, code: "TRANSACTION_ROLLED_BACK", reason, txnId }`
   instead of a partially-applied transaction.
4. **Idempotency is preserved across rollback.** A rolled-back txnId
   leaves zero provenance trace, so `isFirstCompletion(txnId)` still
   reports `true` afterward — retrying is indistinguishable from a
   genuine first attempt. Retrying an already-*committed* txnId still
   hits the existing backstop and creates nothing twice.
5. **Location is explicitly outside the transactional boundary** —
   `submitLocationObservation()` is untouched by snapshot/restore, by
   design, since location must never gate or be entangled with
   financial atomicity.
6. **Known gap flagged, not fixed**: `viewerRole` (ProvenanceService),
   `raisedBy` (DisputeService.openComplaint), and `role`
   (submitLocationObservation) are still plain caller-supplied strings
   in this client-only prototype. Production must derive these from
   authenticated identity server-side rather than trust a client-passed
   role — see the TRUST BOUNDARY comments at each call site under
   `backend/domain/`.

This is an in-memory analogue of BEGIN/COMMIT/ROLLBACK, structured so
the snapshot/restore pair can be swapped for a real database
transaction (e.g. a single `db.transaction(async (tx) => {...})` block)
without changing `executeTransaction()`'s external shape.

## transactionAtomicity.test.mjs — 10 tests (new this pass)

Failure injection via temporary method-swap (no production code needed
to support it — plain JS method dispatch already resolves dynamically):
ledger→completion failure, ledger→provenance failure, ledger+provenance
→grant failure, PayLater draw→completion failure (with PayLater-record-
specific rollback verification), complaint-window persistence failure,
duplicate-call-after-commit, retry-after-rollback (verifying every
effect exists exactly once, including the two-ledger-entry case with a
grant), same-clientRequestId-after-rollback semantics (correctly
replays the cached failure, distinct from a fresh-request-id retry),
location independence from rollback, and a no-mutation risk-failure
baseline for contrast. Every rollback test asserts: balance, ledger
count, PayLater record count, and grant count unchanged, plus
completion/provenance/complaint-window all absent for that txnId.

## Previous pass — one canonical lifecycle, real domain-boundary atomicity, receiver-side location interface

1. **One canonical transaction lifecycle.** Send Money, Scan & Pay, and
   Pay a Business no longer have their own posting logic. All three now
   call `TransactionOrchestrator.executeTransaction()` — the single
   method that does risk-check → ledger post → provenance record →
   complaint-window open → asset-seed eligibility, as one call. The old
   `scanAndPay()` (which posted with **no risk/balance check at all** —
   a real bug) and the dead `sendMoney()`/`buildReceipt()` convenience
   method are removed.
2. **Atomic/idempotent at the domain boundary, not fire-and-forget from
   UI.** `executeTransaction()` has two independent duplicate-request
   defenses: `clientRequestId` via the shared `IdempotencyGuard` (fast
   path — a retried submit never re-runs anything), and a durable
   `txnId`-based backstop checked against the provenance store itself
   (catches a retry even if it arrives with a *different or missing*
   `clientRequestId` — a real gap in the previous pass, since
   `applyDeduction`'s own guard used a separate key than
   `completeTransaction`'s). The UI now awaits one call per transaction
   instead of a synchronous post followed by an async, detached
   completion call.
3. **Real (generalized) location-observation submission interface.**
   `ProvenanceService.submitLocationObservation({txnId, role, observation,
   clientRequestId})` lets either party's own device report its own
   observation against a txnId, independently of transaction completion
   — before it, after it, or more than once (latest submission per role
   wins). The "current" location for a viewer is derived by folding the
   latest submission over the completion-time snapshot; the snapshot
   itself is an immutable record, never rewritten. This is a real,
   callable interface a receiving device can use — not a placeholder.
4. **Never fabricated, never gates financial validity.** Location was
   already decoupled from money in the previous pass; this pass makes it
   *structurally* impossible for it to gate anything, since
   `executeTransaction()` doesn't read geo status at all when deciding
   `ok`. With no connected receiver device, the receiver stays `UNKNOWN`
   — never guessed.
5. **New test file `transactionLifecycle.test.mjs` (21 tests):**
   lifecycle-shape parity across all three flows, no lower-risk posting
   path, atomicity on failure at the risk-evaluation stage (nothing
   posted/completed/granted/windowed), retry-after-failure on the same
   txnId, duplicate requests via both the `clientRequestId` guard and
   the `txnId` backstop (including with no `clientRequestId` at all),
   location never gating `ok`/grant/window, and independent sender/
   receiver location arrival — before completion, after completion,
   repeated submissions (latest wins), invalid role, missing txnId,
   no-fabrication, duplicate-submission dedup, complaint-window
   isolation from location, and chain integrity with location events
   mixed in.

## Previous pass — transaction lifecycle, location honesty, capability gating

1. **Complaint window widened to 30 minutes** (was 15); receiver
   dispute-response window stays 24 hours. `COMPLAINT_WINDOW_MINUTES_DEFAULT`
   and `DISPUTE_RECEIVER_RESPONSE_HOURS_DEFAULT` are the single source
   of both.
2. **Send Money and Scan & Pay share one lifecycle.** Scan & Pay used
   to be a bare ledger post with no txnId, no provenance, no complaint
   window, and no history entry — completely unreportable. It now
   mints a real txnId, posts the ledger debit, then calls
   `completeTransaction()`, identically to Send Money.
3. **`completeTransaction()` is atomic and idempotent.** "First
   completion" is decided once, up front, from the durable provenance
   store (`isFirstCompletion`) — not from a flag threaded through the
   call — so a retried/duplicated call for the same txnId is a pure
   no-op: no second provenance record, no second complaint window, no
   second asset-seed grant. `EssentialsService.addGrant()` also
   dedupes by `txnId` independently, and the whole call can additionally
   route through the shared `IdempotencyGuard` via `clientRequestId`.
4. **No more direct/unsafe asset-seed creation.** The old
   `TransactionOrchestrator.addEssentialsGrant()` passthrough — reachable
   from the UI's "Pay a business" sheet with no ledger deduction and no
   completed transaction behind it — is removed. That flow now debits
   through `checkAndDeduct()` and completes through
   `completeTransaction()` like every other payment; an asset seed can
   only ever come from a real, first-time completion.
5. **Location is never fabricated.** The old `demoGeoForCountry()` (a
   deterministic-but-fake coordinate generator standing in for "no real
   second device") is deleted outright. It's replaced by
   `LocationObservation` / `LOCATION_STATUS`, an explicit
   available/denied/unavailable/timeout/stale/unknown state machine.
   `captureBrowserGeo()` now reports the real outcome of asking the
   device (denied vs. no capability vs. no answer in time) instead of
   collapsing every failure into `null`. Coordinates + accuracy +
   timestamp + status are always stored together in the backend
   completion record; the UI-facing projection (`getLocationForViewer`)
   still only ever returns city/state, never raw coordinates, and
   never guesses one when the status isn't AVAILABLE/STALE. With no
   connected receiver device in this build, the receiver side is
   recorded as `UNKNOWN` — the same backend slot a real receiver client
   would report into, just genuinely empty for now rather than faked.
6. **Centralized capability states.** `deriveCapabilityStates()` is now
   the single place that decides whether Gloobal Coin / PayLater / My
   Assets / My Essentials are locked, replacing five independent
   hardcoded `locked: false` literals on the Account-tab tiles. My
   Essentials is locked for first-time users until Gloobal Bank has
   been opened at least once.

## Conflicts found in the (then-)existing code and fixed in the prior pass

1. **Money creation** — EssentialsService.addGrant() credited a
   same-user INCOME account (creatorShareIncome) while debiting
   essentials, manufacturing value with nothing external funding it.
   Fixed: grants now draw from the platform reserve, the same
   "already-collected liquidity, redistributed" pattern every other
   movement uses.
2. **Fake liquidity check** — LiquidityService.hasSufficientLiquidity()
   was a stub that always returned true. Fixed: it now checks the
   reserve's real balance.
3. **Unchecked settlement** — SettlementEngine posted settlements with
   no source-balance check, so a duplicate settlement could drive a
   balance negative. Fixed: verifies sufficient source balance first,
   returns {ok, code, reason} instead of blindly succeeding.
4. **No idempotency on the money-movement path** — IdempotencyGuard
   existed (built for disputes) but wasn't wired into the send flow.
   Fixed: applyDeduction accepts an optional clientRequestId, wired to
   the UI's existing per-attempt request-id ref.
5. **Latent type bug** — referralEarnings was declared INCOME
   (credit-normal) but used as a settlement source, the same bug shape
   as #1, just not yet triggered (nothing funds it). Fixed the type to
   ASSET.

A latent bug also found and fixed this pass, outside the ledger:
Scan & Pay's completion handler called an undefined `showToast()` —
would have thrown `ReferenceError` on every demo scan-and-pay with a
nonzero amount. Fixed with a small root-level toast (same visual
language every other screen already uses).

Two health checks: checkMonetaryConservation (M = ΣBᵢ, generalized
across every registered account) and checkNoUnbackedIncomeRecognition
(the check that actually catches bug #1's bug class).

## financialPrinciples.test.mjs — 22 stress tests

Holding/zero-tx validity, money-creation regression guards, repeated
circulation across 20 real P2P users (volume 2.5x the monetary base),
full-balance transfers, extreme concentration, 10,000 independently
registered users, rapid sequential ("simultaneous") spending never
overdrawing, duplicate settlement (with and without idempotency keys,
to show why the key matters), insufficient system-wide liquidity,
a full fraud/dispute lifecycle never touching balances, deterministic
replay, atomic rejection of unbalanced/invalid entries, and
IdempotencyGuard concurrency-safety. Unchanged this pass — still 22/22
green, confirming the ledger/conservation/replay core was untouched.

## provenanceAndDisputes.test.mjs — 47 tests

LocationObservation status semantics (available/denied/unavailable/
timeout/stale/unknown, never fabricated, range-invalid coordinates
never resolve to a city), staleness re-evaluation, the 30-minute
complaint window / 24-hour receiver window boundaries, completeTransaction
atomicity and idempotency (including the clientRequestId guard path),
EssentialsService.addGrant's own txnId dedup, Send-Money-vs-Scan-and-Pay
lifecycle parity, the full DisputeService state machine, and centralized
capability-state derivation including the Essentials-locked-until-Bank
gate. (These exercise the lower-level `completeTransaction`/`evaluateSend`/
`applyDeduction` primitives directly, which remain as composable
building blocks used internally by `executeTransaction`.)

## transactionLifecycle.test.mjs — 21 tests

See "Final transaction pass" above.

