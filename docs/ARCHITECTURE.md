# Arquitectura — Marketplace Rawson

## Decisiones aprobadas (V1)

| Decisión                | Detalle                                                                   |
| ----------------------- | ------------------------------------------------------------------------- |
| Forma del sistema       | Monolito modular                                                          |
| Framework               | Next.js App Router                                                        |
| Lenguaje                | TypeScript strict                                                         |
| Estilos                 | Tailwind CSS                                                              |
| Persistencia            | PostgreSQL vía Supabase + Drizzle ORM                                     |
| ORM                     | Drizzle (`drizzle-orm` + `postgres` + kit)                                |
| Validación de contratos | Zod (cuando existan inputs/contratos)                                     |
| Deploy inicial previsto | Vercel                                                                    |
| Enfoque UI              | Mobile-first                                                              |
| Multiciudad             | Preparada conceptualmente (Rawson + Playa Unión → Trelew → Puerto Madryn) |

## Separación de capas

- **UI** (`components/`, `app/`): presentación. Sin reglas de negocio.
- **Features** (`features/`): agrupación por dominio funcional.
- **Domain** (`domain/`): conceptos y reglas puras. **No depende de React ni de DB.**
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
- `idempotencyKey` validada en dominio; **UNIQUE en DB** (Fase 2B).
- `CourierProfile` **no** implementado.

## Persistencia (Fase 2B)

Ver [`PERSISTENCE.md`](./PERSISTENCE.md).

- Schema Drizzle en `src/infrastructure/db/schema`.
- Migraciones SQL versionadas en `drizzle/`.
- Cliente server-only: `getDb()` requiere `DATABASE_URL` (nunca `NEXT_PUBLIC_*`).
- Money: `BIGINT` cents + mapeo seguro a `MoneyCents`.
- Order **sin** `delivery_id`; `deliveries.order_id` UNIQUE.
- Checkpoint: `CORE_PERSISTENCE_SCHEMA_VALIDATED` en **marketplace-rawson-dev**.

## Auth / autorización (Fase 3A)

Ver [`AUTHORIZATION.md`](./AUTHORIZATION.md).

- Supabase Auth SSR (`@supabase/ssr` + publishable key).
- `user_profiles` 1:1 con `auth.users` (FK + trigger).
- Platform roles: `USER` | `ADMIN` únicamente.
- Merchant roles en `merchant_users`: `OWNER` | `STAFF` (scoped, no JWT).
- RLS enabled en todas las tablas public; policies mínimas sin `USING (true)`.
- Proxy Next.js 16 (`proxy.ts`) solo refresca sesión; authz en server pages.
- Rutas: `/login`, `/registro`, `/cuenta`, `/admin`, `/merchant`.

## Cuenta del cliente

Ver [`CUSTOMER_ACCOUNTS.md`](./CUSTOMER_ACCOUNTS.md).

- Registro público crea perfiles `USER`; no otorga autoridad de comercio.
- El checkout exige cuenta activa y asocia el pedido desde la sesión verificada.
- Historial y seguimiento viven bajo `/cuenta/pedidos`.
- El detalle se consulta por `order_id + customer_user_id`; no existe acceso
  público por token o por ID aislado.
- Branding y reutilización de cuenta en Google: [`GOOGLE_OAUTH.md`](./GOOGLE_OAUTH.md).

## Merchant onboarding (Fase 3B)

Ver [`MERCHANT_ONBOARDING.md`](./MERCHANT_ONBOARDING.md).

- Admin UI: geografía mínima + merchants DRAFT + invitación OWNER.
- `SUPABASE_SECRET_KEY` server-only (Auth Admin); `APP_BASE_URL` para redirects.
- Authz: `platform_role` vs `merchant_users` sin unificar roles.

## Entidades clave (conceptuales)

- **`Order`** y **`Delivery`** son entidades **separadas**.
- Carrito persistente local previsto para el MVP (no en DB).
- Pagos iniciales: directo **cliente → comercio** (sin pasarela de plataforma en el MVP).
- **`PLATFORM_DELIVERY`** es futuro: red de repartidores propia, no parte del alcance operativo actual.

## Principio de crecimiento

Ampliar por capas y features sin mezclar UI con dominio. Preferir cambios pequeños y verificables (`lint` / `typecheck` / `test` / `build` / `db:check`).
