# Checkpoints — Pedilo

Este archivo resume hitos funcionales relevantes. Los commits históricos detallados permanecen en Git; los checkpoints sirven como referencia de producto, no como sustituto del historial.

## Fundación

### `PROJECT_ARCHITECTURE_V1_APPROVED`

Arquitectura general del proyecto aprobada.

### `BASE_TECH_FOUNDATION_READY`

Next.js/TypeScript/Tailwind, calidad y estructura base operativas.

### `CORE_DOMAIN_MODEL_HARDENED`

Dominio y reglas principales validados.

### `CORE_PERSISTENCE_SCHEMA_VALIDATED`

PostgreSQL + Drizzle + migraciones base aplicadas/validadas en DEV.

### `AUTH_FOUNDATION_VALIDATED`

Supabase Auth SSR, perfiles, roles, login/logout, ADMIN y memberships merchant validados.

## Catálogo y storefront

### `PRODUCT_IMAGES_STORAGE_READY`

Imágenes de producto con Storage y persistencia de path validadas.

### `PUBLIC_STOREFRONT_DISCOVERY_VALIDATED`

Discovery público, zonas, categorías, tarjetas de comercio y storefront responsive validados.

### `MERCHANT_STOREFRONT_CATALOG_VALIDATED`

Catálogo público con disponibilidad, stock, opciones y presentación de comercio integrado.

## Comprador

### `BUYER_CART_CHECKOUT_VALIDATED`

Carrito persistente, checkout, retiro/delivery, pagos, mínimos y review autoritativo funcionales.

### `BUYER_ORDER_IDEMPOTENCY_VALIDATED`

Confirmación idempotente y recuperación ante respuesta perdida validadas.

### `BUYER_ADVERSARIAL_CHECKOUT_VALIDATED`

Carreras de stock, requote, producto que deja de estar disponible y configuración de opciones obsoleta bloqueadas correctamente.

### `BUYER_CRITICAL_E2E_VALIDATED`

Batería crítica WRITE_DEV comprador/comercio cerrada: no hay persistencia ni descuento de stock cuando una revalidación invalida el pedido.

## Operación merchant

### `MERCHANT_ORDER_READ_ONLY_INBOX_READY`

Inbox merchant-scoped y detalle de pedido disponibles.

### `MERCHANT_ORDER_LIFECYCLE_VALIDATED`

Flujo `PENDING → ACCEPTED → PREPARING → READY → COMPLETED` validado para retiro.

### `MERCHANT_DELIVERY_LIFECYCLE_VALIDATED`

Delivery propio `PENDING → IN_TRANSIT → DELIVERED` y finalización de Order validados sin doble descuento de stock.

### `ORDER_CANCELLATION_RESTOCK_READY`

Cancelación/rechazo transaccional y restitución de stock validados.

### `MERCHANT_REALTIME_PRIVATE_VALIDATED`

Realtime de pedidos merchant-scoped y alertas de nuevos pedidos integrados.

## Onboarding

### `MERCHANT_ONBOARDING_ACTIVE_FLOW_VALIDATED`

Flujo actual validado:

```text
solicitud pública
→ aprobación ADMIN
→ Merchant DRAFT
→ OWNER configura comercio
→ readiness completo
→ activación ADMIN
→ ACTIVE visible en Pedilo
```

El E2E automatizado DEV valida el producto completo usando un OWNER temporal ya confirmado; la entrega real de email se revalida manualmente cuando cambia Auth/SMTP/template.

## Seguridad

### `MERCHANT_MULTITENANCY_SECURITY_VALIDATED`

Validado en DEV:

- `STAFF` accede a su propio workspace;
- el mismo usuario recibe `forbidden` al intentar rutas equivalentes de otro comercio;
- RLS sólo expone el Merchant del que es miembro;
- un `UPDATE` directo autenticado sobre `merchants` es rechazado y no modifica el estado autoritativo;
- catálogo, delivery, pagos, portada, disponibilidad y pedidos mantienen autorización server-side merchant-scoped.

Merge de referencia: PR #17, `92878e3` en `main`.

## Estado actual

### `PRE_PILOT_POLISH_IN_PROGRESS`

Trabajo actual:

- eliminar warnings conocidos;
- endurecer fallbacks públicos;
- accesibilidad y responsive final;
- actualizar documentación operativa;
- revisar dependencias/observabilidad;
- preparar recuperación de contraseña pública;
- preparar entorno productivo separado de DEV.

## Próximo checkpoint objetivo

### `PRE_PILOT_READY`

Se alcanza cuando el producto queda listo para una prueba controlada con un comercio real de Rawson/Playa Unión, teléfonos reales y operación supervisada, sin mezclar DEV con producción.
