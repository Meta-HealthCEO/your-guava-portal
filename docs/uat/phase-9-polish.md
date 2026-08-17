# Phase 9 — UX & UI polish

Last, deliberately. Polishing a surface that is still changing wastes the work.

## Entry condition

Phase 8 passed. The product is functionally correct. Everything here is craft.

## The standard

The bar is not "looks fine". It is: does this feel like something a cafe owner would trust
with their ordering, and would it survive a screenshot in a competitor comparison?

## Language

Copy is the cheapest quality lever in the product and usually the weakest.

| ID | Check | Expected |
| --- | --- | --- |
| P9-01 | Every number has a unit or context | No bare figures |
| P9-02 | Error messages | Say what happened and what to do |
| P9-03 | Empty states | Say what to do next, not just that it is empty |
| P9-04 | Buttons | Name the action, and the result confirms it |
| P9-05 | Domain language | "Prep", "stock", "trading day" — not "records" |
| P9-06 | Same concept, same word | No synonym drift across screens |
| P9-07 | Claims match measurements | Nothing advertises what the product does not do |

`P9-06` catches real confusion. Two fields both labelled "menu price" — one the current
price, one the proposal — sat two lines apart and read as a data bug for weeks.

## Hierarchy

| ID | Check | Expected |
| --- | --- | --- |
| P9-08 | The most important thing per screen | Unmistakably the most prominent |
| P9-09 | Reliable vs unreliable numbers | Visibly different weight |
| P9-10 | Grids | No orphan card on its own row |
| P9-11 | Spacing rhythm | Consistent, related things grouped |
| P9-12 | Above the fold | The answer, not the preamble |

## Interaction

| ID | Check | Expected |
| --- | --- | --- |
| P9-13 | Hover, focus, active, disabled | All designed, all distinct |
| P9-14 | Every mutation | Confirms it happened |
| P9-15 | Destructive actions | Confirmed first, clearly labelled |
| P9-16 | Loading | Skeletons matching final layout, no reflow |
| P9-17 | Transitions | Purposeful; nothing longer than ~300ms |
| P9-18 | Charts | Render immediately — no reveal animation |

`P9-18` is a hard rule here, not taste. Recharts' animated clip has twice produced charts
that were fully drawn and invisible.

## Data presentation

| ID | Check | Expected |
| --- | --- | --- |
| P9-19 | Aligned digits | `tabular-nums` |
| P9-20 | Currency | Consistent ZAR formatting |
| P9-21 | Dates | One format throughout |
| P9-22 | Long names | Truncate with the full value available |
| P9-23 | Charts | Labelled axes, legend, readable at 390px |
| P9-24 | Colour | Semantic — same meaning everywhere |

## Final pass

| ID | Check | Expected |
| --- | --- | --- |
| P9-25 | Every screen at 390 / 768 / 1440 | Composed at all three |
| P9-26 | Screenshot each screen | Would you show it to a customer? |
| P9-27 | Score each out of 100 | Record it, with the reason for any gap |

## Exit criteria

Every screen at 95+, with the residual gaps written down and consciously accepted.
</content>
