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

## Dominio (Fase 2A)

El modelo puro está implementado en `src/domain` y documentado en [`DOMAIN.md`](./DOMAIN.md).

Resumen de decisiones vigentes:

- Dinero en **integer cents** (`MoneyCents`).
- Geografía `Province → City → Zone` (sin hardcode de Rawson/Playa Unión en reglas).
- `Order` y `Delivery` son entidades **separadas**, con máquinas de estado propias.
- Fulfillment: `PICKUP` | `MERCHANT_DELIVERY` | `PLATFORM_DELIVERY` (plataforma deshabilitada en MVP).
- Catálogo con opciones `SINGLE` | `MULTIPLE` | `QUANTITY`.
- Snapshots históricos en ítems/opciones/pago/dirección.
- Carrito **local** en el navegador (sin entidad Cart de servidor).
- `idempotencyKey` contemplado; constraint unique en persistencia (Fase 2B).
- `CourierProfile` **no** implementado.

## Entidades clave (conceptuales)

- **`Order`** y **`Delivery`** son entidades **separadas**.
- Carrito persistente local previsto para el MVP (no en DB).
- Pagos iniciales: directo **cliente → comercio** (sin pasarela de plataforma en el MVP).
- **`PLATFORM_DELIVERY`** es futuro: red de repartidores propia, no parte del alcance operativo actual.

## Persistencia (aún no)

PostgreSQL/Supabase + Drizzle llegan en **Fase 2B**. Esta fase no incluye schema SQL, migraciones ni clientes de DB.

## Principio de crecimiento

Ampliar por capas y features sin mezclar UI con dominio. Preferir cambios pequeños y verificables (`lint` / `typecheck` / `test` / `build`).
