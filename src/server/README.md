# Server utilities

Server-only helpers for marketplace-rawson.

- Auth authorization: `src/server/auth/`
- Prefer `requireActiveUser` / `requirePlatformAdmin` / merchant helpers near protected resources.
- Session clients live in `src/infrastructure/supabase/` (`server-only` for server entry).

Do not import these modules from Client Components.
