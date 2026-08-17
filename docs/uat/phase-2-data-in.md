# Phase 2 — Data in

The import pipeline is the product's foundation. A silent ingestion bug corrupts every
forecast downstream without ever showing an error.

## Preconditions

Phase 1 passed. Note that R2 keys are set locally, so **uploads write to the real bucket** —
decide before starting whether that is acceptable, or clear the keys to fall back to local
disk (`uploads/r2`, served via signed `/api/uploads/local-download` URLs).

## Test file

Build a POS export you control, containing deliberate edge cases:

- ~150 valid rows across 3 recent days
- a handful of `Declined` rows (must be skipped, not imported)
- one duplicate receipt id (must dedup)
- one malformed row — bad date, non-numeric total (must be rejected with a reason)

## Happy path

| ID | Check | Expected |
| --- | --- | --- |
| P2-01 | Upload a recognised POS export | Preset auto-detected, **0 credits spent** |
| P2-02 | Import summary | Imported / skipped / rejected / total reconcile to the file |
| P2-03 | Rejected rows | Listed with a row number and a specific reason |
| P2-04 | Date range shown | Matches the file's first and last dates |
| P2-05 | Transactions in the DB | Count increased by exactly the imported figure |
| P2-06 | Data freshness badge | Flips to "up to date" |

`P2-01` matters commercially: AI column mapping costs 10 credits. A recognised format must
never spend them. Check the credit balance before and after.

## Dedup & re-import

| ID | Check | Expected |
| --- | --- | --- |
| P2-07 | Upload the identical file again | No new transactions — count unchanged |
| P2-08 | What the user sees | "Already up to date", presented neutrally |
| P2-09 | Upload history row | Neutral "no new rows", not a red failure |
| P2-10 | Overlapping file (some new, some seen) | Only the new rows import |

Re-uploading last week's export is routine housekeeping. If it reads as a failure, users
will assume they broke something. The API still returns `409` here by design (a test
asserts it) — the softening is presentational.

## Column mapping

| ID | Check | Expected |
| --- | --- | --- |
| P2-11 | Unrecognised format | Mapping wizard opens with a preview |
| P2-12 | AI mapping | Costs exactly 10 credits, states so before spending |
| P2-13 | Saved mapping reused next time | No second charge |
| P2-14 | Map to a column absent from the file | Rejected with a clear message |
| P2-15 | Re-map an existing upload | Re-imports cleanly, no duplicates |

## Failure handling

| ID | Check | Expected |
| --- | --- | --- |
| P2-16 | Empty file | Refused with a reason |
| P2-17 | Wrong file type | Refused before parsing |
| P2-18 | File over the size limit | Refused with the limit named |
| P2-19 | All rows invalid | Refused, nothing partially imported |
| P2-20 | Upload with 0 imported | Not shown as a green success |

## Knock-on effects

Ingestion is meant to invalidate and rebuild dependent data. This is where silent bugs
live.

| ID | Check | Expected |
| --- | --- | --- |
| P2-21 | Forecasts from today forward | Deleted and regenerated after import |
| P2-22 | Past-day actuals | Attached to existing forecasts |
| P2-23 | Menu items | New POS items appear for review |
| P2-24 | Analytics | Reflect the new rows (allow for the 30s cache) |

Verify `P2-21` by checking the forecast's `generatedAt`, not by the number looking
different. An unchanged number can still be a stale document.

## Exit criteria

P2-01 → P2-24 pass, and the transaction count after a full run equals the original plus
exactly the imported figure — no drift.
</content>
