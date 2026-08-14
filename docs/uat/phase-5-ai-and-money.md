# Phase 5 — AI & money

Anything that spends a customer's credits or charges their card. Errors here are the
expensive kind.

## Preconditions

Phase 4 passed. Record the credit balance before starting; every check below is measured
against it.

## Credit metering

Costs: chat 3 · column mapping 10 · insight refresh 10 · menu AI review 1 · backfill 1/day.

| ID | Check | Expected |
| --- | --- | --- |
| P5-01 | Ask a question | Balance drops by exactly 3 |
| P5-02 | Cost shown before spending | Stated on the control |
| P5-03 | AI call fails mid-flight | Credits refunded, ledger entry marked refunded |
| P5-04 | Ledger entry per spend | Feature, amount, timestamp |
| P5-05 | Free actions | Smart checks and preset mapping cost nothing |
| P5-06 | Balance in the toolbar | Matches the Billing page |

`P5-03` is the one to force. Metering reserves before running and refunds on throw; a
regression silently bills for failures. Break the API key temporarily and confirm the
refund.

## Running out

| ID | Check | Expected |
| --- | --- | --- |
| P5-07 | Spend with insufficient balance | `402`, action refused |
| P5-08 | What the user sees | A route to buy more, not a raw error |
| P5-09 | Balance after a refused action | Unchanged |

## Ask Guava

| ID | Check | Expected |
| --- | --- | --- |
| P5-10 | Ask a prep question | Answer grounded in this cafe's real numbers |
| P5-11 | Figures quoted | Reconcile with Today and Performance |
| P5-12 | Context chips | Show what the answer was based on |
| P5-13 | Long answer | Not obscured by the composer |
| P5-14 | Chat saved | Reopens intact |
| P5-15 | No API key configured | Degrades to a stated fallback, no credit charged |

`P5-11` is the trust check. An answer quoting a revenue figure that disagrees with the
dashboard is worse than no answer.

## Billing

| ID | Check | Expected |
| --- | --- | --- |
| P5-16 | Plan card | Current plan marked; seats/locations/credits correct |
| P5-17 | Credit packs | **All** packs offered, priced for the current plan |
| P5-18 | Monthly/annual toggle | Prices change correctly |
| P5-19 | Usage meter | Matches the ledger |
| P5-20 | Reset date | States when included credits renew |
| P5-21 | Non-owner view | Cannot purchase |

`P5-17` was a real gap — the UI hard-coded the smallest pack, so better-value tiers were
unreachable. Check against `creditPackOptions` for the plan.

## Checkout

Cannot complete locally: OneGate has no route back to a local callback.

| ID | Check | Expected |
| --- | --- | --- |
| P5-22 | Start a purchase | Redirects to hosted checkout |
| P5-23 | Idempotency key | Reused across a retry of the same intent |
| P5-24 | Abandon checkout | No credits granted, no charge |
| P5-25 | Payment session record | Written with the right amount |

Settlement must be verified against a real callback in staging before release. Note it as
untested rather than implying it passed.

## Exit criteria

P5-01 → P5-25 pass, except P5-22 → P5-25 settlement, which is explicitly deferred to
staging. The credit balance at the end must equal the start minus exactly the metered
spend.
</content>
