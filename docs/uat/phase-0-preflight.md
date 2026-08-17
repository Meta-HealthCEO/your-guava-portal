# Phase 0 — Preflight

Get to a known-good state. Everything downstream produces false failures if this phase is
skipped.

## Start the stack

Guava's default ports collide with other local projects, so both services are started on
explicit ports rather than their defaults.

```bash
# Mongo — must be a replica set. auth, team and account controllers use
# withTransaction, which throws on a standalone mongod.
docker start your-guava-mongo
docker exec your-guava-mongo mongosh --port 27018 --quiet \
  --eval "db.hello().isWritablePrimary"        # expect: true

# API
cd your-guava-backend
PORT=5055 CLIENT_URL=http://localhost:5174 API_PUBLIC_URL=http://localhost:5055 npm run dev

# Portal (reads VITE_API_URL from .env.local)
cd your-guava-portal
npm run dev -- --port 5174 --strictPort
```

## Checks

| ID | Check | Expected |
| --- | --- | --- |
| P0-01 | `GET /api/health` | `status: ok` |
| P0-02 | `GET /api/ready` | `status: ready`, `database.transactionCapable: true`, `topology: replica_set` |
| P0-03 | Portal loads at `:5174` | Login screen, no console errors |
| P0-04 | Portal points at the right API | `VITE_API_URL` resolves to `:5055`, **not** `:5000` |
| P0-05 | Backend suite | `npx jest` → all green |
| P0-06 | Portal suite | `npx vitest run --no-file-parallelism` → all green |

`P0-02` failing with `transactionCapable: false` is the single most common cause of
mysterious 500s in Phase 1. Fix it before continuing.

`P0-06` **must** use `--no-file-parallelism`. Under parallel execution six tests fail
intermittently and pass in isolation. That flakiness is itself a known issue (KI-01) — it
is not a signal about the code you are testing.

## Data state

The forecaster needs recent history. It reads a 56-day window of matching weekdays and
requires at least 3 observed trading days.

| ID | Check | Expected |
| --- | --- | --- |
| P0-07 | `GET /api/transactions/status` | `daysSinceLatest` < 7 |
| P0-08 | `GET /api/forecasts/today` | `availability.status: ready` |
| P0-09 | Cafe has coordinates | Settings → General shows latitude and longitude |
| P0-10 | Trading hours match reality | No day marked closed that has sales in the data |

If `P0-07` fails, the data is stale and every forecasting surface will show empty states.
Shift the dataset forward by a **multiple of 7 days** so weekday alignment is preserved —
`dayOfWeek` is stored on each transaction and the model matches on it. An 80-day shift
moves Saturdays to Tuesdays and corrupts the weekly pattern; 77 does not.

`P0-10` is a real trap. Trading hours are configuration and the system does not check them
against the sales data. A day configured closed forecasts **zero** regardless of history.

## Known localhost divergences

Record these once so they are not re-filed as bugs each phase.

| Area | On localhost | Consequence |
| --- | --- | --- |
| Email | No `RESEND_API_KEY` | Signup verification, invites and password reset never arrive |
| Payments | OneGate cannot reach a local callback | Checkout starts, never settles |
| Storage | R2 keys set → real bucket | UAT uploads land in production storage |
| Rate limits | Active (only skipped under `NODE_ENV=test`) | Rapid repeated calls will 429 |
| API cache | 30s in-process, keyed per user | Append `?refresh=true` when verifying a fix |

## Exit criteria

All of P0-01 → P0-10 pass, and the divergence table above has been reviewed by whoever is
running the phase.
</content>
</invoke>
