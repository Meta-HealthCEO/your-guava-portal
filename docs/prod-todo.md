# Production to-do

Things that cannot be closed on a developer machine, plus the open issues that
should be decided before launch. Kept separate from
[docs/uat/known-issues.md](uat/known-issues.md), which tracks defects — this file
tracks *environment and go-live* work.

Last reviewed: 15 Aug 2026.

## DEPLOY BLOCKER — proven, not suspected

The production API has not been redeployed in ~57 days. The reason is now
established empirically rather than guessed: running the real `validateEnv()`
against the real Railway production environment
(`railway run node -e "require('./src/config/validateEnv')()"`) fails with

```
 - TOKEN_ENCRYPTION_KEY is required in production and must be independent from JWT_SECRET
 - RESEND_API_KEY is required and cannot be a placeholder in production
 - RESEND_FROM_EMAIL is required and cannot be a placeholder in production
```

**Every deploy since the production hardening has failed to start.** Setting
these three makes validation pass — verified by re-running the same check with
them supplied, so this is the complete blocker set, not the first of several.

- [ ] `TOKEN_ENCRYPTION_KEY` — generate with
      `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
      Must differ from `JWT_SECRET`. It encrypts accounting-integration OAuth
      tokens, which are pre-MVP and unused, so there is nothing to migrate. Note
      that it currently falls back to a key derived from `JWT_SECRET`; if any
      integration tokens somehow do exist, they would stop decrypting.
- [ ] `RESEND_API_KEY`
- [ ] `RESEND_FROM_EMAIL`

### Signup is broken in production right now

A consequence of the same gap, and worth stating separately because it affects
the live site, not just the next deploy. `NODE_ENV=production` with no
`RESEND_API_KEY` means `sendEmail` returns `{skipped:true}`, and the register
handler answers **503 `VERIFICATION_EMAIL_FAILED`**, leaving a stranded
`pendingregistrations` row. Team invites fail the same way. Any customer who has
tried to sign up on the live site has hit this.

`/api/ready` still reports `status: "ready"` throughout, because readiness checks
the database and a two-key environment subset rather than the capabilities the
product actually needs. Worth widening once the above is set.

## Blocked on credentials

These are the two gaps that keep UAT from covering the whole product. Neither
blocks the rest of the work; both need a human with account access.

### 1. Paystack

Paystack is the card provider (`PAYMENT_PROVIDER=paystack`). OneGate remains in
the tree behind the provider seam but is dormant.

**For UAT** — in `your-guava-backend/.env`:

```
PAYMENT_PROVIDER=paystack
PAYSTACK_SECRET_KEY=sk_test_...
```

- [ ] Test secret key added (`sk_test_`, never `sk_live_` locally)
- [ ] Paystack account confirmed as the **South African entity with ZAR enabled** —
      the whole catalogue is priced in ZAR (plans R399 / R899 / R1 799, credit
      packs R69 / R199 / R599). A NGN-only account cannot take these charges.
- [ ] End-to-end run with a Paystack test card: plan upgrade **and** credit pack
- [ ] Confirm the credit grant and plan period land exactly once (the reference is
      recorded in `fulfilledPaymentReferences`, so a repeat must be a no-op)

No tunnel is needed for this. Paystack settles through an outbound verify call,
and `callback_url` is a browser redirect, so localhost resolves fine.

**For production:**

- [ ] `PAYSTACK_SECRET_KEY` switched to `sk_live_...` — `validateEnv` refuses a test
      key in production, deliberately: a test key would take real orders and settle none
- [ ] `API_PUBLIC_URL` set to the real HTTPS API origin
- [ ] Webhook registered in the Paystack dashboard at
      `POST {API_PUBLIC_URL}/api/account/payments/paystack/webhook`.
      Optional but wanted in production — it is the only path that settles a payment
      when the customer closes the tab before the redirect. Signature is verified
      with HMAC-SHA512 over the raw body.
- [ ] Settlement verified in staging against a real redirect

### 2. Transactional email (Resend)

Outside production an unconfigured mailer logs the message and its action link to
the server log, so signup and team invites are fully testable locally. What that
cannot cover is the provider hand-off.

In `your-guava-backend/.env`:

```
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL="Your Guava <hello@yourdomain>"
RESEND_REPLY_TO=            # optional
```

- [ ] API key added
- [ ] Sending domain **verified in Resend** (SPF and DKIM DNS records). An
      unverified domain fails silently — mail is accepted and never arrives.
- [ ] Verification, invite, password-reset and welcome emails each received in a
      real inbox
- [ ] Rendering checked in at least one desktop and one mobile client — the
      templates are table-based HTML with inline styles
- [ ] Deliverability sanity check (not landing in spam)
- [ ] `EMAIL_DEV_CONSOLE` left unset/true for local work; the console transport is
      hard-refused when `NODE_ENV=production` regardless

## Environment

- [ ] `NODE_ENV=production`
- [ ] `BILLING_MOCK_ENABLED=false` — mock checkout is refused in production, but set it explicitly
- [ ] `API_PUBLIC_URL` is HTTPS and public
- [ ] `CLIENT_URL` points at the deployed portal
- [ ] Portal build: `VITE_API_URL` must be HTTPS or the build fails by design
- [ ] R2 upload storage variables present
- [ ] `JWT_SECRET` rotated for production (the local value is in a gitignored `.env`,
      but it has been on a developer machine)
- [ ] `ANTHROPIC_API_KEY` is a production key with its own budget

## Known issues to decide before launch

Detail in [docs/uat/known-issues.md](uat/known-issues.md).

| ID | Sev | Decision needed |
| --- | --- | --- |
| KI-03 | S2 | Plan tier silently changes forecast output. Either surface it or stop gating factors that alter numbers. |
| KI-13 | S3 | Ask Guava hangs on "Thinking…" when the stream is refused (e.g. a manager without credit permission). Needs the error path the billing page already has. |
| KI-05 | S3 | Duplicate upload is stored as `failed` and softened in the UI by matching the message text. Wants a structured reason code. |
| KI-06 | S3 | Recharts still logs `width(-1)` container-measurement warnings. |
| KI-08 | S3 | Prediction / Integrations / Team settings sections are signposts — inline them or drop them from the nav. |
| KI-09 | S4 | `aiCredits` → `guavaCredits` rename incomplete, and the two carry **different values** (150 vs 400). Reading the wrong key gives a wrong number, not an error. Worth closing before it reaches billing copy. |
| KI-10 | S4 | In-process state (API cache, multer dir, rate-limit store) prevents horizontal scaling. Decide whether launch needs more than one instance. |

## Operational

- [ ] Confirm the pending-payment reconciliation job is running and its error count is zero
      (it currently logs `errors: 1` locally against a stale session from the dead OneGate tunnel)
- [ ] Backups configured for MongoDB
- [ ] Decide whether the `improvements` board is customer-visible at launch
- [ ] Accounting integrations are pre-MVP by design — confirm they stay hidden or keep the
      "SOON" treatment
