# Roadmap — Pedilo

## Estado general

Pedilo ya superó la etapa de MVP técnico y se encuentra en **pre-piloto**. Los flujos principales de comprador, comercio y administración están implementados y cuentan con cobertura automatizada, incluida una batería WRITE_DEV controlada contra el entorno de desarrollo.

## Fases

1. **Fundación técnica — completada**
   - Next.js App Router, TypeScript strict, Tailwind, lint/format/build CI.
   - arquitectura domain/application/infrastructure/server.

2. **Dominio + persistencia — completada**
   - PostgreSQL/Supabase + Drizzle.
   - dinero en cents, catálogo, pedidos, entregas, usuarios y geografía.
   - migraciones versionadas y RLS baseline.

3. **Auth + administración + onboarding — completada**
   - Supabase Auth SSR.
   - ADMIN, `OWNER` y `STAFF`.
   - solicitud pública `/sumar-comercio`.
   - revisión ADMIN, Merchant `DRAFT`, invitación/asignación de OWNER.
   - readiness y activación manual `DRAFT → ACTIVE`.

4. **Catálogo + imágenes — completada**
   - categorías y productos.
   - stock `TRACKED` / `NOT_TRACKED`.
   - opciones y grupos de opciones.
   - imágenes de producto y portada con Storage privado + URLs firmadas en backoffice.

5. **Storefront + discovery público — completada**
   - zona pública.
   - categorías de marketplace.
   - búsqueda/descubrimiento de comercios.
   - storefront de comercio con disponibilidad real.
   - experiencia responsive y visual Pedilo.

6. **Comprador: carrito + checkout + cuenta — completada**
   - carrito persistente.
   - cantidades, opciones y notas.
   - retiro y delivery propio.
   - mínimos de compra y costos de envío.
   - review autoritativo y revalidación al confirmar.
   - idempotencia y recuperación ante respuestas perdidas.
   - cuenta e historial de pedidos.

7. **Operación merchant de pedidos — completada**
   - inbox operativo merchant-scoped.
   - aceptar/rechazar.
   - preparación → listo.
   - retiro completado.
   - delivery propio `PENDING → IN_TRANSIT → DELIVERED` con cierre del Order.
   - cancelación/restock transaccional.
   - Realtime privado y alertas de nuevos pedidos.

8. **Hardening y pre-piloto — en curso**
   - batería E2E buyer/merchant real en DEV: completada para los escenarios críticos.
   - multitenancy merchant y RLS adversarial: completado.
   - pulido de warnings, fallbacks públicos, accesibilidad y documentación: en curso.
   - QA responsive final en teléfonos reales: pendiente.
   - recuperación de contraseña pública (“Olvidé mi contraseña”): implementada; pendiente validar entrega real de email/callback en DEV.
   - revisión de vulnerabilidades/dependencias y observabilidad operativa: pendiente.
   - preparación de entorno de producción, dominio, HTTPS, variables, backups/logs: pendiente.

9. **Piloto Rawson + Playa Unión — siguiente hito**
   - cargar un comercio real de manera controlada.
   - catálogo real.
   - pedidos de prueba desde teléfonos reales.
   - retiro + delivery propio.
   - panel merchant en operación real.
   - verificar notificaciones, stock, cancelaciones y soporte operativo.
   - medir problemas antes de ampliar cobertura.

10. **Red de repartidores — futura**
    - modelo de repartidor desde el diseño técnico.
    - asignación y estados de entrega.
    - disponibilidad/zonas.
    - sin activar operativamente hasta validar el marketplace base.

11. **Logística avanzada — futura**
    - múltiples operadores y reglas de asignación.
    - seguimiento más rico.
    - optimización de cobertura y tiempos.

12. **Monetización — futura**
    - definir comisiones, abonos u otros modelos sólo después de validar el piloto.

13. **Expansión Trelew — futura**

14. **Expansión Puerto Madryn — futura**

## Criterio para pasar a piloto

No se requiere “cero bugs” para comenzar un piloto controlado, pero sí:

- seguridad de tenant validada;
- checkout y pedidos sin corrupción de stock ni dobles órdenes;
- cancelación/rechazo/restock consistentes;
- onboarding y activación de comercios utilizables;
- operación merchant completa para retiro y delivery propio;
- experiencia móvil suficientemente estable;
- entorno productivo separado de DEV;
- estrategia mínima de logs, backups y recuperación;
- canal operativo para resolver incidentes del comercio piloto.

Las funcionalidades posteriores no deben bloquear el piloto si no comprometen seguridad, dinero, pedidos, stock o capacidad de recuperación.
