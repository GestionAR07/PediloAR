# Marketplace Rawson

Infraestructura digital para el comercio local, orientada inicialmente a **Rawson y Playa Unión** (Chubut, Argentina).

Permite descubrir comercios, comprar, pedir con retiro o delivery, y digitalizar negocios con poca presencia online. La expansión prevista incluye Trelew y Puerto Madryn.

## Estado actual

**Fase 1 — Fundación técnica** (`BASE_TECH_FOUNDATION_READY` en curso de validación).

Hay un proyecto Next.js operativo con TypeScript estricto, Tailwind, lint, formato, tests y CI. **Todavía no** hay marketplace: sin autenticación, catálogo, carrito, pedidos ni base de datos.

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
| Datos previstos | PostgreSQL / Supabase + Drizzle (Fase 2+) |

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

`.env.local` es solo para tu máquina. **No lo subas a Git.** En Fase 1 no hace falta ninguna variable real; Supabase se documentará en `.env.example` en la fase de datos.

## Desarrollo

```powershell
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

## Validaciones

```powershell
npm run lint
npm run typecheck
npm run test
npm run format:check
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
├── app/                 # Rutas Next.js (App Router)
├── components/
│   ├── ui/              # Primitivas visuales compartidas
│   └── layout/          # Layouts de página
├── features/            # Módulos por dominio funcional (vacío en Fase 1)
├── domain/              # Reglas de negocio puras (sin React)
├── application/         # Casos de uso
├── infrastructure/      # Integraciones externas
├── server/              # Utilidades solo servidor
├── lib/                 # Utilidades compartidas
└── styles/              # Estilos globales
```

Más detalle en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), roadmap en [`docs/ROADMAP.md`](docs/ROADMAP.md) y checkpoints en [`docs/CHECKPOINTS.md`](docs/CHECKPOINTS.md).

## Licencia

Uso privado del proyecto Marketplace Rawson.
