# Phase 8 — Final UAT wave

A clean run with **no code changes**. The point is a result that means something.

## The rule

Nothing is fixed during this phase. Not a typo, not a one-line CSS change. Every fix
invalidates the checks that already passed, and a run that was amended halfway through
proves nothing about what you are shipping.

Findings are logged with a severity and carried to Phase 9 or to a follow-up. If an S1
appears, stop the run, fix it, and **start Phase 8 again from the beginning**.

## Before starting

- Working tree committed. Record the commit — the run certifies that commit, nothing else.
- Both suites green: `npx jest` and `npx vitest run --no-file-parallelism`.
- Database in a known state.
- Phases 0–7 exit criteria all recorded as passed.

## Journeys

Run these as a person would, start to finish, without shortcuts through the API.

| ID | Journey | Passes when |
| --- | --- | --- |
| P8-01 | New owner signs up, verifies, lands on an empty dashboard | Empty state explains what to do |
| P8-02 | Uploads their first POS export | Data imports; forecasts appear |
| P8-03 | Checks tomorrow's prep list | Knows what to prepare and how much |
| P8-04 | Reviews a price mismatch on Menu Items | Understands the recommendation and acts |
| P8-05 | Asks Guava what to prepare | Useful answer; 3 credits |
| P8-06 | Reviews last week on History | Understands how accurate the forecast was |
| P8-07 | Invites a manager | Manager signs in with the right access |
| P8-08 | Buys a credit pack | Reaches hosted checkout |
| P8-09 | Corrects trading hours | Forecasts regenerate accordingly |
| P8-10 | Logs an improvement ticket | Appears on the board |
| P8-11 | Repeats P8-03 on a phone | Fully usable at 390px |
| P8-12 | Re-uploads last week's file by mistake | Reassured, not alarmed |

`P8-03` and `P8-11` are the product. If a cafe owner cannot answer "what do I prepare
tomorrow" on their phone in under a minute, the run fails regardless of the other results.

## Data integrity sweep

| ID | Check | Expected |
| --- | --- | --- |
| P8-13 | Same figure across screens | Identical everywhere |
| P8-14 | Every accuracy claim | Reproducible from the raw data |
| P8-15 | Credit balance | Start minus metered spend, exactly |
| P8-16 | Transaction count | No drift from imports |
| P8-17 | No cross-tenant leakage | Verified at the API |

## Recording the result

For each journey: pass / fail, the evidence, and any finding IDs raised. Then a single
statement — is this shippable, and what is the residual risk.

Report what happened, including what was skipped and why. A run with three known gaps
honestly stated is more useful than a clean sheet that quietly omits them.

## Known exclusions

State these explicitly rather than letting them read as passes:

- Payment settlement — requires a public callback; **verify in staging**
- Email *delivery* — still requires `RESEND_API_KEY`. The flows that depend on email
  (signup verification, team invites) are now testable locally: outside production an
  unconfigured mailer logs the message with its action link, and the token is real and
  single-use. What remains unverified is the provider hand-off — rendering in a real
  client, deliverability, bounces. **Verify in staging.**
- Accounting integrations — pre-MVP by design

## Exit criteria

All twelve journeys pass, the integrity sweep is clean, and the residual-risk statement is
written down.
</content>
