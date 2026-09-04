# Merchant onboarding — Pedilo

Estado actual: `MERCHANT_ONBOARDING_ACTIVE_FLOW_VALIDATED`.

El alta de comercios es asistida: una solicitud pública pasa por revisión ADMIN, crea un comercio `DRAFT`, el propietario configura el comercio y luego un ADMIN lo activa manualmente cuando cumple los requisitos mínimos. Un comercio `DRAFT` no se publica en Pedilo.

## Variables de entorno

En `.env.local` (nunca commitear):

```env
APP_BASE_URL=http://localhost:3001
DATABASE_URL=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
```

| Variable              | Dónde            | Uso                                              |
| --------------------- | ---------------- | ------------------------------------------------ |
| `APP_BASE_URL`        | server-only      | Origen para redirects de invitación y recovery   |
| `DATABASE_URL`        | server-only      | Persistencia y consultas PostgreSQL              |
| `SUPABASE_SECRET_KEY` | server-only      | Auth Admin para invitaciones/usuarios            |
| `NEXT_PUBLIC_*`       | browser + server | Sesión SSR/cliente con clave pública             |

**Prohibido:** `NEXT_PUBLIC_SUPABASE_SECRET_KEY`.

La secret no autoriza al caller: las operaciones administrativas siguen requiriendo `requirePlatformAdmin()` y las operaciones merchant siguen requiriendo membresía/rol del comercio exacto.

## Configuración de Supabase Auth

### URL Configuration

En **Authentication → URL Configuration**, el Site URL y los Redirect URLs deben apuntar al host real del entorno. En desarrollo, por ejemplo:

```text
http://localhost:3001/auth/confirm
http://localhost:3001/**
```

Ajustar el puerto si el servidor local usa otro.

### Plantilla Invite user

La invitación debe usar el callback SSR de Pedilo con `token_hash`:

```html
<a
  href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/set-password"
>
  Aceptar invitación
</a>
```

Después de `verifyOtp(type=invite)`, `/auth/confirm` establece la sesión y redirige a `/set-password`.

### Plantilla Reset Password

La recuperación pública usa `resetPasswordForEmail` y el callback SSR existente. La plantilla de Supabase debe conservar el `token_hash` y `type=recovery`, por ejemplo:

```html
<a
  href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/set-password"
>
  Restablecer contraseña
</a>
```

El origen efectivo debe coincidir con la configuración del entorno y con `APP_BASE_URL`.

## Flujo de producto actual

```text
Usuario envía /sumar-comercio
  → MerchantApplication PENDING
  → ADMIN revisa y aprueba
  → Merchant DRAFT
  → ADMIN asigna/invita OWNER
  → OWNER accede a /merchant
  → OWNER configura operación, pagos y catálogo
  → ADMIN revisa readiness
  → ADMIN activa DRAFT → ACTIVE
  → comercio visible públicamente en Pedilo
```

La activación es **manual** y solo admite `DRAFT → ACTIVE`. La reactivación de `SUSPENDED` queda separada.

## Requisitos de activación

Un `DRAFT` no puede activarse hasta cumplir todos los requisitos aplicables:

- al menos un `OWNER` operativo y activo;
- retiro o delivery propio habilitado;
- si hay delivery propio, al menos una zona de delivery activa;
- al menos un medio de pago activo;
- al menos un producto activo y disponible dentro de una categoría activa;
- para productos con stock `TRACKED`, el stock debe ser mayor a cero.

Mientras está `DRAFT`, la ruta pública `/comercios/[merchantId]` no debe exponer el comercio. Después de la activación debe ser visible con su catálogo y medios de pago configurados.

## Superficies principales

| Ruta                             | Quién                                    |
| -------------------------------- | ---------------------------------------- |
| `/sumar-comercio`                | público — solicitud de alta              |
| `/forgot-password`               | público — solicitar recovery             |
| `/admin/merchant-applications`   | ADMIN — revisar solicitudes              |
| `/admin/merchants/[id]`          | ADMIN — readiness, OWNER y activación    |
| `/auth/confirm`                  | callback de Auth                         |
| `/set-password`                  | usuario autenticado post-invite/recovery |
| `/merchant`                      | usuario con membership activa            |
| `/merchant/[id]`                 | miembro de **ese** merchant              |
| `/merchant/[id]/catalog`         | OWNER/STAFF                              |
| `/merchant/[id]/delivery`        | OWNER/STAFF                              |
| `/merchant/[id]/payment-methods` | OWNER/STAFF                              |
| `/merchant/[id]/profile`         | OWNER/STAFF                              |

## Seguridad y aislamiento

- Admin client y `SUPABASE_SECRET_KEY`: server-only.
- La recuperación pública usa el cliente normal Supabase y no utiliza Auth Admin/service-role.
- La respuesta exitosa de recovery es neutral y no revela si un email está registrado.
- Las rutas merchant validan la sesión real, perfil activo y membership del `merchantId` exacto.
- `OWNER` y `STAFF` son roles de `merchant_users`, no `platform_role`.
- Un miembro de un comercio no puede leer el workspace de otro comercio.
- Las mutaciones de catálogo, delivery, pagos, portada, disponibilidad y pedidos pasan por autorización server-side merchant-scoped.
- RLS permanece deny-by-default para escrituras autenticadas directas sobre tablas merchant; no se agregan policies permisivas `USING (true)`.

La batería WRITE_DEV de multitenancy valida además que un `STAFF` puede usar su propio workspace, recibe `forbidden` al navegar al de otro comercio y que un `UPDATE` directo autenticado sobre `merchants` no altera el estado autoritativo.

## Validación automatizada DEV

`e2e/write/merchant-onboarding.write.spec.ts` valida de punta a punta:

1. solicitud pública;
2. persistencia `PENDING`;
3. aprobación ADMIN;
4. creación de Merchant `DRAFT`;
5. comercio no visible públicamente antes de activar;
6. asignación de OWNER existente y confirmado;
7. configuración de medio de pago;
8. creación de categoría y producto;
9. readiness completo;
10. activación ADMIN;
11. estado `ACTIVE`;
12. storefront público con producto y medio de pago;
13. cleanup exacto de recursos temporales.

**Importante:** este E2E automatizado usa un OWNER temporal ya confirmado para evitar depender de correo externo. Por lo tanto prueba el onboarding y la activación de producto, pero **no prueba entrega real del email de invitación**. Si se cambia proveedor SMTP, plantilla o Redirect URL, la recepción del email debe revalidarse manualmente.

## Checklist manual antes de piloto

1. Confirmar Site URL y Redirect URLs del entorno.
2. Confirmar plantilla `Invite user` con `/auth/confirm?token_hash=...&type=invite&next=/set-password`.
3. Confirmar plantilla Reset Password con `type=recovery` y `/set-password`.
4. Enviar una invitación real a una cuenta de prueba cuando se cambie configuración de correo/Auth.
5. Abrir el link, establecer contraseña e ingresar nuevamente con email/password.
6. Probar “Olvidé mi contraseña” con una cuenta DEV controlada y confirmar recepción, callback y cambio efectivo de contraseña.
7. Confirmar que OWNER no entra a `/admin`.
8. Confirmar que OWNER/STAFF no entra al `merchantId` de otro comercio.
9. Configurar operación, pago y al menos un producto vendible.
10. Confirmar que el botón de activación permanece bloqueado mientras falte readiness.
11. Activar y comprobar visibilidad pública.
12. Confirmar logout/login posterior.

## Password recovery

Pedilo ya expone `/forgot-password` desde el login. La acción normaliza/valida el email, usa `resetPasswordForEmail`, construye el callback desde `APP_BASE_URL` y muestra una respuesta neutral para no revelar existencia de cuentas.

`/auth/confirm` soporta `type=recovery` y establece la sesión necesaria para continuar en `/set-password`. No confundir recovery con invite: deben usar su `type` correspondiente.

La cobertura automatizada valida la superficie pública y las restricciones de seguridad, pero el envío real depende de la configuración de Supabase Auth/SMTP/template del entorno. Antes del piloto debe realizarse al menos una validación manual DEV de recepción del email, callback y login posterior con la nueva contraseña.

## Fuera de alcance de este documento

Checkout, ciclo de pedidos, Realtime, cancelaciones, delivery operativo, RLS detallado y pruebas adversariales se documentan y validan en sus módulos/E2E correspondientes.
