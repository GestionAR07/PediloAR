# Public storefront / discovery (Fase 5)

Checkpoint: `PUBLIC_STOREFRONT_DISCOVERY_READY_MANUAL_VALIDATION_PENDING`

## Rutas públicas

| Ruta                      | Rol                                     |
| ------------------------- | --------------------------------------- |
| `/`                       | Discovery: selector de zona + comercios |
| `/comercios/[merchantId]` | Catálogo público del comercio           |

Sin login. Usuarios autenticados también pueden navegar `/` (no redirect a `/merchant` o `/admin`).

## Zona

- Fuente: `zones` + `cities` en DB (no IDs hardcodeados).
- Selección: query `/?zone=<zoneId>` (compartible) + `localStorage` como conveniencia.
- Sin GPS / mapas.

## Filtrado de comercios

Solo `status = ACTIVE`.

Aparece en una zona si:

- pickup habilitado y `merchants.zone_id` = zona elegida, **o**
- delivery propio habilitado y hay `merchant_delivery_zones` activa para esa zona.

`DRAFT` / `SUSPENDED`: no públicos.

## Disponibilidad operativa

Reutiliza `getMerchantOperationalStatus` / `isMerchantOperationallyAcceptingOrders`.

Copy comprador:

- ACCEPTING → Disponible
- pause temporal/manual → Pausado temporalmente

`paused_until` pasado ⇒ disponible (sin mutar DB).

Horarios: si hay `merchant_opening_intervals` y timezone válida, puede mostrar Abierto/Cerrado; si no, neutral.

## Catálogo

- Categorías `active = true`
- Productos `active = true`
- Comprabilidad: `isProductOperationallyAvailable`
- `available=false` → visible “No disponible”
- stock 0 TRACKED → visible “Sin stock”
- `active=false` → oculto

Opciones: labels de presentation helpers (no SINGLE/MULTIPLE/QUANTITY crudos).

## Imágenes

Bucket `product-images` sigue **private**.

Signed URLs server-side (`createProductImageSignedUrls`) vía service role.

No se persisten. TTL 1h.

Futuro posible: bucket público / CDN — fuera de esta fase.

## Seguridad / RLS

Read models en `src/application/storefront` con `DATABASE_URL` server-side.

No se abrió `anon SELECT *` en products/merchants.

DTOs públicos no incluyen emails, user ids, memberships ni secretos.

## Fuera de alcance

Carrito, checkout, órdenes, pagos procesados, Realtime, ratings, merchant logo storage, slugs nuevos.
