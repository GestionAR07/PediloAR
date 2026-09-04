# Cuenta y panel del cliente

## Alcance implementado

- Registro público en `/registro` mediante Supabase Auth.
- Acceso opcional con Google OAuth/PKCE en registro y login, expuesto solo con
  `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` después de configurar el proveedor.
- Login compartido para clientes, administradores y miembros de comercios.
- Un Google login con email verificado **reutiliza** el mismo `auth.users` /
  `user_profiles` UUID cuando Supabase vincula la identidad. Un split inseguro
  (otro usuario Auth con el mismo email) no se fusiona: ver
  [`GOOGLE_OAUTH.md`](./GOOGLE_OAUTH.md).
- Checkout protegido: navegar y armar el carrito sigue siendo público; para
  finalizar el pedido se requiere una cuenta `ACTIVE`.
- Asociación server-side de `orders.customer_user_id` con el usuario de la
  sesión verificada. El navegador nunca envía ni decide ese UUID.
- Panel `/cuenta` con pedidos activos y datos básicos del perfil.
- Historial `/cuenta/pedidos` y detalle privado por pedido.
- Seguimiento automático cada 20 segundos mientras el pedido no sea terminal.
- Edición de nombre y teléfono en `/cuenta/perfil`; los usuarios OAuth deben
  completar solo los campos de contacto que falten antes del checkout. Un Owner
  que entra al panel merchant no recorre un onboarding de cliente nuevo.
- Timeline construido desde `order_events` y snapshots históricos del pedido.

## Configuración de Google OAuth

La checklist de branding (nombre **Pedilo** en el consentimiento de Google,
dominio custom de Auth en Supabase) y la política de reutilizar una cuenta
existente está en [`GOOGLE_OAUTH.md`](./GOOGLE_OAUTH.md).

Pasos mínimos del proveedor:

1. Crear un cliente OAuth de tipo Web en Google Auth Platform.
2. Registrar `http://localhost:3001` como origen autorizado para DEV.
3. Registrar como URI de redirección el callback que muestra Supabase en
   Authentication → Providers → Google:
   `https://<project-ref>.supabase.co/auth/v1/callback`.
4. Cargar Client ID y Client Secret en Supabase y habilitar Google.
5. Confirmar que `http://localhost:3001/auth/confirm` está en la redirect allow
   list de Supabase.
6. Recién entonces establecer `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` y
   reiniciar Next.js.

El secreto de Google no se guarda en `.env.local` ni en Git: vive en Supabase.
El nombre visible en la pantalla de Google **no** se controla desde este repo.

## Límites de esta fase

- Pedidos históricos con `customer_user_id IS NULL` se conservan, pero no se
  adjudican automáticamente a una cuenta por teléfono o email.
- No hay cancelación desde el cliente todavía.
- No hay libreta de direcciones todavía.
- No hay recuperación de contraseña completa todavía.

## Seguridad

1. Las páginas y acciones usan `auth.getUser()` y `requireActiveUser()`.
2. La creación toma `customerUserId` del contexto verificado, nunca del payload.
3. El repositorio de detalle filtra simultáneamente por `orders.id` y
   `orders.customer_user_id`.
4. La migración `0007_customer_accounts.sql` agrega FK `ON DELETE SET NULL` y
   policies RLS equivalentes para pedido, ítems, opciones, eventos y entrega.
5. Un replay de idempotencia solo se devuelve a la misma cuenta que creó el
   pedido.

## Configuración de confirmación de email

`APP_BASE_URL` debe apuntar al origen real de la aplicación. El callback
`/auth/confirm` acepta tanto `code` PKCE como `token_hash` de las plantillas SSR
existentes y solo redirige a rutas internas saneadas.

Para una plantilla SSR explícita de registro puede utilizarse la misma forma
que el onboarding, cambiando el tipo y destino:

```html
<a
  href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/cuenta"
>
  Confirmar cuenta
</a>
```

En desarrollo habitual:

```dotenv
APP_BASE_URL=http://localhost:3001
```
