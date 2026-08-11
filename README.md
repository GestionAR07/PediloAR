# Marketplace Rawson

Infraestructura digital para el comercio local, orientada inicialmente a **Rawson y Playa Unión** (Chubut, Argentina).

Permite descubrir comercios, comprar, pedir con retiro o delivery, y digitalizar negocios con poca presencia online. La expansión prevista incluye Trelew y Puerto Madryn.

## Estado actual

**Fase 2B — Persistencia** (`CORE_PERSISTENCE_SCHEMA_*`).

Dominio puro validado en `src/domain`. Schema PostgreSQL/Drizzle y migraciones versionadas. **Todavía no** hay Auth, checkout, UI comercial ni operaciones de marketplace.

## Stack

| Área            | Tecnología                                |
| --------------- | ----------------------------------------- |
| Framework       | Next.js (App Router)                      |
| UI              | React + Tailwind CSS                      |
| Lenguaje        | TypeScript (`strict`)                     |
| Package manager | npm                                       |
| Tests           | Vitest                                    |
| Calidad         | ESLint + Prettier                         |
| Deploy previsto | Vercel (aún no conectado)                 |
| Datos           | PostgreSQL / Supabase + Drizzle (Fase 2B) |

## Requisitos

- Node.js 20+ (recomendado LTS)
- npm 10+

En Windows (PowerShell), si algún script de npm falla por política de ejecución, podés usar `npm.cmd` en lugar de `npm`.

## Instalación

```powershell
cd C:\Projects\MarketPlaceRawson\MarketPlaceRawson
npm install
copy .env.example .env.local
```

Configurá `DATABASE_URL` en `.env.local` solo para Postgres de **desarrollo**. **No subas secrets a Git.**

## Desarrollo

```powershell
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

## Base de datos (Fase 2B)

```powershell
npm run db:generate
npm run db:check
npm run db:migrate   # requiere DATABASE_URL de desarrollo
```

Detalle: [`docs/PERSISTENCE.md`](docs/PERSISTENCE.md).

## Validaciones

```powershell
npm run lint
npm run typecheck
npm run test
npm run format:check
npm run db:check
```

Formatear el código:

```powershell
npm run format
```

## Build de producción

```powershell
npm run build
npm run start
```

## Estructura básica

```text
src/
├── app/
├── components/
├── features/
├── domain/                 # Reglas puras (sin React / sin DB)
├── application/
├── infrastructure/db/      # Drizzle schema + client server-only
├── server/
├── lib/
└── styles/

drizzle/                    # Migraciones SQL versionadas
```

Docs: [`ARCHITECTURE`](docs/ARCHITECTURE.md) · [`DOMAIN`](docs/DOMAIN.md) · [`PERSISTENCE`](docs/PERSISTENCE.md) · [`ROADMAP`](docs/ROADMAP.md) · [`CHECKPOINTS`](docs/CHECKPOINTS.md).

## Licencia

Uso privado del proyecto Marketplace Rawson.
