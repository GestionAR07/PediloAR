# Checkpoints

## Completados

### `PROJECT_ARCHITECTURE_V1_APPROVED`

Arquitectura general aprobada: monolito modular, Next.js App Router, TypeScript strict, Tailwind, PostgreSQL/Supabase y Drizzle previstos, mobile-first, separación UI/dominio/aplicación/infraestructura, `Order` ≠ `Delivery`, carrito local previsto, pagos iniciales cliente→comercio, `PLATFORM_DELIVERY` futuro.

### `BASE_TECH_FOUNDATION_READY`

Fundación técnica validada (Next.js, strict TS, Tailwind, lint/format/tests/CI, docs, build). Commit: `b7a258a`.

### `CORE_DOMAIN_MODEL_VALIDATED`

Dominio puro en `src/domain`. Commit: `afc53f9`.

### `CORE_DOMAIN_MODEL_HARDENED`

Hardening pre-persistencia. Commit: `9c3ae12`.

### `CORE_PERSISTENCE_SCHEMA_READY_REMOTE_APPLY_PENDING` / `CORE_PERSISTENCE_SCHEMA_VALIDATED`

Schema Drizzle + migración inicial versionada + money mapping + constraints + docs.

- **VALIDATED:** migración aplicada y verificada en PostgreSQL de desarrollo dedicado.
- **READY_REMOTE_APPLY_PENDING:** schema y SQL listos; aplicar remoto queda pendiente hasta existir/usar solo un proyecto Supabase de dev.

Ver [`PERSISTENCE.md`](./PERSISTENCE.md).

## Siguiente

Auth + admin + onboarding (Fase 3), sin saltar checkout antes de identidad/roles.
