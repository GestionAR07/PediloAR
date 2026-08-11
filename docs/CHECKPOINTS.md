# Checkpoints

## Completados

### `PROJECT_ARCHITECTURE_V1_APPROVED`

Arquitectura general aprobada.

### `BASE_TECH_FOUNDATION_READY`

Commit: `b7a258a`.

### `CORE_DOMAIN_MODEL_VALIDATED`

Commit: `afc53f9`.

### `CORE_DOMAIN_MODEL_HARDENED`

Commit: `9c3ae12`.

### `CORE_PERSISTENCE_SCHEMA_VALIDATED`

Schema Drizzle + migración `0000_luxuriant_puma` aplicada y validada manualmente contra el proyecto Supabase de desarrollo **marketplace-rawson-dev**.

Commit de schema: `7ac0337`.

### Auth foundation (Fase 3A)

Estados posibles:

| Checkpoint                                       | Significado                                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------------- |
| `AUTH_FOUNDATION_VALIDATED`                      | Migración 0001 en dev + bootstrap admin + login/logout/admin/merchant validados |
| `AUTH_FOUNDATION_READY_MANUAL_BOOTSTRAP_PENDING` | DB/migration OK; falta solo bootstrap manual de usuario admin                   |
| `AUTH_FOUNDATION_READY_DB_APPLY_PENDING`         | Código listo; falta aplicar migración en Supabase dev                           |

Ver [`AUTHORIZATION.md`](./AUTHORIZATION.md).

## Siguiente

**Fase 3B — Assisted merchant onboarding + owner invitations.**

Ver [`MERCHANT_ONBOARDING.md`](./MERCHANT_ONBOARDING.md).

Estados posibles:

| Checkpoint                                            | Significado                                      |
| ----------------------------------------------------- | ------------------------------------------------ |
| `MERCHANT_ONBOARDING_READY`                           | Código + E2E manual completo (invite email real) |
| `MERCHANT_ONBOARDING_READY_MANUAL_VALIDATION_PENDING` | Código listo; falta validación manual en dev     |
| `MERCHANT_ONBOARDING_BLOCKED`                         | Bloqueo (schema, secret, config)                 |
