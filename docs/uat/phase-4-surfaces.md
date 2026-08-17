# Phase 4 — Insight surfaces

Where the model meets the user. The question throughout: could a cafe owner act on this
before their morning rush?

## Today (`/today`)

| ID | Check | Expected |
| --- | --- | --- |
| P4-01 | Header tiles | Revenue, day, top item, total items — all populated |
| P4-02 | Day selector | Seven days; switching re-renders the forecast |
| P4-03 | Item names | Full variant shown — "Iced Coffee (Vanilla)", not "Iced Coffee" |
| P4-04 | Confidence split | Reliable items as cards; sub-2/day grouped separately |
| P4-05 | Occasional sellers | Framed as "keep a few on hand", never a stock target |
| P4-06 | Zero-prediction items | Read as "rare", not "~0" |
| P4-07 | Weather panel | Live conditions, or a clear reason it is unavailable |
| P4-08 | Factor gauges | Match the factors on the forecast payload |

`P4-03` is a correctness issue, not cosmetics. Stripping the bracket rendered three
different products as three identical cards showing different numbers.

## Planning (`/planning`)

| ID | Check | Expected |
| --- | --- | --- |
| P4-09 | Weekly revenue | Equals the sum of the seven day cards |
| P4-10 | Peak day | Actually the highest of the seven |
| P4-11 | Accuracy tile | Daily-average basis |
| P4-12 | Trajectory chart | Actual and predicted series both drawn; today delineated |
| P4-13 | Day cards | Top items with suggested stock |
| P4-14 | Low-confidence items | Excluded from stock suggestions |
| P4-15 | Signal chips per day | Weather and load-shedding state stated honestly |

## Performance (`/performance`)

Five tabs. Each must render, and each must be reachable on a phone.

| ID | Check | Expected |
| --- | --- | --- |
| P4-16 | Revenue tab | Chart draws immediately with the full series |
| P4-17 | Items tab | Movers exclude low-volume noise; top-10 bars render |
| P4-18 | Heatmap tab | Only real trading hours; legend present |
| P4-19 | Customers tab | Averages and payment split with a legend |
| P4-20 | Combos tab | Pair counts, highest first |
| P4-21 | Period selector | 7d / 30d / 90d each refetch |
| P4-22 | Tab bar on mobile | Scrolls — all five reachable |

`P4-16` has bitten twice. Recharts reveals series through an animated clip rect; if the
animation stalls the path is fully drawn but clipped to zero width, so the chart looks
empty while the DOM says otherwise. **Check the DOM before reporting an empty chart.**

`P4-17`: a line going 1 → 8 is "+700%" and will crowd out real movement. Movers must be
volume-filtered.

## History (`/history`)

| ID | Check | Expected |
| --- | --- | --- |
| P4-23 | Headline accuracy | Typical day, with the aggregate demoted to detail |
| P4-24 | Live vs backtest | Clearly separated; backtests marked as estimates |
| P4-25 | Row detail | Predicted, actual, variance, accuracy per day |
| P4-26 | Factor chips | Match what was applied that day |
| P4-27 | Pagination | Works, no duplicated or dropped rows |
| P4-28 | Learning panel | Sample counts shown next to each correction |

`P4-28` is the transparency that makes the model trustworthy — a correction with its sample
count lets a user judge it. Keep it.

## Cross-checks

| ID | Check | Expected |
| --- | --- | --- |
| P4-29 | Today's forecast vs Planning's first card | Identical |
| P4-30 | Yesterday's actual vs Performance | Identical |
| P4-31 | Item name rendering across pages | Consistent everywhere |

Disagreement between two screens showing the same number is S1 — it destroys confidence
faster than being wrong in one place.

## Exit criteria

P4-01 → P4-31 pass. No surface presents a number it cannot substantiate.
</content>
