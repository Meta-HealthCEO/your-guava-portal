# Known issues register

Carried forward so each pass starts from what is already known. Findings from the first
audit pass (Aug 2026).

## Open

| ID | Sev | Area | Issue |
| --- | --- | --- | --- |
| KI-13 | S3 | AI | Ask Guava hangs on "Thinking…" forever when the request is refused. A manager invited without credit-spend permission gets a 403 from `/insights/chat/stream`, and the composer never resolves or shows a message. The billing page surfaces its errors correctly, so the pattern exists — the chat stream just does not use it. Found while re-testing Phase 8. |
| KI-03 | S2 | Model | Plan tier silently changes forecast output. `applyPlanEntitlements` forces locked factors off, so identical data yields different numbers by plan. Not surfaced to the user. |
| KI-05 | S3 | Uploads | Duplicate re-upload is recorded as `failed` with an `errorMessage`. The UI softens this to "no new rows" by regex-matching the message — brittle. Wants a structured reason code, which means revisiting the tested 409 contract. |
| KI-06 | S3 | Charts | Recharts still logs `width(-1)` container-measurement warnings even where charts now render. Underlying layout-timing issue unresolved. |
| KI-08 | S3 | Settings | Prediction, Integrations and Team are signpost sections. Now carry a summary line, but the IA question — inline fully, or drop from the nav — is unresolved. |
| KI-09 | S4 | Naming | `aiCredits` → `guavaCredits` rename incomplete. DB field is `org.aiCredits`; API says `guavaCredits`; plans carry both `includedAiCredits` (150) and `includedGuavaCredits` (400) with **different values**. Reading the wrong key gives a wrong number, not an error. |
| KI-10 | S4 | Ops | In-process state — API cache, multer dir, rate-limit store — prevents horizontal scaling. |

## Resolved in the first pass

| ID | Area | Was | Fix |
| --- | --- | --- | --- |
| KI-R1 | Model | Calibration averaged per-observation ratios, inflating low-volume items — Matcha (Hot) true ratio 0.787 reported as 1.035, pointing the correction the wrong way | Ratio of sums; item/factor layers residualised |
| KI-R2 | Model | Learning sample floors of 3 let payday swing demand −11.6% off three observations | Floors raised to 10 / 12 / 20 |
| KI-R3 | Model | Cafe settings did not invalidate forecasts — corrected coordinates served a stale, ~10% wrong forecast indefinitely | Location and trading-hours changes clear forecasts from today |
| KI-R4 | Charts | Revenue chart rendered nothing — animated clip rect stuck at `width="0"` over a fully-drawn path | Reveal animation disabled on all series |
| KI-R5 | Today | Variant suffixes stripped, so three different products rendered as identical cards with different numbers | Full names restored |
| KI-R6 | Today | 25 items shown with equal weight, including 24 unforecastable lines carrying <10% of volume | Confidence tiers; sub-2/day grouped as "occasional sellers" |
| KI-R7 | History | Headline accuracy was the period aggregate (97.8%) where daily errors cancel | Leads with typical day (88.1%) |
| KI-R8 | Auth | Login and signup advertised "94% Accuracy", contradicted by the product's own History page | Replaced with capability statements |
| KI-R9 | Mobile | Performance tab bar overflowed with no scroll container — "Combos" unreachable on a phone | Tab bars scroll |
| KI-R10 | Mobile | Today's KPI cards 2-across and item cards 3-across at 390px, truncating names | 1-across and 2-across below `sm` |
| KI-R11 | Analytics | Movers ranked low-volume noise — a 1 → 8 line as "+700%" | Filtered to lines averaging 2+/day, scaled to the window |
| KI-R12 | Analytics | Heatmap rendered a fixed 06:00–22:00 grid, a third permanently empty | Range derived from real trading hours |
| KI-R13 | Billing | Only the 500-credit pack was purchasable | All packs from the plan catalogue |
| KI-R14 | Menu Items | "Menu price" labelled both the current and proposed price, two lines apart | Proposal relabelled; rationale names the most recent POS price |
| KI-R15 | Integrations | Same unavailability banner repeated in all three cards | One page-level notice |
| KI-R16 (was KI-01) | Tests | Portal suite believed flaky under parallel execution; every green result used `--no-file-parallelism` | Not flakiness — a roster test called `toISOString()` on a local time, so between 00:00 and 02:00 SAST a Monday serialised as the previous Sunday. Fixed with a midday anchor and local formatting. Three consecutive full-parallelism runs green (227/227) |
| KI-R17 (was KI-02) | Auth | Signup impossible without `RESEND_API_KEY` — `VERIFICATION_EMAIL_FAILED`, stranded `pendingregistrations` row, no recovery. Team invites equally unreachable | Console transport outside production: the message is logged with its action link and reported as delivered. Token stays real, single-use, redeemed through the normal endpoint. Production still refuses; `EMAIL_DEV_CONSOLE=false` opts out |
| KI-R18 (was KI-04) | Config | Trading hours never validated against sales data — a day configured closed forecast zero despite months of sales on that weekday (cost 9pp when Sunday was mis-set) | Contradiction detection: a closed day carrying observed sales is flagged with a reason naming the transaction count and pointing at Settings |
| KI-R20 (was KI-11) | AI | Ask Guava answered relative dates with the wrong day — "what should I prepare tomorrow?" returned today's quantities under a "Tomorrow's" heading, because the context never said what today was | `currentDate` added; each forecast labelled with weekday and `relativeDay`. Weekday derived from the date key at midday UTC, since dates are stored at cafe-local midnight. Verified live: now returns Saturday 15 Aug, R4 126, Cappuccino 21 / Flat White 19 |
| KI-R21 (was KI-12) | Auth | `VerifyEmail` stripped the fragment it had just read inside the same effect, so a StrictMode remount reported "Verification failed" over a verification that returned 201 | Ref-guarded capture before paint plus a once-only request, matching `AcceptInvite`. Five tests render under StrictMode; four fail against the old implementation |
| KI-R22 | Billing | Buying credits left the toolbar showing the pre-purchase balance — 400 in the header against 900 on the page, the same number disagreeing with itself on one screen. The toolbar caches the balance for 30s and the purchase never invalidated it | Purchase publishes the new snapshot through the existing `publishGuavaCredits` channel that AI spend already used. Verified live: header moved 900 → 2 400 on purchase with no reload |
| KI-R19 (was KI-07) | A11y | `#555555` / `#666666` muted text on near-black assumed below AA, untested | Measured: `--color-muted` was 4.49:1, now `#8A8A8A`; added `--color-guava-red-text` for red-on-dark text. Remaining `#555555` uses are non-text (backgrounds, borders, and one status dot whose meaning is carried by its adjacent label) |

## Corrected findings

Filed, then found to be wrong. Kept so they are not re-filed.

| Claim | Reality |
| --- | --- |
| "Saturdays forecast zero" | Sundays. Forecast dates are stored at local midnight, so `getUTCDay()` reports the previous day. |
| "Tables overflow on mobile with no scroll container" | A grep for `overflow-x-auto` missed `overflow-auto`, which all of them use. |
| "No tests depend on the duplicate-upload behaviour" | A test asserted the behaviour rather than the message. The change was reverted. |
| "The learning correction degrades forecasts" | The comparison toggled plan tiers, which also change payday, events and load shedding. Held constant, learning slightly helps and reduces bias. |
| "The revenue chart is slow" | It never rendered — the path was drawn and clipped to zero width. |
| "An invite sent by a second owner can never be accepted" | Acceptance requires the inviter to be `org.ownerId`, and the UAT org had two owners, so every invite 404'd. But the product never creates a second owner in an existing org: `role: 'owner'` is only assigned at registration (which creates a *new* org) or by ownership transfer (which demotes the incumbent in the same transaction). One owner per org is a real invariant. The two-owner org was a hand-inserted UAT fixture. Re-tested from an org created through the real signup flow, the whole invite journey passes. |
</content>
