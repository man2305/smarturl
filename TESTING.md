# Testing — SmartURL

This repo went from zero tests to a backend suite with real coverage plus a
focused frontend suite. This document records what exists, how it runs, what
the numbers actually are, and what is deliberately not covered.

## Commands

```bash
# Backend (from backend/)
npm test              # full suite (Vitest, run mode)
npm run test:watch    # watch mode
npm run test:coverage # suite + coverage report (coverage/)
npm run typecheck     # tsc on src
npm run typecheck:tests  # tsc on tests + test helpers

# Frontend (from frontend/)
npm test              # full suite (Vitest + jsdom)
npm run test:watch    # watch mode
npm run test:coverage # suite + coverage report (coverage/)
npm run typecheck     # tsc --noEmit (includes test files)
```

CI (`.github/workflows/ci.yml`) runs backend typecheck, `typecheck:tests`,
tests, and build; frontend typecheck, tests, and build; plus the Docker
build. There is no lint step: the repo has no ESLint config.

## Backend tests — 121 tests, 17 files

Tooling (devDependencies): Vitest 3, Supertest, `mongodb-memory-server`
(real MongoDB behavior, binary downloaded once and cached), `ioredis-mock`
(a Redis mock — no real Redis in tests), `@vitest/coverage-v8`.

### Architecture

- `tests/globalSetup.ts` starts **one** in-memory `mongod` for the whole
  run and passes its URI to workers via a temp file. One server per test
  file crashed under parallel startup, so files share the server and each
  use their own database (`tests/helpers/db.ts`: `startTestDb(name)`).
- `tests/setup.ts` runs before every file's imports and pins the
  environment: `NODE_ENV=test`, all rate-limit caps raised to 100000
  (limits stay active, just with headroom), distinct fake JWT secrets,
  `BASE_URL`/`CLIENT_URL` pinned (Vitest/Vite sets `BASE_URL='/'` in its
  own environment, which must never leak into the app).
- `vitest.config.ts` uses `maxWorkers: 2`: single-fork mode caused
  Mongoose `OverwriteModelError` because `node_modules` are shared across
  isolates while models re-compile per file.
- `tests/helpers/redis-mock.ts` provides a singleton `ioredis-mock`
  client; redirect/cache tests swap the real Redis module for it with
  `vi.mock('../src/config/redis', ...)`.
- `tests/helpers/wait.ts` has `waitFor()` for fire-and-forget assertions
  (analytics writes happen after the redirect response).
- Supertest does not follow redirects; redirect tests assert on the
  `Location` header and status.

### What's covered

| Area | File(s) | Notes |
|---|---|---|
| Auth: register/login/refresh/logout | `auth.test.ts` (20) | Concurrent duplicate register, concurrent refresh (exactly one wins), reuse-after-grace revokes the family, type-confusion, expired tokens, case-insensitive email |
| URL CRUD + alias races | `urls.test.ts`, `retry.test.ts` | Random-code retry on collision, alias 409, rename race, null-field handling, cache invalidation order |
| Redirect + cache | `redirect.test.ts` | Stampede coalescing (20 concurrent → 1 DB lookup), negative cache, limiter headers, Redis-failure fallback, malformed-slug rejection |
| Expiry sweeper | `sweeper.test.ts`, `sweeper-timer.test.ts` | The null-`expiresAt` regression (permanent links must survive) + scheduling (immediate + hourly, survives failures) |
| Click budgets + analytics | `analytics.test.ts` | 10-way concurrent cap-3 → exactly 3 served; unique-visitor dedup + Redis-failure fallback; partial-failure orderings; days-window behavior |
| Search + pagination | `search-pagination.test.ts` | Regex escaping, ownership isolation, stable paging through ties, status-filter semantics |
| HTTP hardening | `http-hardening.test.ts` | Malformed JSON 400, oversize payload 413, Mongo operator neutralisation, CORS preflight, helmet headers, validation envelope, no stack leaks |
| Env validation | `env-validation.test.ts` | Module re-import with manipulated `process.env`: bad `NODE_ENV`, NaN caps, bad expiry strings, trailing-slash stripping, production secret length |
| Redis reconnect | `redis-reconnect.test.ts` | Mocked `ioredis`: backoff strategy never gives up, error → disabled, ready → re-enabled, errors logged |
| Error handler | `error-handler.test.ts` | `headersSent` delegation, 413 mapping |
| Units | `base62.test.ts`, `geo.test.ts`, `device.test.ts`, `ip.test.ts` | Rejection sampling, country/device normalization, IP validation |

### Coverage (measured 2026-11-18, `npm run test:coverage`)

```
All files  94.49% statements / 83.36% branches / 94.33% functions / 94.49% lines
```

Remaining gaps, honestly stated:

- `config/database.ts` (0%): `connectDatabase`/`disconnectDatabase` wiring.
  Tests connect through their own helper instead. The connection itself is
  exercised by every integration test; the wrapper is not.
- `config/redis.ts` (86.5%): `disconnectRedis` is untested (only called
  from the shutdown path).
- `repositories/types.ts`, `types/express.d.ts` (0%): type-only files;
  V8 counts them as uncovered lines.
- `middlewares/errorHandler.ts` (76%): some branches (CastError paths,
  JWT error variants) are only reachable through narrow inputs.
- `services/redirect.service.ts` (85%): the claim-failure retry path
  (cap raised mid-flight) is hard to hit deterministically.
- `server.ts` is not imported by any test: the bootstrap, signal
  handlers, and global rejection handlers are verified by build + code
  review only (see "Not executed" below).

## Frontend tests — 43 tests, 8 files

Tooling (devDependencies): Vitest 3, jsdom, React Testing Library,
`@testing-library/jest-dom`, `axios-mock-adapter`, `@vitest/coverage-v8`.

### What's covered

| Area | File | Notes |
|---|---|---|
| API client | `api/client.test.ts` (8) | Bearer attach, 401 → single-flight refresh + retry, concurrent 401s → 1 refresh, refresh failure clears token + emits `auth:unauthorized`, no retry for `/auth/*` or non-401s, `refreshSession` sharing |
| Auth context | `context/auth-context.test.tsx` (9) | Boot restore success/failure, login/register/logout, logout clears the React Query cache, `auth:unauthorized` clears the session |
| URL hooks | `hooks/use-urls.test.tsx` (9) | List fetching + errors, `getErrorMessage` incl. field-level errors, mutation invalidations (create/update/delete) |
| Pagination | `components/pagination.test.tsx` (5) | Windowing, ellipsis, bounds, `onChange` |
| Hero | `components/landing/hero.test.tsx` (4) | Guests go to signup (no fabricated link), signed-in users get a real link, invalid URL disables the button, failure shows no result |
| Edit dialog | `components/urls/edit-url-dialog.test.tsx` (3) | Expired link saves unchanged, new past expiry rejected, new future expiry accepted |
| Error boundary | `components/error-boundary.test.tsx` (2) | Fallback UI on throw, children render normally |
| Utils | `lib/utils.test.ts` (3) | `cn` merging |

Per-file coverage of tested modules is 90–100% lines (`client.ts`,
`auth-context.tsx`, `utils.ts`, `pagination.tsx`, `error-boundary.tsx` at
100%; `edit-url-dialog.tsx` 99%; `use-urls.ts` 94%; `hero.tsx` 90%).

### Coverage (measured 2026-11-18, `npm run test:coverage`)

```
All files  21.78% statements / 64.70% branches / 40.40% functions / 21.78% lines
```

The overall number is low because most pages and components have no tests:
`pages/` (dashboard, analytics, link-details, login, register, landing),
`components/urls/*` (except the edit dialog), charts, layout, and the
`use-analytics` hooks are untested. This is a deliberate, disclosed scope:
the suite covers the highest-risk logic (auth/session/refresh, API client,
mutations, the fixed hero and edit-dialog behaviors) rather than claiming
broad coverage it does not have. Page-level tests would need heavy mocking
of query hooks and the router; they are the obvious next step if coverage
is extended.

### Frontend test notes

- `vitest.config.ts` is separate from `vite.config.ts`; it aliases `@`
  to `src` and uses the jsdom environment.
- `test-setup.ts` registers jest-dom matchers, runs Testing Library
  cleanup after each test (Vitest runs with `globals: false`, so
  auto-cleanup does not apply), and stubs `ResizeObserver` (jsdom lacks
  it; Radix primitives need it at mount).
- Tests use `fireEvent`, not user-event (not installed).

## Known limitations and accepted trade-offs

These are deliberate decisions, not oversights. Do not "fix" them without
understanding why they are the way they are.

- **Single-flight is per-process.** The redirect stampede coalescing
  shares one DB lookup per slug per process. Across several API instances,
  each instance still does one lookup per slug per stampede. No
  distributed lock was added (no new infrastructure for a single-instance
  deploy).
- **No MongoDB transactions.** The local dev database and the memory
  server run standalone (transactions need a replica set). `recordClick`
  writes the analytics event *before* the counters, so a failed event
  never leaves a phantom count; the two writes can still disagree if the
  process dies between them.
- **Max-clicks residual.** The atomic claim strictly enforces the cap for
  concurrent redirects. One hole remains: a cap *lowered* mid-flight can
  let one click through beyond the new cap (the claim used the stale cap).
  A cap *raised* mid-flight is handled by one retry with the fresh cap.
- **DB visitor fallback can over-count by one.** With Redis down, the
  unique-visitor check is check-then-insert: two concurrent first visits
  from one IP can both count. Accepted best-effort; the Redis path is
  atomic.
- **Refresh reuse grace window (30 s).** A rotated token presented again
  within 30 s is rejected without revoking the family (two tabs racing);
  after the window it is treated as theft and revokes the whole family.
  Logout-then-refresh is a plain 401 with no revocation (a logged-out
  token is indistinguishable from a never-issued one).
- **Rate limits are in-memory per instance.** They reset on restart and
  are not shared across instances. A Redis-backed store (`rate-limit-redis`)
  was deliberately not added.
- **Analytics semantics.** `totalClicks` in per-URL analytics is
  lifetime; daily series and breakdowns are windowed by `days`.
  `overview.totalUniqueVisitors` is the sum of per-link uniques and
  double-counts visitors who clicked several links. Daily buckets are UTC
  and sparse (no zero-fill). These match the frontend's display; changing
  them would alter the API contract.
- **Status filter.** `status=expired` means inactive *or* past expiry
  date; `status=active` means active *and* not past expiry — matching the
  dashboard badge.
- **Empty PATCH** is accepted as a no-op 200.
- **Logout failure leaves the server session.** If the logout request
  fails, the client clears local state anyway; the server-side refresh
  token stays valid until expiry. Accepted UX trade-off.
- **No CSP header** on the frontend (Vercel). HSTS is set; a CSP was not
  added because it cannot be verified against the deployed app from here
  and a wrong one would break the app.

## Tests not executed (and why)

- **Rate-limiter 429 enforcement at real caps.** Test caps are raised to
  100000, so tests assert limiter *wiring* (headers present, middleware
  applied) but never observe a real 429. Verifying enforcement needs a
  separate process with low caps; the limiter itself is the
  `express-rate-limit` library's tested code.
- **Real Redis.** All cache tests use `ioredis-mock`. Reconnect behavior
  is tested against a mocked `ioredis` client (config + event handling),
  not a live server.
- **Real MongoDB replica set / transactions.** The memory server is
  standalone, matching local dev.
- **Server bootstrap / shutdown.** `server.ts` (signal handlers, global
  rejection handlers, graceful shutdown) is not executed by the suite;
  it is covered by typecheck + build + review. The Docker `HEALTHCHECK`
  path is built in CI but the image is never run there.
- **End-to-end browser tests.** None exist. Frontend tests are
  component/hook-level with mocked APIs.
- **Load / stress tests.** Concurrency tests use tens of parallel
  requests, not production-scale load.
- **`npm audit`.** Not run in CI: the audit endpoint is unreachable from
  this environment, so its result could not be verified before wiring it
  into the pipeline.

## Test data and secrets

Test JWT secrets in `tests/setup.ts` are obviously fake values for local
testing only (`test-access-secret-for-local-testing-only-...`). They are
never used outside the test suite. No real credentials exist anywhere in
the repo; `.env.example` files contain placeholders only.
