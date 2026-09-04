# Dependency security — Pedilo

## Auditoría pre-piloto 2026-09-04

Se ejecutó `npm audit --json` sobre el lockfile actual de Pedilo con Node.js 22 / npm 10 en GitHub Actions.

Resultado:

- 4 vulnerabilidades `moderate`;
- 0 `high`;
- 0 `critical`;
- las 4 observaciones pertenecen a tooling de desarrollo, no al runtime productivo de Next.js.

## Cadena reportada

```text
drizzle-kit (devDependency)
└── @esbuild-kit/esm-loader
    └── @esbuild-kit/core-utils
        └── esbuild <= 0.24.2
```

El advisory involucrado es `GHSA-67mh-4wv8-2f99`: versiones antiguas de esbuild permiten que otros sitios web interactúen con su servidor de desarrollo por una configuración CORS demasiado permisiva.

`@esbuild-kit/esm-loader` y `@esbuild-kit/core-utils` son dependencias transitivas de `drizzle-kit`. Pedilo no las declara como dependencias de runtime ni las necesita para servir la aplicación en producción.

## Decisión actual

No se aplica automáticamente el “fix” sugerido por `npm audit`, porque propone una versión anterior de `drizzle-kit` (`0.18.1`) y supondría un downgrade incompatible con el stack actual.

Tampoco se fuerza todavía un `override` de esbuild únicamente para silenciar el scanner. Un override transitorio debe probarse específicamente contra `db:check`, `db:generate` y `db:migrate` antes de adoptarse, porque modifica dependencias internas de la herramienta de migraciones.

Para el pre-piloto se mantiene `drizzle-kit` como tooling de desarrollo y se considera el riesgo residual acotado siempre que:

- Drizzle/esbuild no se expongan como servidores de desarrollo accesibles desde redes no confiables;
- las herramientas de migración no se ejecuten en el runtime productivo;
- no se copien `devDependencies` innecesarias a una imagen/runtime de producción;
- se siga monitoreando una actualización upstream que elimine la cadena `@esbuild-kit/*` vulnerable.

## Política de actualización

Dependabot revisa semanalmente dependencias npm y GitHub Actions. Sus PRs deben pasar la misma validación que cualquier otro cambio: lint, typecheck, tests, Prettier, build y Playwright READ_ONLY.

Cambios mayores o correcciones que afecten Drizzle, Supabase, Next.js o el flujo de pedidos requieren validación adicional específica antes de mergear.

## Próxima revisión

Repetir esta auditoría antes de desplegar el entorno productivo definitivo y cada vez que se actualice `drizzle-kit` o cambie la estrategia de build/deploy.
