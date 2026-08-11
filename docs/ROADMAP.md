# Roadmap

1. Fundación técnica — **completada** (`BASE_TECH_FOUNDATION_READY`)
2. Dominio y datos
   - **2A Dominio puro** ← _actual_ (`CORE_DOMAIN_MODEL_VALIDATED`)
   - 2B Persistencia PostgreSQL/Supabase + Drizzle
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

## Fase 2A — Modelo de dominio (actual)

TypeScript puro en `src/domain`: entidades, value types, máquinas de estado, totales y snapshots. Sin persistencia.

## Fase 2B — Persistencia (siguiente)

PostgreSQL/Supabase, Drizzle, migraciones, constraints (incluye unique de `idempotencyKey`).
