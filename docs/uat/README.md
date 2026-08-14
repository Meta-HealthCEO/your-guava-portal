# Your Guava — UAT & Audit Guide

A phased walkthrough for testing the platform as a real cafe owner would use it, driven
either by a person or a browser-control agent.

## How this is meant to run

The phases are a sequence, not a menu. Each one assumes the previous passed.

| Phase | Scope | Fix as you go? |
| --- | --- | --- |
| [0 — Preflight](phase-0-preflight.md) | Environment, data state, known divergences | n/a |
| [1 — Access & identity](phase-1-access.md) | Signup, login, sessions, roles, tenancy | Yes |
| [2 — Data in](phase-2-data-in.md) | Upload, mapping, dedup, errors, freshness | Yes |
| [3 — The model](phase-3-model.md) | Forecast correctness, factors, learning, accuracy | Yes |
| [4 — Insight surfaces](phase-4-surfaces.md) | Today, Planning, Performance, History | Yes |
| [5 — AI & money](phase-5-ai-and-money.md) | Ask Guava, credits, 402, billing, checkout | Yes |
| [6 — Admin](phase-6-admin.md) | Team, Settings, Improvements, Integrations | Yes |
| [7 — Cross-cutting](phase-7-cross-cutting.md) | Responsive, empty/error states, a11y, perf | Yes |
| [8 — Final UAT wave](phase-8-final-uat.md) | Full regression, **no fixing** | **No** |
| [9 — UX & UI polish](phase-9-polish.md) | Craft pass, last | Yes |

Phases 1–7 are build-and-fix. Phase 8 is a clean run with no code changes, so the result
means something. Phase 9 is polish, deliberately last — polishing something still changing
wastes the effort.

[Known issues register](known-issues.md) carries everything already found, so it is not
re-discovered each pass.

## Running a phase

1. Confirm the previous phase's exit criteria still hold.
2. Work the checks in order. Each has an ID — cite it when reporting.
3. For anything that fails, record it in the known-issues register with a severity before
   fixing, so the trail survives the fix.
4. Re-run the phase's checks after fixing. A fix is not done until its check passes.
5. Record the exit criteria result.

## Severity

| | Meaning | Action |
| --- | --- | --- |
| `S1` | Wrong data, money, or access. Silent corruption counts. | Stop and fix |
| `S2` | A core journey is blocked or a number shown is misleading | Fix this phase |
| `S3` | Works, but confusing or ugly | Log; fix in Phase 9 |
| `S4` | Cosmetic | Log only |

A number that is *wrong but plausible* is S1, not S3. The product's value is that its
numbers can be trusted.

## Verification discipline

This matters more than any individual check, and it is written from mistakes made during
the first audit pass.

**Never report a finding from the screen alone.** Confirm it against the API or the
database before filing. Real examples from the first pass, all wrong on first look:

- "Saturdays forecast zero" — it was Sundays. Forecast dates are stored at local midnight,
  so `getUTCDay()` reports the previous day. Always check the local weekday.
- "Tables overflow on mobile with no scroll container" — a grep for `overflow-x-auto`
  missed `overflow-auto`, which every one of them uses. Nothing was broken.
- "No tests depend on this behaviour" — the grep looked for the error *string*. A test
  asserted the *behaviour*. The change was reverted.
- "The learning model degrades forecasts" — the experiment compared plan *tiers*, which
  also toggle payday, events and load shedding. Held to one plan, learning slightly helps.

**Rules that follow:**

- A control that does nothing may be a missed click. Re-try by coordinate, and check the
  DOM, before filing a bug.
- Charts render asynchronously. Confirm the series exists in the DOM before calling it
  empty.
- When an experiment produces a surprising result, check what else your variable changed.
- Quote the evidence — endpoint, document, or line — in the finding.

**Browser-agent specifics.** Element refs from a `find` call can resolve to an icon inside
a button rather than the button; if a click has no effect, fall back to coordinates. Tab
bars and sub-navigation frequently miss immediately after navigation — let the page settle
and re-click. Screenshots taken during a transition are not evidence of a broken state.

## Environment

| | |
| --- | --- |
| Portal | `http://localhost:5174` |
| API | `http://localhost:5055` |
| Mongo | `localhost:27018`, replica set `rs0` |
| Test login | `uat@local.test` / `UatLocal!2026` (owner) |

Full setup, including why these ports differ from the defaults, is in
[Phase 0](phase-0-preflight.md).
</content>
