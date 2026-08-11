# Roadmap

1. Fundación técnica — **completada** (`BASE_TECH_FOUNDATION_READY`)
2. Dominio y datos
   - **2A Dominio puro** — completada (`CORE_DOMAIN_MODEL_VALIDATED` + `HARDENED`)
   - **2B Persistencia PostgreSQL/Supabase + Drizzle** ← _actual_
3. Auth + admin + onboarding
4. Catálogo
5. Storefront
6. Carrito + checkout
7. Operación de pedidos
8. Hardening / PWA
9. Piloto Rawson + Playa Unión
10. Red de repartidores
11. Logística avanzada
12. Monetización
13. Trelew
14. Puerto Madryn

## Fase 2A — Modelo de dominio

TypeScript puro en `src/domain`: entidades, value types, máquinas de estado, totales y snapshots. Commit de hardening: `9c3ae12`.

## Fase 2B — Persistencia (actual)

PostgreSQL/Supabase, Drizzle, migraciones versionadas, constraints (unique `idempotency_key`, Delivery.order_id unique, snapshots). Ver [`PERSISTENCE.md`](./PERSISTENCE.md).

Sin Auth, checkout, UI comercial ni couriers.

## Fase 3+ (siguiente bloque funcional)

Auth Supabase, permisos, y luego catálogo/storefront/checkout sobre el schema persistido.
