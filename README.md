# Pedilo

Marketplace local de pedidos online orientado inicialmente a **Rawson y Playa Unión, Chubut**, con arquitectura preparada para ampliar la operación a otras ciudades.

Pedilo conecta compradores y comercios locales en una misma plataforma: descubrimiento por zona, catálogo, carrito, checkout, retiro o delivery propio, seguimiento de pedidos y un panel operativo para cada comercio.

## Estado actual

**Pre-piloto funcional.**

El producto ya cuenta con los flujos principales de comprador, comercio y administración, además de una batería automatizada y WRITE_DEV para validar operaciones reales contra el entorno de desarrollo.

Flujos actualmente cubiertos:

- descubrimiento público de comercios activos por zona/categoría;
- storefront de comercio con catálogo, disponibilidad, opciones e imágenes;
- carrito persistente y checkout con revalidación autoritativa;
- retiro y delivery propio del comercio;
- creación, idempotencia, cancelación y seguimiento de pedidos;
- cuenta de comprador e historial de pedidos;
- panel merchant con catálogo, configuración, pagos, delivery y operación de pedidos;
- actualización operativa y notificaciones Realtime de pedidos;
- solicitud pública para sumar un comercio;
- revisión ADMIN, onboarding `DRAFT`, readiness y activación manual a `ACTIVE`;
- autorización merchant-scoped y RLS deny-by-default para escrituras directas autenticadas.

Los cambios de producción, despliegue definitivo, dominio y operación comercial real se gestionan por separado del desarrollo local/DEV.

## Stack

| Área | Tecnología |
| --- | --- |
| Framework | Next.js 16 (App Router) |
| UI | React 19 + Tailwind CSS 4 |
| Lenguaje | TypeScript (`strict`) |
| Auth / Realtime / Storage | Supabase |
| Datos | PostgreSQL + Drizzle ORM |
| Cliente SQL | postgres.js |
| Tests | Vitest + Playwright |
| Calidad | ESLint + Prettier |
| CI | GitHub Actions |
| Package manager | npm |

## Requisitos de desarrollo

- Node.js **22** recomendado;
- npm 10+;
- acceso únicamente al proyecto Supabase de desarrollo cuando se ejecuten pruebas con escritura.

En Windows (PowerShell), el repositorio de trabajo usado habitualmente es:

```powershell
cd C:\Projects\MarketPlaceRawson\MarketPlaceRawson
```

## Instalación

```powershell
npm install
Copy-Item .env.example .env.local
```

Después configurá `.env.local`. Nunca subas secretos a Git.

Variables utilizadas por los flujos principales:

```env
APP_BASE_URL=http://localhost:3000
DATABASE_URL=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
```

`SUPABASE_SECRET_KEY` y `DATABASE_URL` son server-only. No deben existir equivalentes `NEXT_PUBLIC_*`.

## Desarrollo

```powershell
npm run dev
```

Por defecto Next usa `http://localhost:3000` si el puerto está libre.

## Validaciones normales

Antes de integrar cambios:

```powershell
npm run lint
npm run typecheck
npm run test
npm run format:check
npm run build
```

Base de datos:

```powershell
npm run db:check
npm run db:generate
npm run db:migrate
```

`db:migrate` requiere un `DATABASE_URL` autorizado. No ejecutar migraciones contra producción desde una sesión de desarrollo sin una operación explícita y controlada.

## E2E READ_ONLY

La suite normal de Playwright es de lectura/no escritura y levanta una app local en loopback:

```powershell
npx playwright install chromium
npm run e2e
```

También están disponibles:

```powershell
npm run e2e:headed
npm run e2e:ui
```

Ver [`docs/E2E.md`](docs/E2E.md).

## E2E WRITE_DEV

Las pruebas que crean/modifican datos reales están **bloqueadas por defecto** y sólo pueden ejecutarse contra el entorno DEV autorizado.

Ejemplo:

```powershell
$env:E2E_ALLOW_WRITES="I_ACCEPT_E2E_DEV_WRITES"
npm run e2e:dev -- e2e/write/<spec>.write.spec.ts
Remove-Item Env:E2E_ALLOW_WRITES -ErrorAction SilentlyContinue
```

Los fixtures WRITE_DEV usan recursos temporales run-scoped y cleanup por IDs exactos. No se permiten `TRUNCATE`, borrados amplios ni escrituras de producción.

## Modelo de acceso

- `platform_role = ADMIN`: administración de la plataforma;
- `OWNER` / `STAFF`: roles por comercio en `merchant_users`;
- comprador: usuario autenticado sin privilegios merchant/admin especiales.

Las páginas y mutaciones merchant validan sesión, perfil activo, membership y `merchantId` exacto en servidor. RLS agrega una segunda frontera para el acceso directo mediante Supabase.

## Onboarding de comercios

Flujo resumido:

```text
/sumar-comercio
  → solicitud PENDING
  → aprobación ADMIN
  → Merchant DRAFT
  → OWNER configura operación/pagos/catálogo
  → readiness completo
  → activación ADMIN
  → Merchant ACTIVE y visible públicamente
```

Detalle: [`docs/MERCHANT_ONBOARDING.md`](docs/MERCHANT_ONBOARDING.md).

## Estructura

```text
src/
├── app/                     # Next App Router + Server Actions
├── components/              # UI pública, comprador y merchant
├── domain/                  # reglas puras
├── application/             # casos de uso y wiring
├── infrastructure/
│   ├── db/                  # Drizzle, repositorios y schema
│   ├── storage/             # Storage server-side
│   └── supabase/            # SSR/Auth helpers
├── server/                  # autorización y políticas server-side
├── lib/                     # utilidades puras/compartidas
└── styles/

e2e/
├── lib/                     # guards y fixtures
├── write/                   # suites WRITE_DEV explícitas
└── *.spec.ts                # smokes READ_ONLY

drizzle/                     # migraciones SQL versionadas
```

## Documentación

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/DOMAIN.md`](docs/DOMAIN.md)
- [`docs/PERSISTENCE.md`](docs/PERSISTENCE.md)
- [`docs/E2E.md`](docs/E2E.md)
- [`docs/MERCHANT_ONBOARDING.md`](docs/MERCHANT_ONBOARDING.md)
- [`docs/ROADMAP.md`](docs/ROADMAP.md)
- [`docs/CHECKPOINTS.md`](docs/CHECKPOINTS.md)

## Licencia

Proyecto privado de Pedilo. No distribuir, reutilizar ni publicar el código sin autorización.