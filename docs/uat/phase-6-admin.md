# Phase 6 — Admin

Team, settings, configuration and the feedback loop. Lower traffic than the daily surfaces,
but this is where a wrong setting quietly poisons the forecast.

## Team

| ID | Check | Expected |
| --- | --- | --- |
| P6-01 | Seats, managers, locations | Match reality |
| P6-02 | Invite a member | Created; **no temporary password in the response or UI** |
| P6-03 | Invited user signs in | Sees only their permitted cafes |
| P6-04 | Change a member's role | Takes effect on their next request |
| P6-05 | Remove a member | Loses access immediately |
| P6-06 | Owner row | Cannot be removed, and says why |
| P6-07 | Seat limit reached | Blocked with the limit named |
| P6-08 | Transfer ownership | Requires password confirmation |

`P6-02` is S1. A password in an API response is a credential leak even if the UI hides it —
check the raw response, not the screen.

## Settings

Six sections. Three are signposts to pages that live elsewhere; each should still tell you
something before you click through.

| ID | Check | Expected |
| --- | --- | --- |
| P6-09 | General — trading hours | Editable per day; saving persists |
| P6-10 | Trading hours vs sales data | Contradiction surfaced, not silently accepted |
| P6-11 | General — cafe details | Address and coordinates save |
| P6-12 | Save feedback | Confirmation the change took |
| P6-13 | Account — profile | Name, org, billing email editable |
| P6-14 | Account — password change | Works; old session ends |
| P6-15 | Prediction section | States how many factors are unlocked |
| P6-16 | Integrations section | States what is connected |
| P6-17 | Team section | States seats and locations used |
| P6-18 | Section deep links | `?section=` loads the right pane |

`P6-10` is the highest-value check on this page. Trading hours drive whether a day
forecasts at all, and nothing validates them against sales. A Sunday marked closed while
the cafe trades every Sunday forecasts zero — silently.

## Improvements

| ID | Check | Expected |
| --- | --- | --- |
| P6-19 | Log a ticket | Appears with a sequential number |
| P6-20 | Required fields | Enforced before submit |
| P6-21 | Status filters | Counts match the tickets |
| P6-22 | Change status | Owner only; persists |
| P6-23 | Delete | Owner only; confirmed first |
| P6-24 | Empty state | Explains what to do |

## Integrations

All three accounting providers are pre-MVP.

| ID | Check | Expected |
| --- | --- | --- |
| P6-25 | Provider cards | Marked unavailable, honestly |
| P6-26 | Unavailability notice | Stated once for the page, not repeated per card |
| P6-27 | Connect controls | Disabled, not merely failing on click |
| P6-28 | Sidebar badge | Matches the page's state |

Do not report "coming soon" as a bug — it is the intended state. Report it only if the UI
implies something is available when it is not.

## Exit criteria

P6-01 → P6-28 pass. Any credential exposure (P6-02) or access-control failure stops the
audit.
</content>
