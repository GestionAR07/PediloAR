# Pedilo E2E (Playwright foundation)

Infrastructure only. This suite does **not** audit the full product.
Later Pedilo QA Auditor runs: local Next → local Playwright → local Chromium
→ the exact audited HEAD.

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

Playwright auto-starts `next dev` on that origin. It never uses
`pedilo.store`. The autostarted server clears `DATABASE_URL` and
`SUPABASE_SECRET_KEY` so these smokes cannot create/modify data in
Supabase.

- Production hosts (`pedilo.store` and subdomains) are always rejected.
- A future remote DEV origin requires
  `E2E_ALLOW_REMOTE_DEV=I_ACCEPT_REMOTE_DEV`.
- If the target cannot be proven safe, Playwright **fails fast**.

Optional: `E2E_BASE_URL=http://127.0.0.1:3100` (loopback only unless the
sentinel is set).

## Smokes (GET only)

- App starts and home returns OK
- Public home, login, and empty cart render
- Header/cart navigation works
- Chromium does not crash on startup
- Home can open at 390×844, 768×1024, and 1366×768

Do **not** register users, create orders, submit forms, or touch real
Supabase from this suite.

## Artifacts (gitignored)

On failure: screenshot under `test-results/`. Trace on first retry.
HTML report: `playwright-report/` (`npx playwright show-report`).

## CI

`E2E_CI = ENABLED` — a Chromium smoke job runs in GitHub Actions without
production secrets (same empty-DB public pages as local autostart).
If that job is later blocked by missing infra, defer it rather than
pointing at production.
