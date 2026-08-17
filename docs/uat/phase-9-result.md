# Phase 9 — UX & UI polish, result

**Certifies:** portal `78c1893`, backend `46b723d`
**Run date:** 15 Aug 2026
**Suites:** portal 232/232, backend 476/476, typecheck clean

## Codebase-wide audits

Cheaper and more reliable than inspecting screen by screen, so these ran first.

| ID | Check | Result |
| --- | --- | --- |
| P9-18 | Chart reveal animation | **Clean.** All five series (Area, Bar, 2× Line, Pie) carry `isAnimationActive={false}`. This is the hard rule — the animated clip has produced invisible charts twice |
| P9-17 | Transitions ≤ ~300ms | **2 fixed.** Connect progress bar 500ms, Dashboard factor ring 700ms, both now 300ms |
| P9-13 | Focus states | **Clean.** `focus-visible` ring on the shared button and input primitives (40 rules). The one `outline-none` without a partner is `badge`, a non-interactive `<div>` that carries its own focus ring |
| P9-20 | Currency | **Consistent.** `formatRand` throughout |
| P9-21 | Dates | **Acceptable.** Seven format shapes, but each is context-appropriate (compact day+month for tabs, +year for records, weekday for headers). Not synonym drift |
| P9-19 | Aligned digits | 17 `tabular-nums` usages covering the numeric tables |

## Responsive sweep (P9-25)

Every route measured programmatically for horizontal overflow — `scrollWidth` vs
`clientWidth` — rather than eyeballed.

| Width | App routes (12) | Auth pages |
| --- | --- | --- |
| 1440 | ok | ok |
| 768 | **12/12 ok** | **was +125px → fixed** |
| 390 | **12/12 ok** | **was +149px → fixed** |

Routes covered: today, planning, factors, performance, history, ask-guava,
data-health, menu-items, integrations, team, improvements, settings.

## Fixed in this phase

**Login and signup scrolled sideways below ~900px.** The decorative background
glows are 800px and 500px wide in a root with no overflow clipping: 534px of
content in a 385px viewport. The first screen every user sees. Clipping the root
removes it without touching the design, since the glows are blurred backgrounds.

**History led with a housekeeping prompt.** The amber backfill banner sat above
the accuracy figures, so the page opened with an optional admin action rather
than the number it exists to report. Moved below the metric row; it still leads
when there is no history to show instead.

**Two decorative transitions** over the 300ms standard, brought into line.

## Scores

Scored against the standard in the phase guide: would this survive a screenshot
in a competitor comparison, and would a cafe owner trust it with their ordering.

| Screen | Score | Residual gap |
| --- | --- | --- |
| Today | 96 | Factor badges read "Growth"/"Pro" — that is the plan needed to unlock, but it looks like a value until you learn the convention (see KI-03) |
| Planning | 96 | Stock suggestion labels wrap awkwardly inside the narrow per-item rows |
| History | 96 | Dense table earns its density; weather column shows "Weather service is not configured" repeatedly for older rows |
| Performance | 95 | "TOTAL REVENUE" label wraps to two lines while the neighbouring card's fits on one, so the KPI row is slightly uneven |
| Data Health | 97 | Staged upload modal and the "what this did" summary are the strongest pieces of UX in the product |
| Menu Items | 95 | Long cards; the free-vs-paid distinction ("smart check" vs "AI review") is clear but repeated on every row |
| Ask Guava | 93 | **KI-13** — the composer hangs on "Thinking…" when the stream is refused. Costs it the most of any screen |
| Team | 96 | — |
| Improvements | 96 | — |
| Settings | 94 | **KI-08** — Prediction, Integrations and Team are still signposts rather than real sections |
| Login / Signup | 96 | Overflow fixed; capability strip reads well at all three widths |
| Verify / Accept invite / Reset | 96 | Single-purpose, correct states, clear next action |

**Every screen is at or above 93; nine of twelve at 95+.**

## Exit criteria

Not fully met, honestly stated. The guide asks for every screen at 95+.

Two screens sit below that, and both for a reason already tracked rather than a
cosmetic one:

- **Ask Guava (93)** — blocked on KI-13, a real interaction defect. Polishing
  around a hang would be papering over it.
- **Settings (94)** — blocked on KI-08, an information-architecture decision
  (inline the signpost sections or drop them from the nav) that is a product
  call, not a styling one.

Both are recorded in [prod-todo.md](../prod-todo.md) as decisions to take before
launch. Everything that was craft rather than a pending decision has been fixed.

## Not covered

- Cross-browser: checked in Chrome only. Firefox and Safari unverified.
- Reduced-motion preference not exercised.
- The 1440 pass was visual rather than measured for every screen; 768 and 390
  were measured for all twelve.
