# Server utilities

Server-only helpers for marketplace-rawson.

- Auth authorization: `src/server/auth/`
- Application use cases: `src/application/` (geography, merchant create/invite)
- Prefer `requireActiveUser` / `requirePlatformAdmin` / merchant helpers near protected resources.
- Session clients: `src/infrastructure/supabase/` (`server` SSR; `admin` secret, server-only).
- Secret key only after caller authorization; never for browser.

Do not import these modules from Client Components.
