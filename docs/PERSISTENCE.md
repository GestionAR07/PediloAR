# Persistencia — Marketplace Rawson

Checkpoint de esta fase: ver `docs/CHECKPOINTS.md` (`CORE_PERSISTENCE_SCHEMA_*`).

## Stack

| Pieza       | Rol                                                 |
| ----------- | --------------------------------------------------- |
| PostgreSQL  | Base relacional (hosted on Supabase)                |
| Supabase    | Hosting de Postgres (sin Auth en esta fase)         |
| Drizzle ORM | Schema TypeScript → SQL tipado, queries server-side |
| Drizzle Kit | Generación y aplicación de migraciones versionadas  |
| postgres.js | Driver (`postgres` package)                         |

**Source of truth del schema:** `src/infrastructure/db/schema/*`

**Migraciones versionadas:** carpeta `drizzle/` (SQL generado por Kit — no usar `drizzle-kit push` como flujo normal).

**Cliente server-only:** `src/infrastructure/db/client.ts` (`import "server-only"`).

Domain (`src/domain`) **no** importa infraestructura ni `DATABASE_URL`.

## Variables de entorno

Solo server-side:

```text
DATABASE_URL=postgresql://...
```

- Nunca `NEXT_PUBLIC_*` para la connection string.
- Nunca commitear secrets (`.env.local` está en `.gitignore`).
- Placeholders en `.env.example`.

Validación mínima: `getDatabaseConfig()` / `hasDatabaseConfig()` en `src/infrastructure/db/env.ts`.

El harness manual `scripts/validate-real-order-lifecycle.ts` exige además:

```text
MARKETPLACE_DEV_PROJECT_REF=
```

Ese valor es el project ref exacto del proyecto Supabase DEV (`https://<ref>.supabase.co`). Vive solo en `.env.local` (ignorado por git). Sin ese match exacto el harness aborta antes de cualquier write. No forma parte de `npm test` / `npm run build`.

Se ejecuta con Node `--conditions=react-server` para que el paquete `server-only` resuelva su export vacío (el mismo que usa React Server Components), no con un stub custom.

## IDs

UUID generados en PostgreSQL (`gen_random_uuid()` vía `defaultRandom()` de Drizzle).

Justificación: IDs opacos sin significado de negocio, fáciles de fusionar entre entornos, y un solo tipo para todas las FK.

## Timestamps

`timestamptz` (`created_at` / `updated_at`) = instantes absolutos.

`City.timezone` es **texto IANA**, no un offset embebido en timestamps de pedido.

## Enums

**TEXT + CHECK**, no ENUM nativo de PostgreSQL.

Motivo: los estados de Order/Delivery y flags de catálogo evolucionan; alterar ENUM nativo es rígido. Migrar CHECK es aditivo y revisable. El dominio TypeScript sigue siendo la validación primaria de aplicación.

## Money mapping

| Capa       | Representación                       |
| ---------- | ------------------------------------ |
| Domain     | `MoneyCents` = safe integer (number) |
| PostgreSQL | `BIGINT` cents (nunca float/numeric) |
| Drizzle    | `moneyCentsColumn` custom type       |

Frontera (`money-mapping.ts`):

- Write: `assertNonNegativeMoneyCents` → string decimal integer.
- Read: string | number | bigint → safe integer o error de dominio (`MONEY_OVERFLOW` si supera `Number.MAX_SAFE_INTEGER`).
- **Prohibido** castear bigint grandes a `Number` en silencio.

## Idempotencia

- Columna `orders.idempotency_key` NOT NULL.
- **UNIQUE global** `orders_idempotency_key_uidx`.
- CHECK de forma alineado al dominio (longitud 8–128, charset seguro).

**Scope elegido: global.**

Las keys son tokens de alta entropía (UUID / secure). Un intento de creación de
pedido se identifica de forma global; reintentos del cliente colisionan
deliberadamente con la misma key. Antes de devolver un replay, la aplicación
también exige que el `customer_user_id` persistido coincida con la sesión
verificada. La restricción UNIQUE sigue siendo global y la identidad se valida
en la capa de aplicación.

Unique de persistencia es defensa adicional a `parseIdempotencyKey` del dominio.

## Order ↔ Delivery

- `orders` **no** tiene `delivery_id`.
- `deliveries.order_id` → `orders.id` con **UNIQUE** (máximo una Delivery por Order).
- FK `ON DELETE RESTRICT` (no borrar pedidos/logística por accidente).

## Snapshots históricos

| Tabla                | Qué congela                                                             |
| -------------------- | ----------------------------------------------------------------------- |
| `order_items`        | nombre, precios, qty, notes; `product_id` nullable `ON DELETE SET NULL` |
| `order_item_options` | nombres de grupo/choice, delta, qty; FK catálogo `SET NULL`             |
| `orders`             | pago + dirección (columnas + `city/zone` name snapshots)                |
| `deliveries`         | dirección propia + labels de city/zone                                  |

Eliminar un producto **no** cascada el historial comercial.

## Delete policies (críticas)

Preferir `active` / `status` a hard delete en catálogo y merchants.

| Relación                            | onDelete | Motivo                                     |
| ----------------------------------- | -------- | ------------------------------------------ |
| `order_items.product_id` → products | SET NULL | preserva línea histórica                   |
| `order_item_options.*` → catalog    | SET NULL | preserva snapshots                         |
| `orders.merchant_id` → merchants    | RESTRICT | no borrar comercio con pedidos             |
| `order_items.order_id` → orders     | RESTRICT | historial no se borra en cascada ordinaria |
| `order_events.order_id` → orders    | RESTRICT | auditoría                                  |
| `deliveries.order_id` → orders      | RESTRICT | logística ligada                           |
| option groups/choices → product     | CASCADE  | catálogo vivo sin producto es basura       |
| merchant_* config → merchant        | CASCADE  | config del comercio                        |

## Índices (solo patrones claros)

- merchants por city/status
- products por merchant/category/active
- orders por merchant/status/created_at y customer
- order_events por order/created_at
- deliveries por order (unique) y status
- slugs/uniques de geo y merchant+zone

## RLS

Baseline de Fase 3A: **RLS enabled** en todas las tablas `public` del marketplace.

- Sin políticas `USING (true)`.
- Policies mínimas: `user_profiles` SELECT own, `merchant_users` SELECT own, `merchants` SELECT if member.
- Sin UPDATE de `user_profiles` vía API autenticada (bloquea self-elevate de `platform_role` / `status`).
- Detalle: [`AUTHORIZATION.md`](./AUTHORIZATION.md).

Server app continúa usando `DATABASE_URL` + helpers de autorización server-side para operaciones privilegiadas.

## Auth boundary (Supabase)

- `auth.users` es schema administrado por Supabase — **no** modelado ni migrado por Drizzle.
- `user_profiles.id` = `auth.users.id` con FK añadida en SQL controlado (`0001_auth_foundation.sql`).
- Trigger de provisioning: `auth.users` INSERT → `user_profiles` (role USER, status ACTIVE).

## Scripts npm

```powershell
npm run db:generate   # drizzle-kit generate → SQL en drizzle/
npm run db:migrate    # aplica migraciones (requiere DATABASE_URL)
npm run db:check      # verifica consistencia schema/migraciones
```

## Migraciones seguras

1. Confirmar entorno (solo **marketplace-rawson-dev** / local).
2. `npm run db:generate` tras cambios de schema (o migración custom revisada).
3. Revisar el SQL en `drizzle/*.sql`.
4. `npm run db:migrate` **solo** contra DB de desarrollo.
5. Nunca contra producción hasta proceso de release explícito.
6. **No editar** migraciones ya aplicadas (`0000_…`).

## Estructura

```text
src/infrastructure/db/
  schema/          # tablas Drizzle
  client.ts        # getDb() server-only
  env.ts           # DATABASE_URL
  money-mapping.ts # BIGINT ↔ MoneyCents
  repositories/    # futuro
src/infrastructure/supabase/
  env.ts / browser.ts / server.ts / update-session.ts
proxy.ts           # refresh de sesión Auth (Next.js 16)
drizzle/           # migraciones SQL versionadas
drizzle.config.ts
```
