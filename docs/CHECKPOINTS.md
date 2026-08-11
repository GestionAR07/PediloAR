# Checkpoints

## Completados

### `PROJECT_ARCHITECTURE_V1_APPROVED`

Arquitectura general aprobada: monolito modular, Next.js App Router, TypeScript strict, Tailwind, PostgreSQL/Supabase y Drizzle previstos, mobile-first, separación UI/dominio/aplicación/infraestructura, `Order` ≠ `Delivery`, carrito local previsto, pagos iniciales cliente→comercio, `PLATFORM_DELIVERY` futuro.

### `BASE_TECH_FOUNDATION_READY`

Fundación técnica validada (Next.js, strict TS, Tailwind, lint/format/tests/CI, docs, build). Commit: `b7a258a`.

### `CORE_DOMAIN_MODEL_VALIDATED`

Dominio puro en `src/domain`: dinero en cents, geografía, merchant, catálogo con SINGLE/MULTIPLE/QUANTITY, Order/Delivery separados con máquinas de estado, snapshots, totales integer, idempotencyKey conceptual. Sin DB/Auth/UI de negocio.

Estado: **listo** cuando lint/typecheck/test/format/build pasan y existe el commit de dominio.

## Siguiente

Persistencia PostgreSQL/Supabase + Drizzle (Fase 2B).
