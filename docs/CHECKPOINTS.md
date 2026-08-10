# Checkpoints

## Completados (conceptuales / previos)

### `PROJECT_ARCHITECTURE_V1_APPROVED`

Arquitectura general aprobada: monolito modular, Next.js App Router, TypeScript strict, Tailwind, PostgreSQL/Supabase y Drizzle previstos, mobile-first, separación UI/dominio/aplicación/infraestructura, `Order` ≠ `Delivery`, carrito local previsto, pagos iniciales cliente→comercio, `PLATFORM_DELIVERY` futuro.

## En validación / listos al cerrar Fase 1

### `BASE_TECH_FOUNDATION_READY`

Criterios:

- App Next.js inicia y construye en producción
- TypeScript strict
- Tailwind operativo
- ESLint, Prettier, Vitest y scripts de validación
- CI en GitHub Actions
- `.env.example` sin secretos
- Documentación inicial (`README`, `ARCHITECTURE`, `ROADMAP`, `CHECKPOINTS`)
- Sin lógica de marketplace (auth, catálogo, carrito, pedidos, delivery, etc.)

Estado: **listo** — validaciones de Fase 1 en PASS y commit de fundación técnica.
