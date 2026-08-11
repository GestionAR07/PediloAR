# Infrastructure layer

External integrations (database clients, payment gateways, email, etc.).

## Database (Phase 2B)

- Schema: `db/schema/`
- Server client: `db/client.ts` (import only on the server)
- Env: `DATABASE_URL` via `db/env.ts`
- Docs: [`docs/PERSISTENCE.md`](../../docs/PERSISTENCE.md)

Domain code must not import this layer.
