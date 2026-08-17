# Phase 7 — Cross-cutting

Concerns that span every screen. Run these across the whole app, not per page.

## Responsive

The viewport in some automation environments is pinned and `resize_window` will not change
it. When that happens, mount the app in an iframe — media queries respond to the iframe's
width — and screenshot that:

```js
const f = document.createElement('iframe')
f.src = '/today'
f.style.cssText = 'width:390px;height:780px'
document.body.appendChild(f)
```

| ID | Check | Expected |
| --- | --- | --- |
| P7-01 | Every route at 390px | No horizontal page scroll |
| P7-02 | Every route at 768px | Layout adapts, nothing clipped |
| P7-03 | Sidebar below `xl` | Hidden, reachable via the menu button |
| P7-04 | Tab bars and sub-nav | Scroll horizontally; every tab reachable |
| P7-05 | Tables | Scroll inside their own container |
| P7-06 | Item names at 390px | Not truncated past recognition |
| P7-07 | KPI cards at 390px | Stack rather than cramming |
| P7-08 | Charts at 390px | Render and stay readable |
| P7-09 | Touch targets | Comfortably tappable |

Sweep P7-01 across all routes programmatically rather than by eye:

```js
document.documentElement.scrollWidth > document.documentElement.clientWidth
```

`P7-04` caught a real bug — the Performance tab bar overflowed with no scroll container,
making "Combos" unreachable on a phone while the page itself showed no overflow.

## Empty & error states

Test each with a fresh org holding no data.

| ID | Check | Expected |
| --- | --- | --- |
| P7-10 | Every surface with no data | Explains what to do next |
| P7-11 | API down | Failure stated, retry offered |
| P7-12 | A single failing widget | Does not blank the page |
| P7-13 | Slow response | Skeletons, not a frozen screen |
| P7-14 | Error copy | Says what happened and how to fix it |

## Accessibility

| ID | Check | Expected |
| --- | --- | --- |
| P7-15 | Keyboard-only navigation | Every action reachable |
| P7-16 | Focus indicators | Visible on all interactive elements |
| P7-17 | Form labels | Present and associated |
| P7-18 | Contrast | Meets AA, including muted text |
| P7-19 | Icon-only buttons | Have accessible names |
| P7-20 | `prefers-reduced-motion` | Honoured |

`P7-18` needs real attention — the palette uses `#555555` and `#666666` on near-black,
which is likely below AA.

## Performance & console

| ID | Check | Expected |
| --- | --- | --- |
| P7-21 | Console on every route | No errors, no warnings |
| P7-22 | Time to first meaningful paint | Under ~2s locally |
| P7-23 | Duplicate requests | None on mount |
| P7-24 | Cached responses | 30s cache respected; `?refresh=true` bypasses |

`P7-21` is not cosmetic. A stalled Recharts container logs a `width(-1)` warning — that
warning was the only evidence of a chart that rendered nothing.

## Exit criteria

P7-01 → P7-24 pass. Any route with horizontal overflow at 390px, or an unreachable control
on mobile, is S2.
</content>
