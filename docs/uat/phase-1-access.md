# Phase 1 — Access & identity

Everything else is gated behind this. Tenancy bugs here are silent and severe.

## Preconditions

Phase 0 exit criteria hold. `transactionCapable: true` — several handlers in this phase run
inside `withTransaction` and fail outright on a standalone mongod.

## Signup

| ID | Check | Expected |
| --- | --- | --- |
| P1-01 | Submit signup with valid details | Account created, verification required |
| P1-02 | Submit with a password under 8 characters | Rejected with a message naming the rule |
| P1-03 | Submit with an email that already exists | Rejected, no duplicate user |
| P1-04 | Mismatched password confirmation | Blocked before submit |

**Known blocker.** With no `RESEND_API_KEY`, `P1-01` returns `VERIFICATION_EMAIL_FAILED`
and strands a `pendingregistrations` row with no way forward in the UI. To complete a
signup locally, mint a token against the stored hash:

```js
// token is sha256'd into pendingregistrations.tokenHash
const token = crypto.randomBytes(32).toString('base64url')
const hash  = crypto.createHash('sha256').update(token).digest('hex')
// set that hash on the row, then POST /api/auth/verify-email { token }
```

That this is necessary at all is KI-02 — nobody can onboard on a machine without mail.

## Login & session

| ID | Check | Expected |
| --- | --- | --- |
| P1-05 | Correct credentials | Lands on `/today` |
| P1-06 | Wrong password | "Invalid credentials", no session |
| P1-07 | Access token expiry (15m) | A request after expiry silently refreshes and succeeds |
| P1-08 | Several requests in flight when the token expires | One refresh, all retried — not a refresh per request |
| P1-09 | Refresh token revoked, then a request | Redirect to `/login` |
| P1-10 | Change password | Old session signed out |
| P1-11 | Sign out | Token cleared; `/today` redirects to `/login` |

`P1-08` is the one worth actually forcing. The portal serialises refreshes behind a single
flight with a queue; a regression here shows up as a burst of refresh calls and sporadic
401s, not as an obvious failure.

## Roles & tenancy

| ID | Check | Expected |
| --- | --- | --- |
| P1-12 | Manager signs in | No Team entry in the sidebar |
| P1-13 | Manager opens `/team` directly | Blocked, not merely hidden |
| P1-14 | Manager attempts an owner-only API call | `403` |
| P1-15 | Request another org's cafe by id | `404`, never another tenant's data |
| P1-16 | User with multiple cafes switches cafe | New token, data refetches for the new cafe |

`P1-13` and `P1-15` are the S1s in this phase. Hiding a control is not access control —
confirm the API refuses, not just that the link is absent.

## Billing gate

Auth middleware enforces billing on every request except `/api/account` and `/api/auth`.

| ID | Check | Expected |
| --- | --- | --- |
| P1-17 | Org with a lapsed period, any data request | `402` with `code: BILLING_REQUIRED` |
| P1-18 | Same org opens Account | Loads, so the user can pay |
| P1-19 | Portal response to a `402` | Routed to billing, not a raw error |

`P1-19` is worth checking properly — the portal's axios layer has no `402` branch, so
confirm what a user actually sees when a period lapses.

## Exit criteria

P1-05 → P1-19 pass. Any tenancy failure (P1-13, P1-14, P1-15) stops the audit until fixed.
</content>
