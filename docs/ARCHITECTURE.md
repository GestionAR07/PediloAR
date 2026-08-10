# Arquitectura — Marketplace Rawson

## Decisiones aprobadas (V1)

| Decisión                | Detalle                                                                   |
| ----------------------- | ------------------------------------------------------------------------- |
| Forma del sistema       | Monolito modular                                                          |
| Framework               | Next.js App Router                                                        |
| Lenguaje                | TypeScript strict                                                         |
| Estilos                 | Tailwind CSS                                                              |
| Persistencia prevista   | PostgreSQL vía Supabase                                                   |
| ORM previsto            | Drizzle                                                                   |
| Validación de contratos | Zod (cuando existan inputs/contratos)                                     |
| Deploy inicial previsto | Vercel                                                                    |
| Enfoque UI              | Mobile-first                                                              |
| Multiciudad             | Preparada conceptualmente (Rawson + Playa Unión → Trelew → Puerto Madryn) |

## Separación de capas

- **UI** (`components/`, `app/`): presentación. Sin reglas de negocio.
- **Features** (`features/`): agrupación por dominio funcional.
- **Domain** (`domain/`): conceptos y reglas puras. **No depende de React.**
- **Application** (`application/`): casos de uso / orquestación.
- **Infrastructure** (`infrastructure/`): clientes externos (DB, pagos, email, etc.).
- **Server** (`server/`): utilidades exclusivas de servidor.
- **Lib** (`lib/`): helpers compartidos transversales.

## Entidades clave (conceptuales, sin schema aún)

- **`Order`** y **`Delivery`** serán entidades **separadas**.
- Carrito persistente local previsto para el MVP (no en Fase 1).
- Pagos iniciales: directo **cliente → comercio** (sin pasarela de plataforma en el MVP).
- **`PLATFORM_DELIVERY`** es futuro: red de repartidores propia, no parte del alcance actual.

## Fuera de alcance de esta fundación

No se implementa todavía: Supabase, migraciones, auth, catálogo, carrito, checkout, pedidos, delivery, repartidores, mapas, Mercado Pago, emails, Sentry, PWA, admin ni storefront real.

## Principio de crecimiento

Ampliar por capas y features sin mezclar UI con dominio. Preferir cambios pequeños y verificables (`lint` / `typecheck` / `test` / `build`).
