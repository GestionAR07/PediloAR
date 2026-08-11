# Server utilities

Server-only helpers (Next.js server entrypoints, privileged clients).

Database access lives in `src/infrastructure/db/client.ts` (`server-only`).
Do not pass connection handles into Client Components.
