# Gloobal — Progress Log

Running day-by-day record of work on the Gloobal project. Newest entry first.

**Conventions**
- Each day gets its own `##` section, dated `YYYY-MM-DD`.
- **Done** = work completed and verified. **In progress** = started, not finished. **Blocked / carry-forward** = needs a decision or a later session.
- Entries before 2026-07-21 are reconstructed from git history (commit subjects only), so they list *what shipped*, not the full reasoning behind it.

---

## Codebase size — as of 2026-07-31

Hand-written lines under version control. Generated files (`package-lock.json`, `dist/`, `node_modules/`) and binary assets are excluded, so this is work actually written rather than a repo weight.

| Area | Lines | vs 07-30 |
|---|---|---|
| `Frontend/src` — the app itself | 16,357 | +881 |
| `Frontend/e2e` — Playwright suites | 6,251 | +799 |
| `Backend` — Express API + Mongoose models | 2,970 | +63 |
| Frontend config, service worker, build scripts | 331 | — |
| **Total code** | **25,909** | |
| Documentation (`.md`) | 3,350 | +210 |
| **Total written** | **29,259** | **+1,736** |

The five largest files: `DashboardScreen.jsx` 4,328 · `App.jsx` 2,439 · `server.js` 2,374 · `SendMoneyScreen.jsx` 1,553 · `GHScoreScreen.jsx` 981.

Today added 2,559 lines and removed 729 across 21 files.

**Test inventory: 179 Playwright checks across 11 spec files, none skipped.** Yesterday's suite shipped with five skips waiting on an undelivered file; today it has none.

---

## 2026-07-31 (Fri)

Six founder items were set for today. **All six shipped**, on `feat/3107-founder-fixes`, merged to `main` and pushed.

The through-line: **three of today's six were reports that something was missing, and in two of those cases the thing was there — it just couldn't be seen or couldn't be trusted.** A badge that existed but was legible one second in three. A dashboard that restored your session so faithfully it stopped asking who you were. Diagnosis mattered more than code today; two of the fixes are smaller than the investigation that found them.

### 1. The badge stops rotating (`77b5bbc`)

Third session running, the same report: the registration screen has no "Register · Gloobal ID" heading, while login has its equivalent. Twice before it was "fixed."

It was never missing. The badge was a `CyclingBadge` rotating `["Register", "Gloobal", "Id"]` on a 2.6-second timer, so the **verb** — the only word distinguishing the two screens — was on screen a third of the time. Every previous fix had added the correct words to a component that could only ever display one of them. Looking at the screen at the wrong moment, which is most moments, showed "Gloobal" or "Id".

Fixed in place now. The "Gloobal ID" wordmark directly above the card already carries the branding the badge was borrowing, so holding still costs nothing. The accessible name still reads the whole phrase; only the visible text is the verb. The regression check waits **3.2 seconds** — longer than the rotation that caused this — and asserts the word hasn't moved.

### 2. A restored session stops being a key (`77b5bbc`)

"When I re-login it doesn't ask me face or finger or pin." It didn't. `stage` was initialised to `"dashboard"` whenever a session was restored, so the persisted `localStorage` blob **was** the credential. Anyone holding the unlocked phone had the account, and the blob is editable in devtools.

New lock screen. It names the account — flag, first four symbols, the rest dotted — and makes you prove it is still yours: the passkey fires on arrival when this device enrolled one, the PIN pad sits underneath for when it doesn't, and a device with neither is told to set up a screen lock rather than shown a prompt nothing can answer. A failed passkey is never a dead end. "Sign in with a different account" is the way out, and sessions expire after 30 days.

The second half of that report — biometrics missing after registration — turned out to be already implemented: registration has gone PIN → `deviceSetup` → dashboard since an earlier session. Verified rather than rebuilt.

`session-persistence.spec.mjs` asserted the old behaviour, that a reload lands on the dashboard. That suite was encoding the bug, so its reload tests now unlock with a PIN first.

### 3. The GH Score screen, ported (`3b24f21`, `adf9def`)

Blocked two sessions running on a file that never arrived; it arrived mid-session, at `D:\Downloads\GHScore.jsx`. Earlier searches had swept `C:\Users\*\Downloads` and not the D drive — the "it is nowhere on this machine" in yesterday's log was too strong.

The port is a replacement, not a merge: twenty check-ins across four pillars instead of twelve, each answer carrying points rather than a bare value, a segmented conic ring with one quadrant per pillar, a "complete" screen the instant the twentieth lands, and a per-pillar HSV colour wheel behind the header's palette icon.

Four deliberate departures from the standalone. Its local `T` is dropped for the shared tokens, with `ringTrack` resolving to `T.surface` so there is one white and not two. `GH_STYLE` is injected into the head under a fixed id instead of an inline `<style>` that would stack a node per open. The page shell becomes a fixed overlay with a working Back, since there is a dashboard underneath. And colours persist per account — they were in-memory, which made the "Save" button untrue the moment you closed the screen.

Answers written by the previous screen are ignored rather than migrated. The questions themselves changed, so a carried-over answer would be an answer to a question that no longer exists.

Ahead of the file arriving, the "Generate Score" button was removed on its own merit: it computed nothing. The score is derived from the answers and was already drawn on the gauge directly above it. The ported screen does the same thing natively.

### 4. The ID trail starts at creation (`37bf09a`)

"We need a proper record with time and date." Two real gaps behind it: the ID you originally chose appeared nowhere in your own history — only *renames* were recorded — and "30 Jul 2026" cannot tell apart two renames made a minute apart by someone trying three IDs before settling.

Entries now carry an action. **Created** is the ID the account started with, green-dotted, written at registration. **Changed** is a rename, purple-dotted, naming both what it changed from and what replaced it. Both stamped `DD Mon YYYY · HH:MM:SS`.

Accounts that registered before any of this was recorded are not left with a hole: the serializer derives the opening entry from the oldest recorded ID and the account's own join date, which is exactly when that ID came into existence. A real stored entry always wins over the derivation. The five-most-recent cap stays, with "View all (N)" underneath.

### 5. The receipt answers "did it work" first (`d819898`)

The outcome and the amount now lead — "Payment Successful" and the figure at 32px — because someone opening a receipt is usually checking one of those two things and previously had to read a details table to find either.

Date and Time became separate rows; they were one combined line that buried the time and rounded it to the minute. New rows: **Via — Gloobal Bank** on every payment, and **Paid via — PayLater** when the money came off a PayLater line rather than the balance. That distinction existed in the data and nowhere on screen. The asset note gets the green wash it should have had instead of the violet one, plus a "View in My Assets →" link — a planted seed you cannot then go and find is a claim, not a record.

The verification suite caught a real bug here that would otherwise have shipped: the date rendered `Jul 31, 2026`. `toLocaleDateString` reorders under an en-US locale, and every other dated surface in the app reads day-first, so the receipt alone looked foreign. Built from parts now.

### 6. Account tiles in the requested order (`7504dac`)

Was Bank, My Assets, Coin, PayLater, Linked Banks. Now Bank, PayLater, Coin, My Assets, Linked Banks. The list is the order, so the next reorder is moving one line.

**Not done, and flagged rather than invented:** the founder's list opens with an "All" tile. There is no combined-accounts view in the app for it to open, and deciding what it shows is a bigger call than a reorder.

### Cross-feature check — one collision found

Asked to verify today's six don't break each other, and one did. Two independent sources now record the same ID-creation event: the backend stamps its own entry at registration, and the client synthesises one from the account's join date when the backend has none. Both describe one event, but their timestamps come from different clocks and disagree by milliseconds — and the dedupe key included the timestamp, so a freshly registered account rendered **"Created" twice**.

An ID is created once, so `created` entries now dedupe on `(symbolId, created)` with the timestamp excluded, and the backend's record goes first into the merge so its timestamp wins. `T4-F` pins it.

### Verification

New suite `fix-verification-3107.spec.mjs`, 28 checks across the six tasks. `fix-verification-3007`'s five `T8` checks came off skip and now drive the ported component, colour wheel included — the repo has **no skipped tests** for the first time in three sessions.

The lock screen changed the shape of every suite that reaches the dashboard: eleven of them seed a session and expected to land there. Rather than adding a way to bypass the gate in tests — which would have meant the gate was not really unconditional — they now walk through it via `e2e/helpers/unlock.mjs`, and five needed a `POST /api/pin/verify` stub they never had.

---

## 2026-07-30 (Thu)

Eight founder items were set for today. **Seven shipped**, on `feat/3007-currency-receipt-real-data`, merged to `main` as `8b66a71` and pushed. The eighth is blocked and is described at the end.

The through-line: **most of today was deleting things that were not true.** Four separate screens were showing invented data — random spending figures, five made-up businesses, six made-up PayLater rows, a currency picker that changed nothing. Each looked like a working feature. None of them was reporting anything about the account looking at it.

### 1. One currency symbol everywhere (`3ab5bf3`)

The founder's report was "the both should be identical with currency sign — currently it's different." The cause was two independent lookups: `DashboardScreen` carried its own `CURRENCY_SYMBOL` map and rendered `₹1,000.00`, while Send Money used `CURRENCIES[code].label` and rendered `INR 1,000.00`. The same payment read one way on the screen that took it and another on the card it changed.

The map now lives in `constants/finance.js` behind `symbolFor()` and `symbolForCountry()`, and every screen reads from it: balance card, PAID, RECEIVED, transaction rows, PayLater, My Assets, My Share, Send. The currency *picker* still lists ISO codes, which is what a picker should show. No currency logic changed — only where the symbol is looked up.

### 2. A payment ends on a receipt (`f566413`)

There was no receipt. A completed payment produced three seconds of toast text and then nothing: no record of who was paid, what it cost, what it earned, or any reference to quote if it ever needed chasing.

New screen: animated tick, then To, Amount, Cashback earned, Date & Time, the transaction's short id, and Completed. The cashback row and the "planted as an asset" note appear **only when a seed was actually planted** — a plain person-to-person send earns nothing and now claims nothing. Share Receipt uses `navigator.share`, falling back to the clipboard. Done and Back both go to the dashboard, never back to the send form, which has nothing left to edit.

### 3. PAID and RECEIVED are real (`5c601c8`)

`generateDailySpending()` called `Math.random()` on every mount. The wallet card's PAID (`¥446.78`), its RECEIVED (`¥291.66`) and all seven bars were noise that changed each time the dashboard rendered.

New endpoint `GET /api/transactions/:symbolId?type=sent|received|all` returns the records plus `totalSent`/`totalReceived`. The totals are aggregated over **every** successful transaction rather than the returned page — a total that only counted the most recent 50 would quietly shrink as an account got busier. The card's PAID and RECEIVED are those lifetime totals; tapping a bar narrows to that day; the bars group real transactions into this week and last week. No transactions means flat zero bars.

While a figure is being fetched it renders as a shimmer, and a failed fetch renders as a dash. A number that isn't known yet must never be shown as a number.

### 4. PayLater history is the account's own (`5c601c8`)

Six invented rows (Metro Recharge, Grocery Mart, Coffee Corner...) with the dues derived from them. The endpoint now builds the list from records that exist: payments the account chose to put on PayLater (`metadata.payMethod`, newly recorded on send) as charges, and cashback seeds as credits. Dues are the charges nothing has repaid yet, so the limit, the dues and the list are three views of one set of records rather than three that can disagree. Loading, retryable error, and "No PayLater activity yet." states included.

### 5. My Assets carries no demo data (`250d9c4`)

Five invented businesses stood in whenever the account had no seeds, behind a "Demo data" chip. On a screen whose entire subject is your own spending, that reads as your own spending — the chip is a caption, the rows are the claim. Removed. An empty result now gets a proper empty state: seedling, "No assets yet", and the one action that changes it. A failed fetch shows the same thing rather than inventing a portfolio.

### 6. ID history moved to the top-right (`7668d39`)

The record of past Gloobal IDs sat below the dial pad and the Update button — reference material competing with the ID being typed — and grew without limit. It now opens from a history icon in the corner into its own sheet: the five most recent IDs, newest first, each with the date it was replaced. Entries still render in the display font, so the Gloobal symbols look the same here as everywhere else.

### 7. Currency and Subscriptions gone from Profile (`6a7dee9`)

Currency picked nothing: `profileCurrency` was read by its own picker and by nothing else, so choosing EUR left every amount in the account's registration currency. Subscriptions listed 80 real brands at demo prices with every row locked — a catalogue of things that cannot be done. Both rows, both panels, and the two catalogues behind them are removed. Personal Details, Paid, Received, Language, Security, Notifications, Help & Support and About stay.

### Verification

`fix-verification-3007.spec.mjs` — **22 checks, all passing.**

Full regression, **all 12 suites green**: gloobal 8, founder-ui-fixes 15, 2307 14, feature-verification 13, referral-link-fix 6, 2407 15, 2407b 12, 2707 18, 2807 22, cross-feature-2807 10, 2907 31, cross-feature-2907 10. Build clean. Lint byte-identical to the previous `main` — 30 problems (4 errors, 26 warnings), unchanged.

Ten existing suites needed repair, and it is worth being precise about why: they asserted behaviour that today's work **deliberately** changed. Tests expecting the post-payment toast now read the receipt; tests leaning on the demo seeds are given a real portfolio; tests reading the inline ID history open the sheet first; mocks shaping Paid/Received data target the new endpoint. Repaired, not deleted.

### Blocked — Task 8, the new GH Score component

The task was to port a refined `GHScore.jsx` supplied as `GHScore_jsx__1_.txt` (900 lines). **The file is not on this machine** — not in the repo, not on the Desktop, not in Downloads. It was never delivered.

Nothing was faked in its place. The five checks are written and marked skipped, so they run the moment the file arrives: a check written against the GH Score component already in the tree would have passed while saying nothing at all about the new one. The existing GH Score screen is untouched and still works.

### Carry-forward

- **Task 8 needs the file.** Send `GHScore_jsx__1_.txt` and it can be ported in one pass.
- **The backend has not redeployed.** Render still serves the old `server.js`: no `/api/transactions/:symbolId`, no PayLater activity list, no `payMethod` recorded on send. Until it redeploys, the live site shows `–` for PAID/RECEIVED and the retry state on PayLater. Netlify picks the frontend up on its next build, so the two halves are briefly out of step — the same gap as yesterday.
- **PayLater dues changed meaning.** They were hardcoded `0`; they are now the sum of unrepaid charges, which changes the available balance. There is still no repayment flow to bring them back down.
- **Concurrent payments race** (carried from yesterday, still open). Balance is read-modify-write with no locking.

---

## 2026-07-29 (Wed)

Six founder items on `feat/2907-badge-biometric-balance-myshare`, merged to `main` as `7d24e6a` and pushed. Then a deliberate second pass driving the six against each other, which turned up three defects that none of them showed alone.

**This is the day the prototype started holding money.** Until now no account had a balance: `LedgerEntry.balanceBefore/After` were both hardcoded `0` and the dashboard's balance was the string `"12,480.50"`. A Creator could choose a cashback rate and save it, but nothing was ever deducted, so the rate could never be observed.

### 1. Registration card says Register (`e407314`)

The login card's badge reads "Login · Gloobal ID". The registration card — the same card doing the opposite job — read "Create · Secure · Gloobal · Id": different word count, different phrase, no visible tie to the screen it mirrors. Now "Register · Gloobal ID".

The heading was already there; only the badge words were the gap.

**The badge has never had a stable accessible name.** It rotates one word at a time, so whatever word happened to be showing *was* the name — a screen reader could announce the card as "Id". The rotating half is now `aria-hidden` and the badge carries the whole phrase as its label. That is also what makes it testable without catching a random turn of the cycle.

### 2. Biometric offer was never appearing (`587d2ff`)

Founder reported "it auto-skips face and finger during login". The brief guessed a missing endpoint. **It was not that** — `POST /api/passkey/status` exists (`server.js:1098`) and works.

The real cause was at `App.jsx:506`: `hasPasskey` defaulted to `true` *both* before the call and inside the `catch`. Every slow answer, cold start or 5xx therefore read as "this account already has a passkey" and went straight to the dashboard. The screen only ever showed on a fast, successful, `enrolled = false` response.

Now defaults `false` and fails open to showing the offer. **The screen is skippable, so a wrong guess costs one tap in that direction and costs the whole feature in the other.**

### 3. Profile rows renamed (`9133ce8`)

All three rows already existed but named themselves inconsistently — "GH Score", "My Referral Network", "Change Gloobal ID": one possessive, one not, one an instruction. Now "My GH Score", "My Network", "My Gloobal ID". "Change Gloobal ID" also undersold itself, since the row shows ID history as well as changing the ID.

### 4. Balance hidden by default, revealed by device check (`a6292d1`)

The balance was on screen the moment the app opened — the one moment the mask exists for. It now opens masked every time, and **the revealed state is deliberately not persisted**: remembering it would put the number back on screen at exactly the moment being guarded against.

Revealing asks the device first, but only when a device check is really what stands in the way. An account with no passkey, a browser with no platform authenticator, or a status call that never answered all reveal directly — **a courtesy to the account holder, not a lock on their own money.** Only an enrolled account that then fails or cancels keeps the mask on.

Paid and Received were already reading real history, but a failed fetch was indistinguishable from an empty one: **someone with a full history was told they had never been paid.** The fetch now carries loading, ready and error states, and the error is retryable.

### 5. My Share replaces the cashback grid (`749c0a3`)

The old screen offered eight buttons, whole percents only, so a business wanting 1.57% had to pick a rate it did not mean.

My Share leads with the number itself as the input: a large editable field, a slider, and a custom field, **all writing one `rateText` state** — three ways to set one number, never three numbers that can disagree. A preview card restates the choice in money rather than percent.

Held as text, not as a number: a number state cannot represent `"1."` or a cleared field mid-edit, so typing a decimal would fight the caret. Saved through `toFixed(4)` before `Number()`, because `1.57 / 100` is `0.015700000000000002` and that is what would otherwise land in the request body.

**The backend needed no change** — `PATCH /api/creator/cashback-rate` already accepted any value in the 0–0.07 band and was never step-limited. `CreatorCashbackScreen.jsx` deleted rather than left beside its replacement.

### 6. Real balances, deducted on payment (`3038875`)

`User` gains a `balance` opening at a 10,000 prototype float. `POST /api/transactions/send` now refuses with 400 when the sender is short, debits the full amount, credits the payee the amount **minus their own cashback rate**, plants the difference as the sender's `AssetSeed`, and writes the real before/after figures into both ledger entries.

So a 1% Creator paid 1,000 receives 990, and the payer is out 1,000 with 10 of it now held as a growing asset. **Paying does not increase the payer's money** — the split decides how much of it stays spendable.

The insufficient-balance check runs **after** the PIN, not before: the answer says roughly what the account holds, which is not for whoever can guess a Gloobal ID. Every derived figure is rounded to the minor unit before storage, or the dust compounds with each payment.

### Verification

| Suite | Checks | Scope |
|---|---|---|
| `fix-verification-2907.spec.mjs` | 31 | the six items individually |
| `cross-feature-2907.spec.mjs` | 10 | two or more driven together |

**Six existing suites had been left pointing at controls that no longer exist** by the renames and the deletion. `referral-link-fix` was the expensive one — every test routed through a "My Referral Network" locator, so each spent its full 240s timeout failing to find it. That is what stalled the first regression sweep.

**One piece of plumbing came out rather than being tested.** My Assets took a `reloadKey` meant to invalidate it after a payment planted a seed — but the screen is unmounted whenever it is closed and re-reads on every open, so the key could never fire.

### The cross-feature pass — three real collisions

Each of the six was correct alone. Driven together, three were not.

**A payment receipt outlived its account.** `handleStartOver` resets some thirty pieces of state on sign-out but not `paymentReceipt`, and the dashboard applies it on mount. Sign out, sign in as someone else, and **the previous account's post-payment balance is what the new person sees.**

The first test for this *passed* — the incoming profile read overwrote the stale figure fast enough to hide it. The test that caught it removes that cover by failing the profile read, which is what a cold Render dyno does; the leftover 4,000 is then the only thing left to render. Now cleared on sign-out, and the receipt carries the payer's own Gloobal ID so it can only ever apply to the account that earned it.

**A debit could land with no matching credit.** Sender and payee balances are two independent writes. If the second failed, the first was already committed — money debited, nobody credited, and the outer catch only marked the transaction failed. Mongo can make this atomic inside a session; short of that, the debit is now compensated explicitly, and a failure to compensate is logged as the one state that needs finding afterwards. **Fixed by reading, not by a passing test** — it needs fault injection into Mongo to exercise.

**A slow profile read could cost a Creator their rate.** My Share seeded its field from `initialRate` once at mount, and that value arrives with the profile read — so opening Receive during a cold start showed 0% to a Creator on 6.25%, and Continue would write that 0 over the rate they had chosen. The field now follows a late-arriving rate, but only while untouched. The same shape existed behind the old preset grid; free-form rates made it worth fixing rather than noting.

### Results

**41/41 new checks pass. Full regression: 12 suites, 187 checks, all green** — including `gloobal.spec` against the real Render backend. Build clean. **Lint byte-identical to `main`** — 30 problems (4 errors, 26 warnings), verified by checking out `main` and re-running, not assumed.

### Carry-forward

- **The backend is not deployed.** Render still serves the old `server.js`: no `balance` field, no debit revert, no `newBalance`/`cashback` on send. Until it redeploys the live balance renders as `—` and payments will not move it. Netlify will pick up the frontend on its next build, so the two halves are briefly out of step.
- **Concurrent payments race.** Balance is read-modify-write with no locking, so two simultaneous sends from one account can lose an update. Needs `findOneAndUpdate` with `$inc`, or a session.
- The money panels re-fetch on every tab switch, so the spinner flashes when navigating to Profile. Correct-if-noisy rather than wrong.

---

## 2026-07-28 (Tue)

Seven founder items on one branch — `feat/2807-gh-score-creator-cashback-profile` — merged to `main` as `2f57b2f`. Largest single-day scope so far: three new features, three fixes, one collision found and fixed by the tests themselves.

> Written from the commit record and the tree, not a live session log.

### 1. GH Score — the Gloobal Human Score (`4065eca`)

A wellness + financial check-in score across four pillars: **Self, Community, Environment, Finance**. Broader than a credit score on purpose — it reads how someone is doing, not only what they owe.

Two answering rules, set **per pillar**, not per item:

- **Self / Community / Environment rotate.** The question behind an item changes daily; yesterday's answer does not carry over, so the check-in is answered fresh.
- **Finance locks.** Answered once, permanently — those are statements of fact about money habits, not a daily mood, and re-answering would only let the score be gamed.

Questions and math numbers come from a **deterministic hash of the item key and the day**, so refreshing the page can never reroll a check-in into an easier one. Answers persist under `gloobal.ghAnswers.<symbolId>`. *Generate Score* stays disabled until every pillar is complete.

### 2. Creators choose what they share back (`9f44670`)

"Share with Gloobal users" — a Creator picks for themselves what share of every payment goes back to whoever paid them, **0% to 7%**. Gloobal does not set this centrally; each business chooses its own rate and can change it any time.

The screen shows the chosen value large with a worked example in the person's own currency ("a user paying X gets back Y as an asset"), so the choice is legible before it is saved. *Save & Continue* writes the rate; *Skip for now* carries on at 0%, which simply plants no seed. Stored as a decimal (1% = `0.01`) so it multiplies against an amount directly.

### 3. Backend behind the above (`456ee5f`)

| Change | Detail |
|---|---|
| `User.cashbackRate` | 0–0.07, default 0; returned by `publicUserPayload` |
| `User.symbolIdHistory` | dated record of every previous Gloobal ID |
| `PATCH /api/creator/cashback-rate` | sets a Creator's own share, validated to the 0–7% band |
| `POST /api/transactions/send` | plants the My Assets seed at the **payee's** rate, read off their account |
| `PATCH /api/profile/change-symbol-id` | records the outgoing ID + timestamp before writing the new one |

**The seed rate is never client-supplied and never hardcoded.** A plain person-to-person send is just a payee who never set a rate — stays at 0, plants nothing.

### 4. My Assets — graph up top, data below (`a1a53f4`)

The screen had no portfolio-level chart at all; the only curve lived one level down inside a single asset's detail. So the shape of the thing you own was the last thing you could see rather than the first.

Adds a whole-portfolio growth curve directly under the total card, above the rate strip and per-seed rows — every planted seed's curve summed from today forward, each flattening as it reaches the amount actually paid. Same per-seed rule the detail chart already uses, so the two cannot disagree. **Chart logic untouched; this is placement plus the portfolio sum.**

### 5. Send — the flag follows the recipient (`b3e636b`)

A UK sender looking up an Indian account still saw a UK flag over them. A Gloobal ID carries its own country — the account behind it registered under one — so the flag has no business guessing.

Lookup now runs as soon as a complete ID is dialled; the recipient's country is read off the dial code of their registered number and the flag switches to it, with a "Recipient found ✓" chip naming the ID. **A helpful default, not a lock** — the country picker still overrides it. Clearing the ID puts the flag back on the sender's own country; an unknown ID moves it nowhere and says "No user found for this ID". Search reuses that answer rather than asking the backend the same question twice.

### 6. Profile header redesign + ID history + Creator receive flow (`e715ddc`)

Four items landing together because they all hang off the Profile tab and the Receive action.

- **Profile header** — country flag one side, profile photo the other, name between them with a thin connector running across. *The connector is the point*: this account is one node on a global network. The photo defaults to the **Gloobal logo**, not a random stranger's face; tapping opens a picker and the chosen image is held locally against that account's key, since there is no photo upload endpoint yet.
- **GH Score gets its own row on Profile** — it belongs to the person, not to an account balance, so it is deliberately *not* in Accounts.
- **Receive** now leads with the Creator's cashback-sharing choice, then opens the receive sheet from either *Save & Continue* or *Skip for now*.
- **Change Gloobal ID** gains a dated record of every previous ID (merged from local storage + the backend's `symbolIdHistory`) and a **mandatory device confirmation**. The confirmation runs strictly *before* the rename request — overlay paints, ceremony starts, `PATCH` only fires once the device says yes. Cancelling or failing leaves the ID exactly as it was. A device with no biometric enrolled falls back to the account PIN (new `verifyPin` wrapper over `POST /api/pin/verify`) rather than blocking the rename outright.

### 7. ID-scoped local data survives a rename (`526fc76`)

**Found by the cross-feature suite, not by hand.** Renaming a Gloobal ID silently wiped the account's GH Score answers and profile photo — both are filed under `gloobal.ghAnswers.<id>` and `gloobal.profilePhoto.<id>`, which is exactly the thing a rename changes. Same person, same device, blank check-ins and the logo back as their face. Both now migrate across, as the ID history already did. *A rename is the same person, not a new account.*

### Verification

| Suite | Checks | Scope |
|---|---|---|
| `fix-verification-2807.spec.mjs` | 22 | all seven items individually |
| `cross-feature-2807.spec.mjs` | 10 | two or more features driven in the same session |

The cross-feature suite is the new idea: the per-task suite proves each feature works *alone*; this one asserts that neither of two features **breaks, hides, strands, or discards** the other. Every surface opened and closed in one run with no leftover overlay; GH answers and the profile photo surviving a rename; the cashback screen's cross-link into My Assets and back; a saved rate reopening where it was left; the Send flag switching without touching the sender's own country; Send still resolving after a rename; the My Assets/PayLater round trip with the graph still above the rows; GH Score staying off the Accounts tab; and a cancelled confirmation leaving ID, history and local data alone.

**X2 and X3 caught the real collision** — item 7 above.

**Two stale suites repaired** (both already failing on `main` before this day's work):

- 2307's Fix 2 still expected the "Use Face ID / Fingerprint instead" link on the PIN screen. That link was removed on 2026-07-27; the commit updated two suites but not this one. Rewritten to assert the shipped flow.
- 2407's I3-E drove a Gloobal ID change with no confirmation step. Renaming is now gated, so the test completes the gate first — and checks nothing was sent before it did.

**One locator repair in `gloobal.spec`:** the dashboard Pay tile and the Send screen's button share an accessible name, so until the receiver resolves, `name + .last()` could latch onto the covered dashboard button and retry to timeout. Now matched by class.

### Carry-forward

- **No photo upload endpoint** — profile photos live in local storage only, so they do not follow the account to another device.
- Cashback save failure surfaces the error and stays put; the rate is what a payer's cashback is calculated from, so an unsaved one must never be reported as saved (`838d65b` corrects a comment that claimed otherwise).

---

## 2026-07-27 (Mon)

Three items on `feat/otp-block-biometric-separation-my-assets`, merged to `main` as `7103518`.

### 1. Registration OTP blocked at step one for existing numbers (`e8b6c61`)

`POST /api/otp/send` now returns **409** when a registration-purpose request comes in for a number that already has an account, instead of sending an OTP and only surfacing the clash three screens later at the referral step. The phone screen catches the 409, stops the registration flow there, and offers a **"Log in instead →"** link that jumps straight into the login card.

### 2. Biometrics moved off the login PIN screen (`6ad165f`)

The login PIN screen no longer carries any biometrics — no icons, no "Use Face ID / Fingerprint instead" link. Modelled on registration, the biometric offer is now **its own screen shown after a correct PIN**, and only when the account has no passkey yet (checked via `POST /api/passkey/status`). A returning user who already enrolled one goes straight to the dashboard. *Skip for now* proceeds; back returns to the PIN screen. **WebAuthn register/verify logic unchanged — only the entry point moved.**

### 3. My Assets — cashback that compounds toward the amount paid (`3d506a3`)

Cashback earned on a business/bill payment is "planted" and grows **1%/month, compounded**, toward the original amount paid.

**Backend** — `AssetSeed` model plus `GET /api/assets/:symbolId`, `POST /api/assets/plant-seed`, `GET /api/assets/paylater/:symbolId`. Current value, years accrued and years-to-target are **derived live from `plantedAt` on every read, never stored**, so a seed's worth is a pure function of time. Successful business payments (`cashbackRate > 0`) plant a seed; P2P sends never do. Best-effort — **a seed failure cannot fail a payment.**

**Frontend** — `MyAssetsScreen`: total card, spending→earnings→assets stepper, rate strip, per-seed list (4 shown, *View all* expands with an average-time card), per-asset SVG growth chart with Today/Target markers, all durations in years. Demo seeds plus a "Demo data" chip when no real seeds exist. Opened from the Accounts tab, cross-linked with PayLater both ways. **PayLater limit is now the live total of assets, not a hardcoded number.**

### Verification

`fix-verification-2707.spec.mjs` — 18 checks across all three items: R1-A..D (OTP block + log-in link), F2-A..D (biometric separation), MA-A..J (My Assets incl. growth chart + PayLater limit). All backend calls mocked at the Render origin only.

---

## 2026-07-24 (Fri)

One workstream: the referral share link was producing invalid URLs. Shipped end to end — committed, pushed, merged to `main`.

### The bug

A Gloobal ID is 12 Unicode symbols (`■ □ ● ○ + − × =`). The referral link was built by plain string concatenation:

```js
const link = `https://gloobal.id/r/${symbolId}`;   // DashboardScreen.jsx:933
```

Dropped raw into a URL path, those symbols either failed to linkify in WhatsApp/SMS at all, or were percent-encoded inconsistently by whichever app touched them. The specific killer: **a bare `+` in a URL decodes back to a space**, so even a link that *looked* valid resolved to the wrong Gloobal ID — or 404'd. Copy and share were both affected, since both read the same broken string.

There was also **no backend route to receive the link.** `GET /r/:symbolId` did not exist. Even a correctly encoded link had nothing to land on.

### What shipped

Branch `fix/referral-share-link-encoding` → merged to `main` as `ee7a8ed` (fix commit `5926f46`).

| # | Fix | File | Location |
|---|---|---|---|
| 1 | Link built with `encodeURIComponent`; share message split into readable + encoded halves | `DashboardScreen.jsx` | `:930–939`, `:1007–1012` |
| 2 | New `GET /r/:symbolId` — decode, look up, 302 to `?ref=`, 404 when unknown | `Backend/server.js` | `:794–842` |
| 3 | Copy + share buttons both emit the encoded URL | `DashboardScreen.jsx` | inherited from fix 1 |
| 4 | `?ref=` pre-fills the referral step, read-only, ✅ "Referral applied", clearable | `App.jsx`, `DialPads.jsx` | `App.jsx:72–91, 108–115, 195–198, 1483–1524`; `DialPads.jsx:13–16, 172` |

`encodeURIComponent`, **not** `encodeURI` — the latter leaves `+` and `=` untouched, and both are in the Gloobal symbol set. Result for `■■■■■■■■■■□+`:

```
https://gloobal.id/r/%E2%96%A0…%E2%96%A1%2B     ← the %2B is the whole point
```

**Decisions worth carrying forward:**

- **The `?ref=` value is validated, not trusted.** It arrives from a URL anyone can edit, so only an exact 12-character run of real Gloobal Symbols is accepted; anything truncated or mangled by a messaging app is ignored and the step behaves as if no link was used.
- **Re-encoded on the redirect.** The backend encodes the ID *again* for `?ref=` — an unencoded `+` in a query string is a space, i.e. the exact bug being fixed, one layer down.
- **The share message carries the ID twice on purpose** — raw symbols so a human can read and retype it, encoded inside the link because that is the only form that survives becoming tappable.
- **`readOnly` on `SymbolDialPad` is a new opt-in prop** (default `false`), passed only by the referral step. Secure ID and OTP pads are untouched.
- **Clearing the code clears the lock.** Without that, the sign-out reset would leave the dial pad read-only over an empty field with nothing to unlock it.

### Verification

New spec `Frontend/e2e/referral-link-fix.spec.mjs` (6 tests, 265 lines) covering: encoded share link, clipboard contents, raw-vs-encoded message halves, `?ref=` pre-fill, clear-and-override, and a mocked backend redirect walked all the way through to the referral step.

**Results: 6/6 pass. Regressions: 29/29 pass** (`founder-ui-fixes` + `fix-verification-2307`), **8/8 pass** (`gloobal.spec.mjs`, which drives the real Render backend). Build clean.

Headless Chromium has no Web Share API, so the tests install a recording stand-in for `navigator.share` rather than asserting on the clipboard fallback and calling it a share test.

**One test-side repair:** RL-B initially failed on a strict-mode violation — "Link copied" resolves to two nodes, because the toast renders once per stacked overlay (referral + share). Test now matches the first. **Not an app defect**, but the duplicated toast is real, cosmetic, and worth cleaning up separately.

**Lint baseline byte-identical to `main`** — verified by stashing the changes and re-running, not assumed: 29 problems (3 errors, 26 warnings) both ways.

### Repository state at end of day

Clean. `main` = `ee7a8ed`, pushed to `origin` (`gloobal-pay-gloobal/Gloobal`). The `karan-personal` remote was deliberately left alone.

### Carry-forward

- **`gloobal.id` does not resolve to the backend.** The encoding is correct and the route exists, but every generated link points at a domain that isn't wired up — the deep link stays dead until DNS points at `gloobal-pay.onrender.com`. This is now the only thing between the fix and a working referral funnel.
- Set `APP_BASE_URL` in Render env if the frontend ever moves off `gloobal.netlify.app` (that's the redirect default).
- The duplicated "Link copied" toast (one per overlay layer).

---

## 2026-07-23 (Thu)

Four founder-reported fixes on one branch, plus checking the repo's own documentation into version control. Merged to `main` as `d7f6752`.

> Reconstructed from the commit record and the current state of the tree, not from a live session log — so it reports what shipped and the reasoning captured in the commits, not everything considered along the way.

### 1. Country-code lock moved to the server

The lock previously existed only in the UI. An account is identified by its **full** stored number including the calling code, so `POST /api/otp/send` now refuses a number whose subscriber digits match an existing account under a different flag, and refuses an unknown number for any purpose except registration. The guard runs **before** the OTP is generated, so a mismatched country never receives a code at all. New `Backend/constants/dialCodes.js` (55 lines) backs it.

### 2. Biometrics split off the login PIN screen

Face ID and Fingerprint moved onto their own screen. Two competing ways to authenticate on one page read as *"which of these am I meant to use?"* — the PIN screen now carries a text link across, and the back button returns with the typed PIN intact. **Only the entry point moved; the WebAuthn logic is untouched.**

### 3. Info sheets made less English-dependent

The Gloobal Symbols sheet now labels each of the eight shapes with its universal name; the referral sheet gained a wordless flow line and one distinct icon per benefit (previously three identical gift boxes). Neither sheet now depends on reading English to be usable.

### 4. Referrals made real

A `Referral` edge is written at registration and read back by `GET /api/referrals/:symbolId`. **The response carries Gloobal IDs and join dates only** — never mobile numbers, emails, or internal ObjectIds, on the reasoning that a referrer is not entitled to their referrals' contact details. My Referral Network renders those rows with loading, empty, and retryable-error states, replacing generated sample data.

**The earnings figure was removed rather than kept.** There is no earnings ledger behind referrals, so the card now reports how many people you've referred instead of claiming money the system does not track.

### 5. Documentation checked in

`CLAUDE.md` and `SETUP.md` — repo layout, which endpoints are real, what has to be running before either half works. This closes the *documentation drift* logged on 07-21: that knowledge previously existed only in whoever had set the project up before. Also checked in the `.claude` skills and pxpipe proxy scripts. The report mailer stays untracked — it holds SMTP credentials.

### Verification

New `Frontend/e2e/fix-verification-2307.spec.mjs` (14 tests, 375 lines) — all passing.

**Two existing specs needed test-side repairs:** `founder-ui-fixes` check 4a measured biometric buttons on the login PIN screen, which no longer carries them; and `gloobal.spec.mjs` shares one page across serial tests, where a now-surviving signed-in session restored straight to the dashboard, so registration had to start from a cleared slate.

### Footprint

10 files, +864 / −181. Backend: `server.js` (+123), new `dialCodes.js`, new `models/Referral.js`. Frontend: `App.jsx` (+102), `DashboardScreen.jsx` (249 changed), `LoginAuthScreen.jsx` (88), `authApi.js` (+9).

---

## Standing item — security carry-forward is still open

Re-checked against the current tree today (2026-07-24). **All five urgent items from the 07-21 assessment remain unfixed**, and the app has had two feature days shipped on top of them since:

| # | Item | Status |
|---|---|---|
| 1 | `POST /api/otp/send` returns the OTP in its response body | **Open** — `server.js:182` |
| 2 | `DEFAULT_LOGIN_PIN` fallback accepts `1234` and bypasses lockout | **Open** — `server.js:351` |
| 3 | CORS open to every origin | **Open** — `server.js:20` |
| 4 | No server-side rate limiting | **Open** — `express-rate-limit` not in `Backend/package.json` |
| 5 | WebAuthn `rpID` derived from the `Origin` header | **Open** |

Still no authentication layer of any kind. This is recorded here so it stays visible rather than being re-derived each time — the 07-21 report's judgement stands: **the deployed app is exploitable today**, and feature work has been proceeding ahead of it.

---

## 2026-07-22 (Wed)

Not written up. Shipped `9b2f9b9` — login country lock, free Gloobal ID suggestions, last-login display (8 files, +892/−29, with `feature-verification.spec.mjs` at 352 lines). Gap in this log; reconstruct from the commit if it matters.

---

## 2026-07-21 (Tue)

Two workstreams: a full project assessment, and a founder-requested UI pass across six screens with real browser verification.

### 1. Project assessment report

Produced `GLOOBAL_PROJECT_REPORT.md` (~25 KB) from a direct read of the source — `Backend/server.js` (1545 lines), all 7 Mongoose models, all 44 files under `Frontend/src`, deploy configs, and the complete git history. Not written from documentation, which turned out to matter (see *Documentation drift* below).

Covers: frontend + backend architecture, mistakes made to date, rectifications already landed, a severity-ranked security review, and a gap analysis against industry-grade fintech.

**Headline finding — the deployed app is currently exploitable.** Three composed issues:

1. `POST /api/otp/send` returns the OTP in its own JSON response body (`server.js:128`).
2. There is no authentication layer at all — no JWT, session, cookie, or middleware. Every route accepts `symbolId` as a plain string and trusts it.
3. CORS is open to every origin (`server.js:18`).

Together these allow full account takeover of any phone number in three HTTP requests, with no special access. Also found: a `DEFAULT_LOGIN_PIN` fallback accepting `1234` for any PIN-less account that **bypasses the lockout entirely** (`server.js:297`), WebAuthn `rpID` derived from the attacker-controllable `Origin` header (`server.js:754`), unauthenticated user enumeration returning PII (`server.js:1189`), and no server-side rate limiting anywhere.

**Assessed and found NOT to be problems** (checked rather than assumed): NoSQL injection is genuinely handled — every input is `String(...)`-coerced before reaching a query. PIN/OTP storage is correct bcrypt throughout. The OTP lifecycle (hashed, expiring, attempt-capped, single-use) is well built.

**Corrected a false alarm.** `.env` does appear in git history (`afa223d`). I checked the actual blob: it contained only `PORT=5000` and a **localhost** MongoDB URI. **No live credential was ever leaked.** The real Atlas connection string is untracked and correctly gitignored. Severity is low, not critical — worth recording so nobody re-raises it as an emergency.

**Structural finding:** no money exists in the system. `LedgerEntry.balanceBefore/After` are hardcoded `0`; the dashboard balance is the string literal `"12,480.50"` (`DashboardScreen.jsx:899`); transactions are marked `success` unconditionally with no settlement.

**Positioning:** ~15–20% of the way to a shippable fintech product. Frontend ~75% of industry grade, backend ~20%, security ~5%, regulatory ~0%. The engineering gap is 6–12 months for a small team; the regulatory gap (RBI PPI licence — ₹15 crore net worth, or a PSP/sponsor-bank arrangement) is the larger wall and has long lead times.

**Documentation drift discovered.** `CLAUDE.md` states three things that are no longer true: that `GlobalId.jsx` is a ~5200-line mega-component (it has been componentized), that a `gloobal.session.v1` localStorage session exists (it does not — refresh logs you out), and that the OTP is `0000` (it is `123456`). `Backend/.env.example` also still says `PROTOTYPE_OTP=0000`, so a new developer following it gets a broken flow.

Added `GLOOBAL_PROJECT_REPORT.md` to `.gitignore` on request.

### 2. Founder UI fixes — 6 screens

Branch: `feat/founder-ui-fixes-6`.

| Fix | Screen | Change | Location |
|---|---|---|---|
| 1a | Landing | Logo wrapped in bordered card (`T.surface`, radius 16, 1px border, shadow) | `App.jsx:581–600` |
| 1b | Landing | Heading 22px → `clamp(26px, 8vw, 32px)` | `App.jsx:617` |
| 1c | Landing | *No change — already correct* | — |
| 2a/3b/5a | secureId, referral | "Gloobal ID" wordmark added, same scale as landing | `App.jsx:631–655` |
| 2b/3c | secureId, referral | Info icon moved from card corner to screen top-right | `App.jsx:657–686` |
| 2c | secureId | Dial watermark `housingSize * 0.74` → `* 0.40` (−46%) | `DialPads.jsx:190` |
| 2d/3d | secureId, referral | Submit button label → "IN" | `App.jsx:1215`, `:1236` |
| 3a/5b | referral, secureId | Back buttons **added** (neither existed) | `App.jsx:688–730` |
| 4a | deviceSetup | Biometric icons 56 → 88px, glyphs 26 → 44px | `LoginAuthScreen.jsx:44–46, 132–180` |
| 6a | loginAuth | "Gloobal ID" heading added above PIN card | `LoginAuthScreen.jsx:82–99` |

**Implementation notes worth carrying forward:**

- The codebase uses **inline styles with `T` design tokens**, *not* Tailwind classes, despite Tailwind being installed. Followed the existing idiom.
- There is **no `initial`/`welcome` stage** — the landing screen is `stage === "phone"`.
- **Fix 1c required no change.** The landing phone field and the ID-screen field already shared identical styling (`bg rgb(243,241,250)`, radius 16px, padding 13px, border 1px). Verified rather than assumed; changing it would have meant editing working code for no reason.
- **Fixes 3a and 5b needed buttons built, not transitions rewired** — neither screen had any back control. This surfaced an unspecified third case: a *login* user reaches `secureId` by flipping from the phone card and never passes through OTP, so sending them "back" to `otp` would strand them. Login now unwinds to `phone` and clears the login flag (`App.jsx:695–710`).
- **Fix 2d was already satisfied on the login screen** (it uses `CircularInButton`, which renders "IN"). The `"Submit"` button on that stage belonged to *registration*, so the change landed there.
- Both shared-component changes were **scoped via props/mode**, not applied globally: `SubmitButton`'s default label in `CodeEntry.jsx` is untouched (label passed at call sites); biometric sizing is gated on `mode === "setup"` so the login screen keeps its original 56px.

### 3. Verification

Built `e2e/founder-ui-fixes.spec.mjs` (15 tests, API mocked) and `e2e/verify-ui-fixes.mjs` (full walkthrough capturing 11 screenshots and measuring each fix in the live DOM).

**Results: 15/15 spec tests pass, 17/17 measured checks pass, build clean, zero uncaught page errors.**

**Mutation check (the check that makes the above meaningful):** ran the spec against stashed pre-fix source. **13 failed, 2 passed** — matching the prediction made before running. Every fix-specific assertion fails without its fix, so the tests are genuinely measuring the change rather than passing trivially. The 2 that passed on pre-fix code are exactly the two documented as already-correct (1c styling, and login-screen icon scoping) — which is the proof for those two claims.

**Three problems found *during* testing:**

1. **My mock broke the app.** All 15 tests initially failed with the page stuck on the `G` splash. The glob `**/api/**` also matched the app's own module URL `/src/services/api/authApi.js` under Vite, so Playwright served that module `{}` as JSON and the bundle died. Bisected with a 4-way probe (route on/off × reduced-motion on/off); fixed by scoping mocks to the backend origin. **This was never a UI bug** — but that could not be known before diagnosis.
2. **I had broken the existing e2e suite.** `gloobal.spec.mjs:80` clicked `name: "Submit"`; the label change to "IN" silently broke it. Fixed.
3. **A test passing for the wrong reason.** Check 3a failed once; the screenshot showed the check had fired mid-flip-animation. Root cause: `Symbol −` is a useless landmark because **both** the referral and creation stages render a `SymbolDialPad`. The spec version had been passing only because `toHaveCount(0)` auto-retries. Re-anchored both to the REFERRAL ID badge disappearing — strengthened even though it was already green.

### Repository state at end of day

**Nothing committed.** Branch `feat/founder-ui-fixes-6`, all changes in working tree:

```
M  .gitignore                                        (report ignored)
M  Frontend/.gitignore                               (verify-shots ignored)
M  Frontend/e2e/gloobal.spec.mjs                     (Submit → IN selector)
M  Frontend/src/App.jsx                              (fixes 1a,1b,2a,2b,2d,3a,3b,3c,3d,5a,5b)
M  Frontend/src/components/auth/LoginAuthScreen.jsx  (fixes 4a, 6a)
M  Frontend/src/components/common/DialPads.jsx       (fix 2c)
?? Frontend/e2e/founder-ui-fixes.spec.mjs            (new, 15 tests)
?? Frontend/e2e/verify-ui-fixes.mjs                  (new, screenshot walkthrough)
```

Lint is byte-identical to the `main` baseline (30 problems, 4 errors — all pre-existing; `npm run lint` uses `--max-warnings 0` so it always exits non-zero on this repo).

### Carry-forward / next actions

**Security — do before any further feature work (app is exploitable today):**
1. Remove `prototypeOtp` from the `/api/otp/send` response.
2. Delete the `DEFAULT_LOGIN_PIN` fallback branch.
3. Lock CORS to the Netlify origin.
4. Add `express-rate-limit` to OTP / login / PIN / transaction routes.
5. Replace WebAuthn's `Origin`-derived `rpID` with a hardcoded allowlist.

**Then:** real sessions + auth middleware and per-resource ownership checks; unique index on `(fromUserId, metadata.idempotencyKey)`; wrap transaction + ledger writes in a MongoDB session; `helmet`; start writing `AuditLog`.

**Housekeeping:** update `CLAUDE.md` and `.env.example` to match reality; delete the four 0-byte files under `Backend/src/`; collapse the three duplicated CSP copies into one source; decide whether to commit this branch.

**Open decisions for the founder:** commit/push this branch? Stop the background Vite dev server on :5199? Confirm fix 1c needs no change (it already matched).

---

## Earlier work (reconstructed from git history)

Commit subjects only — recorded for continuity, not as full daily reports.

### 2026-07-20
- Integrated GlobalId v2 UI and wired it to the real backend.

### 2026-07-18 (10 commits — heaviest day)
- Replaced Frontend with the founder's GlobalId PWA 1 reference package; wired it to the real backend.
- Fixed CSP `connect-src` blocking all backend calls — then had to fix the **second** copy (Netlify `_headers`) and the **third** copy (`vercel.json`). Root cause (three duplicated CSP sources) still unresolved.
- Fixed `PROTOTYPE_OTP` default to 6 digits to match the frontend dial pad.

### 2026-07-17
- Added cycling word animation to registration corner badges.

### 2026-07-16
- Fixed onboarding dead-end; shrank Secure ID dial; added watermark logo.
- Fixed Secure ID / Referral screen overflow; merged referral buttons; enlarged dial logo.

### 2026-07-14
- **Fixed a critical regression:** PIN/Device Verification bounce loop that had blocked *all* registration and login. A total-outage bug reached `main` — no tests and no PR review would have caught it.
- Round 2 founder polish: bigger dial/dashboard UI, warm-up ping, prominent referral.
- Fixed PIN screen copy showing registration wording during login.
- Fixed phone back-navigation and mobile-login country default.
- Founder feedback pass: OTP reliability, referral validation, dial/PIN/verification redesign, dashboard buttons, logo consistency.

### 2026-07-13
- Redesigned Global Coverage hero panel to match founder reference.
- Fixed transaction history display to match the real backend response shape.
- Added live Secure ID availability check during registration.
- Polished referral/login screens; added referral network view; fixed login reliability.

### 2026-07-11
- Fixed GlobalID logo placement; rebuilt Global Coverage hero panel.
- Polished dashboard actions and global coverage.

### 2026-07-10
- Updated country coverage and phone input UI; updated dashboard search and action layout.

### 2026-07-08
- Fixed referral button reliability and coverage nav; fixed mobile UI Tailwind styling.

### 2026-07-07
- Integrated hardened GlobalId PWA with backend; fixed live API base URL.

### 2026-07-06
- Added global bank and send money UI.

### 2026-07-04
- Added functional UPI dashboard actions; fixed live dashboard API base URL.

### 2026-07-03
- Adopted latest dashboard UI; polished dashboard mobile layout.

### June 2026
Roughly 70 commits across the month covering initial backend build (Express + Mongoose + MongoDB Atlas), the OTP/PIN/registration endpoints, WebAuthn passkey integration, the transaction and ledger models, and successive dashboard UI iterations. Not itemized here — see `git log --since=2026-06-01 --until=2026-07-01`.
