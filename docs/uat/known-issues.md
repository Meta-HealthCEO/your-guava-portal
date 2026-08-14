# Known issues register

Carried forward so each pass starts from what is already known. Findings from the first
audit pass (Aug 2026).

## Open

| ID | Sev | Area | Issue |
| --- | --- | --- | --- |
| KI-01 | S2 | Tests | Portal suite is flaky under parallel execution — 6 tests fail in parallel, pass single-threaded. Every green result so far used `--no-file-parallelism`. CI is unreliable until fixed. |
| KI-02 | S2 | Auth | Signup is impossible without `RESEND_API_KEY`. Returns `VERIFICATION_EMAIL_FAILED` and strands a `pendingregistrations` row with no recovery path. Dev needs auto-verify or a console-logged link. |
| KI-03 | S2 | Model | Plan tier silently changes forecast output. `applyPlanEntitlements` forces locked factors off, so identical data yields different numbers by plan. Not surfaced to the user. |
| KI-04 | S2 | Config | Trading hours are never validated against sales data. A day configured closed forecasts zero even with months of sales on that weekday. Cost 9pp of aggregate accuracy when Sunday was mis-set. |
| KI-05 | S3 | Uploads | Duplicate re-upload is recorded as `failed` with an `errorMessage`. The UI softens this to "no new rows" by regex-matching the message — brittle. Wants a structured reason code, which means revisiting the tested 409 contract. |
| KI-06 | S3 | Charts | Recharts still logs `width(-1)` container-measurement warnings even where charts now render. Underlying layout-timing issue unresolved. |
| KI-07 | S3 | A11y | `#555555` / `#666666` muted text on near-black is likely below AA. Untested. |
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

## Corrected findings

Filed, then found to be wrong. Kept so they are not re-filed.

| Claim | Reality |
| --- | --- |
| "Saturdays forecast zero" | Sundays. Forecast dates are stored at local midnight, so `getUTCDay()` reports the previous day. |
| "Tables overflow on mobile with no scroll container" | A grep for `overflow-x-auto` missed `overflow-auto`, which all of them use. |
| "No tests depend on the duplicate-upload behaviour" | A test asserted the behaviour rather than the message. The change was reverted. |
| "The learning correction degrades forecasts" | The comparison toggled plan tiers, which also change payday, events and load shedding. Held constant, learning slightly helps and reduces bias. |
| "The revenue chart is slow" | It never rendered — the path was drawn and clipped to zero width. |
</content>
