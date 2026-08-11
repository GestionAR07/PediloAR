# Dominio — Marketplace Rawson

Checkpoint de esta fase: `CORE_DOMAIN_MODEL_VALIDATED` (Fase 2A).

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

Flags de fulfillment:

- `pickupEnabled`
- `merchantDeliveryEnabled`
- `platformDeliveryEnabled` (conceptual; MVP deshabilitado)

Relación `MerchantUser`: roles MVP `OWNER` | `STAFF` (sin auth todavía).

Horarios: múltiples `MerchantOpeningInterval` por día (horarios partidos). Evaluación con minuto local de la **ciudad**, no del navegador.

Cobertura: `MerchantDeliveryZone` (fee, mínimo, ETA, active) — sin distancias ni mapas.

Pagos informativos: `CASH` | `TRANSFER` | `MERCADO_PAGO`. La plataforma no procesa dinero en MVP.

## 3. Catálogo

Dos taxonomías distintas:

| Concepto              | Alcance                          |
| --------------------- | -------------------------------- |
| `MarketplaceCategory` | Taxonomía global del marketplace |
| `MerchantCategory`    | Secciones internas del comercio  |

`Product`: precio en cents, `active` / `available`, stock `NOT_TRACKED` | `TRACKED`.

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

## 5. Order

Compromiso comercial. Estados:

```text
PENDING → ACCEPTED → PREPARING → READY → COMPLETED
                 ↘        ↘         ↘        ↘
                  CANCELED (desde estados no terminales)
```

Terminales: `COMPLETED`, `CANCELED`.

**No** incluye `OUT_FOR_DELIVERY` / `PICKED_UP` / `ASSIGNED` (son logísticos).

Cancelación conceptual: `canceledAt`, `canceledBy` (`CUSTOMER` | `MERCHANT_USER` | `ADMIN` | `SYSTEM`), `cancelReason`.

`idempotencyKey` contemplado; unique constraint en Fase 2B.

`OrderEvent` para auditoría de transiciones.

## 6. Delivery

Entidad **separada** de Order. Providers: `MERCHANT` | `PLATFORM`.

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
  Order + Delivery(provider)
  Cuando Delivery = DELIVERED, la capa application (luego) puede completar Order
```

Las máquinas **no** están acopladas automáticamente en dominio.

## 8. Snapshots

Al confirmar:

- `OrderItem`: productId, name snapshot, unit price, qty, line total, notes
- opciones: group name, choice name, price delta, **quantity**
- método de pago + instrucciones
- dirección de entrega (city/zone/street/number/…)

El catálogo puede cambiar después; el pedido histórico no.

## 9. Dinero

`MoneyCents`: entero minor units (centavos). Sin `float`. Validación de integer / safe integer / no NaN / no negativos en precios y totales.

## 10. Carrito

**No** hay `Cart` / `CartItem` de servidor. MVP: carrito local en navegador → checkout recalcula en servidor (Fases posteriores).

## 11. Idempotencia

Campo `idempotencyKey` en Order. Persistencia unique en 2B.

## 12. Diferido (no en 2A)

- PostgreSQL / Supabase / Drizzle / migraciones
- Auth / sesiones
- CourierProfile / matching / GPS
- PaymentIntent / liquidaciones
- Checkout HTTP / UI de negocio
- Seed de Rawson/Playa Unión
- Reservas de stock concurrentes

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
                              │
                              └── Delivery? (si delivery)

Order status machine ≠ Delivery status machine
```
