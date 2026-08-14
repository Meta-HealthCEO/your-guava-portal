# Phase 3 — The model

The forecast is the product. A number that is wrong but plausible is the worst defect this
system can ship, because nobody catches it.

## Preconditions

Phase 2 passed. At least 8 weeks of history with fewer than 7 days of staleness.

## How the baseline works

Per item: pull the last 56 days of **matching weekday** transactions, bucket by week, take
a weighted average (weights `0.35 / 0.25 / 0.20`, remainder spread over older weeks), then
apply multiplicative factors, then the learning correction. Availability requires at least
3 observed matching trading days.

## Correctness

| ID | Check | Expected |
| --- | --- | --- |
| P3-01 | Forecast for a day with good history | `availability.status: ready` |
| P3-02 | Forecast for a day with under 3 matching days | `insufficient_data`, with the reason stated |
| P3-03 | A day configured closed | Predicts zero **and** the UI says why |
| P3-04 | Closed configuration vs actual sales | Flag the contradiction — see below |
| P3-05 | Item quantities | Non-negative integers |
| P3-06 | Predicted revenue | Reconciles to items × their prices |

`P3-04` caught a real defect: Sundays were configured closed while the cafe traded every
Sunday. The system forecast zero for 4 of 26 days and never flagged it, doubling aggregate
error from 13% to 22%. **The system does not validate configuration against data.** Check
it by hand, per weekday.

## Factors

| ID | Check | Expected |
| --- | --- | --- |
| P3-07 | Weather with coordinates set | Live temperature and condition, factor applied |
| P3-08 | Weather with coordinates cleared | Reports unavailable, does not silently assume |
| P3-09 | Change coordinates | Forecast regenerates — value moves |
| P3-10 | Plan gating | Locked factors are visible but not applied |
| P3-11 | Downgrade a plan | Forecast numbers change accordingly |

`P3-09` was a real bug: settings changes did not invalidate stored forecasts, so a user
could fix their coordinates and be served a stale, ~10% wrong forecast indefinitely. Verify
the value actually moves, not just that the setting saved.

`P3-11` deserves attention — plan tier silently changes forecast output. Users on different
plans get different numbers from identical data.

## Learning correction

Measured over 60 days of past forecasts with actuals, excluding backfills.

| ID | Check | Expected |
| --- | --- | --- |
| P3-12 | Below the sample floor | Reported as measured but **not applied** |
| P3-13 | Above the floor | Applied, and the History panel says by how much |
| P3-14 | Factor corrections | Only factors with enough samples appear |
| P3-15 | Item corrections | Only items with enough volume appear |

Sample floors are 10 (overall), 12 (factor), 20 (item). They were 3, which let payday swing
demand **−11.6% off three observations**.

## Accuracy claims

Every accuracy number on screen must be defensible.

| ID | Check | Expected |
| --- | --- | --- |
| P3-16 | History headline | The **typical day**, not the period aggregate |
| P3-17 | Planning accuracy | Mean of per-day item accuracy |
| P3-18 | Any marketing claim | Matches what the product measures |

Aggregate accuracy over a month lets a day forecast 20% high cancel a day 20% low, showing
~98% while typical days are far worse. Lead with the daily figure.

## Backtesting a model change

Never accept a model change on reasoning alone. Walk forward day by day: forecast day *D*
from data before *D* only, attach actuals, move on. Then:

- Hold **everything else constant.** Changing plan tier to toggle learning also toggles
  payday, events, load shedding and history weights — that confound produced a completely
  wrong conclusion on the first pass.
- Measure in the real pipeline, not a reimplementation. An offline copy of the baseline
  missed the null-vs-zero bucket handling and reported a 2pp *gain* for a change that was
  10pp *worse* in production.
- Report volume-weighted error separately from per-item error. They diverge sharply.

## Error expectations

Error concentrates by volume. Judge against the right benchmark:

| Volume | Typical error | Share of volume |
| --- | --- | --- |
| ≥20/day | ~25% | ~56% |
| 5–20/day | ~35% | ~16% |
| 2–5/day | ~61% | ~18% |
| <2/day | >100% | ~10% |

Lines under ~2/day are not forecastable — that is arithmetic, not a bug. They must never
carry a confident-looking stock number.

## Exit criteria

P3-01 → P3-18 pass. Any accuracy figure that cannot be reproduced from the underlying data
is S1.
</content>
