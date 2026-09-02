# Pedilo E2E (Playwright)

Playwright is Chromium-only and always runs against the exact checked-out HEAD.
The default suite remains safe/read-only. A separate, explicit DEV-only runtime
exists for future browser tests that need controlled writes.

## Modes

### `READ_ONLY` — default

```bash
npm run e2e
npm run e2e:headed
npm run e2e:ui
```

If `E2E_MODE` is unset, it resolves to `READ_ONLY`.

The Playwright-started Next server:

- runs at `http://127.0.0.1:3100` by default;
- always uses `reuseExistingServer = false`;
- fails fast if the port is occupied;
- clears `DATABASE_URL` and `SUPABASE_SECRET_KEY` before starting Next;
- ignores every future `*.write.spec.ts` test.

`npm test` remains Vitest. It also runs the pure E2E safety-unit tests under
`e2e/lib/**/*.test.ts`; it does not run browser specs.

### `WRITE_DEV` — manual/local only

```bash
npm run e2e:dev
```

`npm run e2e:dev` only sets `E2E_MODE=WRITE_DEV`; that is **not** enough to
start. The Playwright config executes a fail-closed preflight before its Next
`webServer` process can be created.

Required conditions:

1. `E2E_MODE=WRITE_DEV` (set by the command above).
2. `E2E_ALLOW_WRITES=I_ACCEPT_E2E_DEV_WRITES` exactly.
3. App target is loopback (`localhost`, `127.0.0.1`, or `::1`). Remote
   WRITE_DEV is forbidden.
4. `NODE_ENV`, `VERCEL_ENV`, and `MARKETPLACE_ENV` are not production.
5. `MARKETPLACE_DEV_PROJECT_REF` is configured.
6. `NEXT_PUBLIC_SUPABASE_URL` must be exactly the Supabase API project whose
   project ref matches `MARKETPLACE_DEV_PROJECT_REF`.
7. `DATABASE_URL` must be present and its Supabase project identity must be
   provable and match the same DEV project. Supported proof is either:
   - direct `db.<project-ref>.supabase.co`, or
   - Supabase pooler with username `postgres.<project-ref>`.

If any identity cannot be proven, WRITE_DEV fails closed. Guard errors never
print credentials or project refs.

After preflight passes, and only then, the local Next server receives the DEV
environment including `DATABASE_URL` and any configured server-side Supabase
credentials.

WRITE_DEV runs one Playwright worker to reduce mutation collisions. Future
browser specs that can write must be named `*.write.spec.ts`. Normal
`npm run e2e` ignores those files automatically.

**Current state:** the WRITE_DEV runtime/gates exist, but no browser test in
this phase performs a real DB/Auth/order mutation yet.

## Install browser (once per machine)

Chromium only:

```bash
npx playwright install chromium
```

## Safe browser target

Production browser targets are permanently prohibited. `pedilo.store`,
`www.pedilo.store`, all subdomains, and trailing-dot variants are rejected.

Every main-frame HTTP(S) navigation is checked by `e2e/fixtures.ts`. Browser
specs must import `test` from that module so they inherit the navigation guard.
Internals such as `about:blank` are allowed during bootstrap.

READ_ONLY may target a remote DEV origin only when both are explicitly set:

```text
E2E_ALLOW_REMOTE_DEV=I_ACCEPT_REMOTE_DEV
E2E_REMOTE_DEV_HOST=<exact-dev-hostname>
```

That remote exception never applies to WRITE_DEV.

## Server isolation

Playwright always starts its own Next process for the current HEAD when the
target is loopback. It never reuses or kills an existing process.

If `127.0.0.1:3100` is occupied, the run fails and asks the operator to stop
the other process. This prevents testing the wrong commit or environment.

## Scoped resources for future write tests

`e2e/lib/e2e-run-scope.ts` provides a per-run marker and an exact-ID resource
registry. Future fixture/cleanup adapters must register each resource they
create and remove only those exact IDs.

The design intentionally provides no broad cleanup primitive:

- no `TRUNCATE`;
- no blanket table reset;
- no unscoped `DELETE`;
- no deletion of resources that were not registered by the current E2E run.

A write test must fail visibly if registered leftovers remain after cleanup.

## Existing read-only smokes

- App starts and home returns OK.
- Public home, login, and empty cart render.
- Header/cart navigation works.
- Chromium does not crash on startup.
- Home opens at 390×844, 768×1024, and 1366×768.
- Production / reuse / trailing-dot / navigation guards.

## Artifacts

On failure: screenshot under `test-results/`. Trace on first retry.
HTML report: `playwright-report/` (`npx playwright show-report`).

## CI

Normal GitHub Actions continues to run only the READ_ONLY Chromium smoke suite
with no production/DEV mutation secrets.

WRITE_DEV is manual/local only in this phase. Do not add DEV database, Auth
admin, or write-sentinel secrets to ordinary PR CI.

## Product bugs still pending (not fixed by the E2E foundation)

- `GET /sumar-comercio` returns HTTP 500 when `DATABASE_URL` is unset.
- Next.js 16 `next dev` warning: `scroll-behavior: smooth` on `<html>` without
  `data-scroll-behavior="smooth"`.
- Hero `<h1>` accessible name concatenates across `<br />` as
  `Todo lo de tu zona,en un solo lugar.` (missing space after the comma).
