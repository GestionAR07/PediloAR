# Local cart + product configurator (Fase 6A)

Checkpoint: `LOCAL_CART_CONFIGURATOR_READY_MANUAL_VALIDATION_PENDING`

## Scope

- Interactive product option selection (SINGLE / MULTIPLE / QUANTITY)
- Browser-local cart (`localStorage`, versioned key)
- Single-merchant cart rule with explicit replace confirmation
- MoneyCents estimates for UX only

## Out of scope (Fase 6B)

- Orders / order_items / deliveries
- Checkout write path
- Authoritative server-side price/stock/availability revalidation
- Payment / address / shipping calculation

## Trust boundary

Cart snapshots (names, unit prices, configuration) are **not** authoritative.
Checkout must recalculate from DB and ignore browser-sent money totals.

## Storage

- Key: `marketplace-rawson-cart-v1`
- Corrupt JSON / wrong version → empty cart (no runtime crash)
- Never read `localStorage` during SSR
- Never persist signed image URLs

## Manual QA

See phase checklist A–S in the Fase 6A brief (Empanadas 6/3/3 merge, persistence, stock/paused gates, cross-merchant confirm, 390px).
