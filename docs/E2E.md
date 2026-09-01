# Pedilo E2E (Playwright foundation)

Infrastructure only. This suite does **not** audit the full product.
Later Pedilo QA Auditor runs: local Next → local Playwright → local Chromium
→ the exact audited HEAD.

`CURRENT_E2E_MODE = READ_ONLY`

## Install browsers (once per machine)

Chromium only — do not install Firefox or WebKit:

```bash
npx playwright install chromium
```

## Run

```bash
npm run e2e
npm run e2e:headed
npm run e2e:ui
```

`npm test` remains Vitest. Do not replace it with Playwright.

## Safe target (mandatory)

By default E2E **only** talks to a loopback app:

`http://127.0.0.1:3100`

`npm run e2e` **always** starts its own Next for the current HEAD with a
controlled env (`reuseExistingServer = false` locally and in CI). It never
reuses a manually started server, a different commit, or real credentials.

If `127.0.0.1:3100` is already occupied, E2E **fails fast** with a clear
error. It does **not** kill the other process.

It never uses `pedilo.store` (including `www`, subdomains, and trailing-dot
FQDNs such as `pedilo.store.`). Hostnames are normalized before compare.

The autostarted server clears `DATABASE_URL` and `SUPABASE_SECRET_KEY` so
these **read-only** smokes cannot create/modify data in Supabase. That is
not a write-authorization gate.

Every main-frame HTTP(S) navigation is checked by a centralized guard
(`e2e/fixtures.ts`). Browser specs import `test` from that module so they
inherit the guard automatically. Internals such as `about:blank` are
allowed during bootstrap.

- Production hosts are always rejected, even with remote-DEV flags.
- A future remote DEV origin requires **both**
  `E2E_ALLOW_REMOTE_DEV=I_ACCEPT_REMOTE_DEV` **and**
  `E2E_REMOTE_DEV_HOST=<exact hostname>`. The sentinel alone does not
  authorize arbitrary remotes.
- If the target cannot be proven safe, Playwright **fails fast**.

Optional: `E2E_BASE_URL=http://127.0.0.1:3100` (loopback only unless both
remote-DEV variables are set to a non-production exact host).

## CURRENT_E2E_MODE = READ_ONLY

This suite is **GET / render / navigate only**. Do **not** register users,
create orders, submit forms, modify merchants, or write DB / Auth /
Supabase.

Future tests that create users/orders, modify merchants, or write
DB/Auth/Supabase **MUST NOT** be added until a safe DEV/E2E environment
**independent of production** is defined.

Do **not** assume `NEXT_PUBLIC_SUPABASE_URL` or the publishable/anon key
are harmless for future submit tests. Those values can still reach a real
project.

Enabling writes needs an **additional explicit gate** (not implemented in
this foundation). Clearing `DATABASE_URL` on autostart is not that gate.

## Smokes (GET only)

- App starts and home returns OK
- Public home, login, and empty cart render
- Header/cart navigation works
- Chromium does not crash on startup
- Home can open at 390×844, 768×1024, and 1366×768
- Production / reuse / trailing-dot / navigation guards

## Artifacts (gitignored)

On failure: screenshot under `test-results/`. Trace on first retry.
HTML report: `playwright-report/` (`npx playwright show-report`).

## CI

`E2E_CI = ENABLED` — a Chromium smoke job runs in GitHub Actions without
production secrets (same empty-DB public pages as local autostart).
If that job is later blocked by missing infra, defer it rather than
pointing at production.

## Product bugs still pending (not fixed in this phase)

- `GET /sumar-comercio` returns HTTP 500 when `DATABASE_URL` is unset.
- Next.js 16 `next dev` warning: `scroll-behavior: smooth` on `<html>`
  without `data-scroll-behavior="smooth"`.
- Hero `<h1>` accessible name concatenates across `<br />` as
  `Todo lo de tu zona,en un solo lugar.` (missing space after the comma).
