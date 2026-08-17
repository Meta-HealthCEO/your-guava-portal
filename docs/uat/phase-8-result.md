# Phase 8 — final UAT run, result

**Certifies:** portal `b9df6c2`, backend `77e88cc`
**Run date:** 14 Aug 2026
**Environment:** localhost — API :5055, portal :5174, MongoDB replica set `rs0` on :27018
**Suites at run start:** backend 461/461 green; portal 227/227 green under full parallelism, three consecutive runs

Journeys were run through the interface as a person would, not through the API. Where a
journey needed data the fresh tenant did not have, it was run against the established UAT
tenant instead, and that is stated per row.

## Journeys

| ID | Journey | Result | Evidence |
| --- | --- | --- | --- |
| P8-01 | New owner signs up, verifies, lands on an empty dashboard | **Fail** | Registration 202, verification POST **201**, account created, empty state correct ("No data yet" + single upload CTA). But the confirmation screen showed "Verification failed". See F1 |
| P8-02 | Uploads their first POS export | Pass | 4 339 imported / 0 skipped / 0 rejected against a 4 339-row file; range 2026/06/05 → 2026/08/13; staged progress modal; "what this did" summary |
| P8-03 | Checks tomorrow's prep list | Pass | Sat 15 Aug: R4 126, 87 items, per-item quantities (Flat White 19, Cappuccino 21, …). Engine recovered the weekday rhythm embedded in the generated data |
| P8-04 | Reviews a price mismatch on Menu Items | Pass *(UAT tenant)* | 18 price differences; card shows sold count, POS average, POS range, menu price; rationale names the **most recent** POS price and warns average/range differ; Approve / Keep / Use POS price |
| P8-05 | Asks Guava what to prepare | **Fail** | Metering correct — 400 → 397, exactly 3 credits, shown in header and panel. Answer was for the **wrong day**. See F2 |
| P8-06 | Reviews last week on History | Pass *(UAT tenant)* | Leads with "86.5% typical day across 21 live days", discloses "95.9% on period totals" as secondary; backtests held separate; learning correction −1.9% with sample counts (20 item / 12 factor) |
| P8-07 | Invites a manager | Pass | Invite → pending, seat reserved (2/2) → accept page → account created → manager signed in, sees correct cafe, **"Team" absent from their nav** |
| P8-08 | Buys a credit pack | **Blocked** — known exclusion | `POST /account/ai-credits` → 400: "OneGate hosted checkout needs API_PUBLIC_URL to be a public URL…". Correct refusal on localhost; surfaced to the user as a red banner with the full message. Not a defect. **Verify in staging** |
| P8-09 | Corrects trading hours | Pass | Sunday closed → 08:00–14:00; Sunday forecast went from "No trading forecast" to R 888,45; weekly total moved R 23 235,20 → R 24 123,65, a difference of exactly R 888,45 |
| P8-10 | Logs an improvement ticket | Pass | Ticket #3 filed, appears immediately with type, status, priority, desired outcome, author; counters updated |
| P8-11 | Repeats P8-03 on a phone | Pass | 390 px: KPI cards 1-across, item cards 2-across, day tabs scroll. Measured `scrollWidth ≤ clientWidth` — no horizontal overflow. Figures identical to desktop |
| P8-12 | Re-uploads last week's file by mistake | Pass | "Already up to date — every row in this file was imported previously, so nothing changed. Your existing data is untouched." Green, calm, with a clear next step; no alarming row in history |

## Data integrity sweep

| ID | Check | Result | Evidence |
| --- | --- | --- | --- |
| P8-13 | Same figure across screens | Pass | R4 568 / R4 126 identical on Today, Planning (R 4 568,25 / R 4 126,15), mobile, and inside the AI answer. Credits 5978 identical in header, card, and `6000 − 22`. Usage-by-feature (12 + 10) sums to the 22 counter |
| P8-14 | Every accuracy claim reproducible | Pass | 12/12 stored actuals recomputed from raw transactions to the cent, counts exact. 12/12 daily accuracy figures reproduced from raw item quantities. `avgAccuracy` 89.6 = mean of the 14 forecasts in its 30-day window |
| P8-15 | Credit balance | Pass | Ledger committed this period = 22 = `aiCredits.used`; available 5978 = 6000 − 22; 2 refunded rows present; **0 leaked reservations** |
| P8-16 | Transaction count | Pass | API total 11 337 = DB count 11 337 = sum of completed uploads' imported rows |
| P8-17 | No cross-tenant leakage | Pass | Two real tenants. 5 endpoints × 3 injected params (`cafeId`, `cafe`, `orgId`) — none honoured; path-id access 404; control request 200. Middleware re-validates org, role and `tokenCafeId ∈ liveCafeIds` per request |

## Findings

### F1 — `VerifyEmail` loses its token on remount (S2)

`VerifyEmail` reads the token from the URL fragment, strips the fragment, then fires the
request — all inside one effect. React StrictMode invokes the effect twice on mount: run 1
consumes the token and strips the hash, run 2 finds no hash and sets the error state, and
run 1's success is discarded because its cleanup already set `active = false`.

Verified rather than assumed: exactly **one** POST was sent and it returned **201**; the
account exists; and the message shown is verbatim the `!token` branch, which can only fire
when the fragment is already gone.

`AcceptInvite` solves this with a `useRef` capture guard and has a StrictMode regression
test. `VerifyEmail` has neither. Confirmed live in the same session: the invite accept page
worked under identical conditions.

StrictMode double-invocation is development-only, so **production users are unaffected
today**. The risk is that any remount loses the token, and the codebase already treats this
pattern as a bug elsewhere.

### F2 — Ask Guava answers relative dates with the wrong day (S2)

Asked "What should I prepare more of tomorrow?" on Friday 14 Aug. The reply was headed
"Tomorrow's Prep Recommendation" but stated "based on the forecast for Friday, 14 August
2026" and returned **today's** quantities (Flat White 24, Cappuccino 18) rather than
tomorrow's (19 and 21).

Root cause: the chat context sends `upcomingForecasts` as a date-keyed array starting at
today and **never states what "today" is**. The model has no anchor, so it took the first
entry. This makes every relative-time question — tomorrow, this weekend, yesterday —
unreliable, on the single question the product is built around.

Filed on the product's own board as ticket #3.

## Result

**Not a clean pass.** Ten of twelve journeys passed, one is blocked by a documented
exclusion, and two failed. The integrity sweep is clean on all five checks.

Neither finding is S1, so the runbook's restart trigger was not met and the run was carried
to completion.

## Residual risk

- **F2 is the one that would embarrass us in front of a customer.** It is wrong advice on
  the core question, delivered confidently, and a cafe owner following it would prepare the
  wrong quantities. Cheap to fix — state the cafe-local date in the context.
- **F1 does not affect production today** but leaves signup one remount away from breaking,
  in a flow with no recovery path for the user.
- **Payment settlement remains unverified.** It needs a public callback URL; the refusal
  path is correct but nothing beyond it has been exercised. Verify in staging.
- **Email delivery remains unverified.** The flows that depend on it now work locally via
  the console transport, but provider hand-off — client rendering, deliverability, bounces —
  has not been tested. Verify in staging.
- **Accounting integrations** are pre-MVP by design and were not tested.
- The forecast engine was exercised against generated data with a known weekday rhythm, and
  recovered it. That validates the mechanism, not real-world accuracy.

---

# Phase 8 — re-run

**Certifies:** portal `5cd2b5b`, backend `46b723d`
**Run date:** 15 Aug 2026
**Suites:** backend 476/476, portal 232/232, typecheck clean

Triggered by the two fixes (KI-11, KI-12) plus the Paystack provider, which
invalidated the first run.

## Re-executed

| ID | Result | Note |
| --- | --- | --- |
| P8-01 | **Pass** (was fail) | Verification link now reports success; log confirms exactly one POST → 201, so the once-only guard holds under real StrictMode |
| P8-03 | Pass | Sunday 16 Aug: R888, 19 items, and the "occasional sellers — under 2 a day" grouping correctly engages on a low-volume day |
| P8-04 | Pass | 18 price differences; rationale still names the most recent POS price and warns average/range differ |
| P8-05 | **Pass** (was fail) | Returns Saturday 15 Aug / R4 126 / Cappuccino 21, matching Planning. Metering exact at 3 credits |
| P8-06 | Pass | 86.5% typical day vs 95.9% period totals, backtests separated, learning correction with sample counts |
| P8-08 | **Pass** (was blocked) | Credit purchase succeeds on the mock provider: 400 → 900 |
| P8-11 | Pass | 390 px: measured `scrollWidth 385 = clientWidth 385`, no horizontal overflow; figures identical to desktop |
| P8-12 | Pass | "Already up to date… your existing data is untouched"; history row reads "no new rows" rather than "failed" |
| P8-13 | Pass | Cross-screen figures agree, including on mobile and inside the AI answer |
| P8-14 | Pass | 8/8 accuracy figures reproduced from raw item quantities; revenue and counts exact |
| P8-15 | Pass | Ledger committed 22 = `aiCredits.used`; available 6478 = 6000 − 22 + 500 bonus; 0 leaked reservations |
| P8-16 | Pass | API 11 337 = DB 11 337 |
| P8-17 | Pass | 5 endpoints × 3 injected params, none honoured; path ids 404; control 200 |

## Carried forward, not re-executed

Stated plainly rather than counted as passes. These passed in the first run, and
the changes since — the AI chat context, the VerifyEmail effect, the payment
provider seam, and the toolbar credit refresh — cannot reach them.

- **P8-02** first upload of a POS export. The ingest path was still exercised: the
  same file was re-submitted and correctly detected as already imported.
- **P8-07** invite a manager
- **P8-09** correct trading hours
- **P8-10** log an improvement ticket

## Found during the re-run

**KI-R22 — the toolbar credit balance went stale after a purchase.** The billing
page showed 900 while the header still showed 400: the same figure disagreeing
with itself on one screen, which is exactly what P8-13 exists to catch. The
toolbar caches the balance for 30s and the purchase never invalidated it, even
though the `publishGuavaCredits` channel already existed and AI spend used it.
Fixed and verified live — header moved 900 → 2 400 with no reload.

## Result

Twelve journeys pass and the integrity sweep is clean on all five checks. One new
defect was found and fixed; four journeys were carried forward rather than
re-executed, listed above.

## Residual risk

Unchanged from the first run except that payment is now partly covered:

- **Card payments run on the mock provider locally.** Paystack is implemented and
  unit-tested but has not been exercised against the real API — that needs a
  `sk_test_` key. See [prod-todo.md](../prod-todo.md).
- **Email delivery** still unverified end to end; the flows work through the
  console transport but provider hand-off, rendering and deliverability do not.
- The forecast engine was validated against generated data whose weekday rhythm it
  recovered. That tests the mechanism, not real-world accuracy.
