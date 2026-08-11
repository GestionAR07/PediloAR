# Dominio — Marketplace Rawson

Checkpoint de esta fase: `CORE_DOMAIN_MODEL_HARDENED` (Fase 2A.1).

El dominio vive en `src/domain` como TypeScript puro: sin React, Next.js, Supabase, Drizzle, HTTP ni variables de entorno.

## 1. Geografía

```text
Province
└── City
     └── Zone
```

- `City.timezone` es IANA (p. ej. futuro `America/Argentina/Catamarca` para Rawson).
- El piloto Chubut → Rawson → (Centro, Playa Unión, …) **no** está hardcodeado en reglas.
- Sin GIS, mapas ni coordenadas obligatorias.
- No existe entidad `Market` todavía.

## 2. Comercio

`Merchant` con estados: `DRAFT` | `ACTIVE` | `SUSPENDED`.

### Flags de fulfillment (semántica)

| Flag                      | Significado                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------- |
| `pickupEnabled`           | El comercio ofrece retiro en local (checkout/validación de método).                |
| `merchantDeliveryEnabled` | El comercio **puede** ofrecer delivery propio. **No** implica cobertura universal. |
| `platformDeliveryEnabled` | Flag conceptual de red de couriers; **bloqueado en MVP**.                          |

Para habilitar checkout con **delivery propio** deben cumplirse **además**:

1. `merchantDeliveryEnabled === true`
2. Existe `MerchantDeliveryZone` para el `zoneId` destino
3. Esa zona está `active`
4. `orderSubtotalCents >= minimumOrderCents`

Función de dominio: `resolveMerchantDeliveryForZone` (retorna fee/mínimo/ETA aplicables o error).

`platformDeliveryEnabled` permanece operacionalmente deshabilitado (`assertFulfillmentAllowedForMvp` rechaza `PLATFORM_DELIVERY`).

Relación `MerchantUser`: roles MVP `OWNER` | `STAFF` (sin auth todavía).

### Horarios

Múltiples `MerchantOpeningInterval` por día (horarios partidos).

- Representación: `weekday` + `openMinute` / `closeMinute` en minuto local del día.
- Evaluación actual: `isOpenAtLocalMinute(intervals, weekday, localMinute)`.
- **Checkout (futuro):** la capa de aplicación debe convertir `instant + City.timezone` → `(weekday, localMinute)` con infraestructura de fechas/zonas. El dominio **no** simula TZ (evita resultados incorrectos sin librería IANA).
- La representación partida actual es **suficiente** una vez el application layer aporta el minuto local correcto.

### Cobertura

`MerchantDeliveryZone` (fee, mínimo, ETA, active) — sin distancias ni mapas.

Pagos informativos: `CASH` | `TRANSFER` | `MERCADO_PAGO`. La plataforma no procesa dinero en MVP.

## 3. Catálogo

Dos taxonomías distintas:

| Concepto              | Alcance                          |
| --------------------- | -------------------------------- |
| `MarketplaceCategory` | Taxonomía global del marketplace |
| `MerchantCategory`    | Secciones internas del comercio  |

`Product`: precio en cents, `active` / `available`, stock `NOT_TRACKED` | `TRACKED`.

Reglas de dominio actuales (`isProductSellable`, `assertProductStock`): validan forma y sellability local.

**Checkout / persistencia (futuro, no simulado en dominio):**

- disponibilidad en el momento de confirmar;
- stock `TRACKED` y decremento;

se validarán **transaccionalmente en servidor**. No hay reserva concurrente ni simulación de race en domain.

Grupos de opciones (`ProductOptionGroup` + `ProductOptionChoice`):

| Modo       | Uso                                        |
| ---------- | ------------------------------------------ |
| `SINGLE`   | Una elección (tamaño)                      |
| `MULTIPLE` | Varias elecciones (extras)                 |
| `QUANTITY` | Cantidades por variedad (docena empanadas) |

## 4. Fulfillment

```text
PICKUP
MERCHANT_DELIVERY
PLATFORM_DELIVERY   ← conceptual; deshabilitado en MVP
```

No confundir con estados de Order ni de Delivery.

Compatibilidad Order ↔ Delivery (puro): `assertOrderDeliveryCompatibility`

| Fulfillment         | Delivery                           |
| ------------------- | ---------------------------------- |
| `PICKUP`            | No debe existir Delivery           |
| `MERCHANT_DELIVERY` | Si existe, `provider === MERCHANT` |
| `PLATFORM_DELIVERY` | Si existe, `provider === PLATFORM` |

No se exige que Delivery exista en el instante de construir el Order (creación atómica Order+Delivery es capa application/persistencia).

## 5. Order

Compromiso comercial. Estados:

```text
PENDING → ACCEPTED → PREPARING → READY → COMPLETED
                 ↘        ↘         ↘        ↘
                  CANCELED (desde estados no terminales)
```

Terminales: `COMPLETED`, `CANCELED`.

**No** incluye `OUT_FOR_DELIVERY` / `PICKED_UP` / `ASSIGNED` (son logísticos).

### Relación con Delivery

- Order **no** tiene `deliveryId`.
- La relación es unidireccional: `Delivery.orderId` → `Order.id`.
- En Fase 2B: FK + UNIQUE sobre `Delivery.orderId`.

### Cancelación (política de dominio)

`canCancelOrder` / `assertCanCancelOrder` — actores:

| Actor           | Regla MVP                                                     |
| --------------- | ------------------------------------------------------------- |
| `CUSTOMER`      | Solo `PENDING`                                                |
| `MERCHANT_USER` | `PENDING`, `ACCEPTED`, `PREPARING`, `READY`                   |
| `ADMIN`         | Cualquier no terminal (intervención auditable en application) |
| `SYSTEM`        | Solo con `cancelReason` explícito controlado                  |

- `COMPLETED` y `CANCELED` nunca se cancelan de nuevo.
- Si existe Delivery en `IN_TRANSIT`: **no** se permite cancelación normal del Order. Primero fallar/cancelar la Delivery; luego application/admin.

Campos: `canceledAt`, `canceledBy`, `cancelReason`.

### Compleción

`canCompleteOrder`:

| Fulfillment                               | Condición `READY → COMPLETED`           |
| ----------------------------------------- | --------------------------------------- |
| `PICKUP`                                  | Comercio confirma retiro (sin Delivery) |
| `MERCHANT_DELIVERY` / `PLATFORM_DELIVERY` | Delivery asociada en `DELIVERED`        |

No se agregan estados logísticos a Order.

### Idempotencia

`idempotencyKey` validada en dominio (`parseIdempotencyKey`):

- rechaza vacío / solo whitespace;
- aplica **trim**;
- longitud mín/máx razonable;
- permite UUID y tokens seguros;
- **no** convierte a lowercase;
- **no** genera la key en dominio.

**Fase 2B:** constraint `UNIQUE` de persistencia sobre `idempotencyKey`.

`OrderEvent` para auditoría de transiciones.

## 6. Delivery

Entidad **separada** de Order. Providers: `MERCHANT` | `PLATFORM`.

Referencia: `orderId` (único conceptualmente; UNIQUE en 2B).

### MERCHANT (MVP)

```text
PENDING → IN_TRANSIT → DELIVERED
        ↘ FAILED / CANCELED
```

No usa `REQUESTED` / `ASSIGNED` / `PICKED_UP`.

### PLATFORM (conceptual)

```text
PENDING → REQUESTED → ASSIGNED → PICKED_UP → IN_TRANSIT → DELIVERED
```

con `FAILED` / `CANCELED` desde no terminales. Sin matching, courier ni GPS.

## 7. Order vs Delivery

```text
PICKUP:
  Order READY → COMPLETED al retirar
  (sin Delivery)

MERCHANT_DELIVERY / PLATFORM_DELIVERY:
  Order + Delivery(provider compatible)
  Order COMPLETED solo si Delivery = DELIVERED
```

Las máquinas **no** están acopladas automáticamente; políticas puras deciden cancelación y compleción con contexto opcional de Delivery.

## 8. Snapshots

Al confirmar:

- `OrderItem`: productId, name snapshot, unit price, qty, line total, notes
- opciones: group name, choice name, price delta, **quantity**
- método de pago + instrucciones
- dirección de entrega (city/zone/street/number/…)

El catálogo puede cambiar después; el pedido histórico no.

## 9. Dinero

`MoneyCents`: entero minor units (centavos). Sin `float`.

Validación de inputs **y resultados** de suma/multiplicación:

- integer + `Number.isSafeInteger`
- no NaN / no negativos en precios y totales
- **overflow** de operación → `MONEY_OVERFLOW`

No hay techo comercial arbitrario (p. ej. $10M); solo seguridad del integer de JS.

## 10. Carrito

**No** hay `Cart` / `CartItem` de servidor. MVP: carrito local en navegador → checkout recalcula en servidor (Fases posteriores).

## 11. Idempotencia

Ver sección Order. Campo en Order; unique en 2B.

## 12. Diferido (no en 2A.1)

- PostgreSQL / Supabase / Drizzle / migraciones
- Auth / sesiones
- CourierProfile / matching / GPS
- PaymentIntent / liquidaciones
- Checkout HTTP / UI de negocio / `createOrder`
- Seed de Rawson/Playa Unión
- Concurrencia / reserva de stock transaccional
- Unique de `idempotencyKey` en DB
- Conversión timezone (ISO/IANA) para horarios en checkout

## Diagrama textual

```text
Province → City → Zone
              ↑
           Merchant ── MerchantDeliveryZone → Zone
              │
              ├── MerchantCategory → Product → OptionGroup → OptionChoice
              │                         │
              └── MarketplaceCategory ──┘ (N:N)

Checkout (futuro):
  local cart → validate → Order (+ OrderItems snapshots)
                              ▲
                              │ orderId
                           Delivery? (si delivery)

Order status machine ≠ Delivery status machine
Order NO tiene deliveryId
```
