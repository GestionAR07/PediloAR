# Pedilo E2E (Playwright)

Pedilo usa Playwright en Chromium con dos modos deliberadamente separados:

- `READ_ONLY`: seguro por defecto y apto para CI;
- `WRITE_DEV`: manual/local, con escritura real sólo contra el proyecto DEV autorizado.

La suite nunca debe usar producción como destino de escritura.

## `READ_ONLY` — modo por defecto

```powershell
npm run e2e
npm run e2e:headed
npm run e2e:ui
```

Si `E2E_MODE` no está definido, se resuelve como `READ_ONLY`.

El servidor Next iniciado por Playwright:

- usa `http://127.0.0.1:3100` por defecto;
- usa `reuseExistingServer = false`;
- falla si el puerto está ocupado, en vez de reutilizar otra app;
- limpia `DATABASE_URL` y `SUPABASE_SECRET_KEY` antes de iniciar;
- ignora todos los archivos `*.write.spec.ts`.

La suite READ_ONLY cubre arranque, navegación pública, autenticación superficial, carrito vacío, responsive base y guards de destino. CI ejecuta únicamente este modo.

## `WRITE_DEV` — manual/local únicamente

Runner:

```powershell
$env:E2E_ALLOW_WRITES="I_ACCEPT_E2E_DEV_WRITES"
npm run e2e:dev -- e2e/write/<spec>.write.spec.ts
$code=$LASTEXITCODE
Remove-Item Env:E2E_ALLOW_WRITES -ErrorAction SilentlyContinue
Write-Host "EXIT_CODE=$code"
```

`npm run e2e:dev` establece `E2E_MODE=WRITE_DEV`, pero eso **no alcanza** para habilitar escrituras. El preflight es fail-closed y se ejecuta antes de levantar el servidor Next.

### Condiciones obligatorias

1. `E2E_MODE=WRITE_DEV`.
2. `E2E_ALLOW_WRITES=I_ACCEPT_E2E_DEV_WRITES` exactamente y suministrado por la shell actual.
3. Target de app sólo loopback (`localhost`, `127.0.0.1`, `::1`).
4. `NODE_ENV`, `VERCEL_ENV` y `MARKETPLACE_ENV` no pueden indicar producción.
5. `MARKETPLACE_DEV_PROJECT_REF` debe estar configurado.
6. `NEXT_PUBLIC_SUPABASE_URL` debe pertenecer exactamente al mismo proyecto DEV.
7. `DATABASE_URL` debe ser demostrablemente del mismo proyecto DEV, ya sea por host directo o pooler Supabase con identidad verificable.

Si la identidad del entorno no puede probarse, la suite **no arranca**. Los mensajes de guard no imprimen credenciales ni project refs sensibles.

## Aislamiento de recursos WRITE_DEV

Los tests con escritura usan markers y registros run-scoped. Cada fixture es responsable de borrar únicamente los IDs exactos que creó.

Reglas:

- sin `TRUNCATE`;
- sin reset global de tablas;
- sin `DELETE` amplio;
- sin borrar recursos ajenos al run actual;
- cleanup verificado;
- si quedan leftovers registrados, el test debe fallar visiblemente;
- no persistir el sentinel de autorización en `.env.local`.

Algunos fixtures leen geografía de un comercio DEV existente para crear entidades temporales, pero las suites aisladas no deben modificar su catálogo/configuración salvo que el propio spec documente explícitamente un recurso compartido y su rollback exacto.

## Cobertura WRITE_DEV actual

Las suites existentes bajo `e2e/write/` incluyen:

- `dev-database-canary.write.spec.ts`: canary reversible de escritura DEV;
- `buyer-order-flow.write.spec.ts`: pedido real de comprador;
- `buyer-adversarial.write.spec.ts`: carreras de stock/requote;
- `buyer-idempotent-retry.write.spec.ts`: retry después de respuesta perdida sin orden duplicada;
- `buyer-merchant-constraints.write.spec.ts`: mínimos, merchant pausado/cerrado después de review;
- `buyer-stale-catalog.write.spec.ts`: producto/opciones que cambian después del review;
- `merchant-realtime-lifecycle.write.spec.ts`: pedido → Realtime → ciclo merchant de retiro;
- `merchant-delivery-rejection-security.write.spec.ts`: delivery propio, rechazo/restock y aislamiento;
- `merchant-onboarding.write.spec.ts`: solicitud → DRAFT → configuración → activación → storefront público;
- `merchant-multitenancy-security.write.spec.ts`: aislamiento cross-merchant y RLS autenticada.

No todas las suites necesitan ejecutarse en cada cambio. La regla es correr el spec WRITE_DEV cuya frontera funcional fue modificada y mantener CI normal siempre en READ_ONLY.

## Invariantes críticos que ya tienen cobertura real DEV

- un pedido inválido no se persiste;
- stock `TRACKED` no se descuenta cuando falla la confirmación;
- retry idempotente no crea una segunda orden;
- merchant cerrado/pausado se revalida al confirmar;
- cambios de catálogo/opciones posteriores al review invalidan la confirmación;
- rechazo/cancelación repone stock una sola vez;
- delivery merchant finaliza sin doble descuento de stock;
- un `STAFF` no puede entrar al workspace de otro merchant;
- RLS no expone merchants ajenos y niega `UPDATE` directo autenticado;
- onboarding `DRAFT` no se publica antes de activación;
- activación requiere readiness completo.

## Guard de navegación

Todos los browser specs deben importar `test` desde `e2e/fixtures.ts` para heredar el guard de navegación.

Targets de producción conocidos, incluido `pedilo.store` y variantes, se rechazan. Una excepción READ_ONLY hacia un host DEV remoto requiere opt-in explícito y **nunca** habilita WRITE_DEV.

## Artifacts

En failure:

- screenshots: `test-results/`;
- trace: primera retry cuando corresponda;
- reporte HTML: `playwright-report/`.

Abrir reporte:

```powershell
npx playwright show-report
```

## CI

GitHub Actions ejecuta:

```text
lint
→ typecheck
→ Vitest
→ Prettier check
→ build
→ Playwright READ_ONLY
```

No agregar a CI ordinario el sentinel WRITE_DEV, `SUPABASE_SECRET_KEY` ni credenciales de base de datos con permisos de escritura.

## Estado pre-piloto

La base E2E crítica de comprador/comercio y multitenancy está validada. El trabajo pre-piloto pasa a concentrarse en responsive real, recuperación de contraseña pública, observabilidad/dependencias y preparación de producción, sin debilitar los guards existentes.
