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

## Storefront público (Fase 5)

Ver [`PUBLIC_STOREFRONT.md`](./PUBLIC_STOREFRONT.md).

| Checkpoint                                                    | Significado                                       |
| ------------------------------------------------------------- | ------------------------------------------------- |
| `PUBLIC_STOREFRONT_DISCOVERY_READY`                           | Código + validación manual E2E completa           |
| `PUBLIC_STOREFRONT_DISCOVERY_READY_MANUAL_VALIDATION_PENDING` | Código listo; falta checklist manual en localhost |
| `PRODUCT_IMAGES_STORAGE_READY`                                | Imágenes de producto (Fase 4B) validadas          |

## Siguiente

**Fase 6 — Carrito + checkout** (después de validar storefront manualmente).
