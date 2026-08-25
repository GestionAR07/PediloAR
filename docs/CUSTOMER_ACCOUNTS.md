# Cuenta y panel del cliente

## Alcance implementado

- Registro público en `/registro` mediante Supabase Auth.
- Login compartido para clientes, administradores y miembros de comercios.
- Checkout protegido: navegar y armar el carrito sigue siendo público; para
  finalizar el pedido se requiere una cuenta `ACTIVE`.
- Asociación server-side de `orders.customer_user_id` con el usuario de la
  sesión verificada. El navegador nunca envía ni decide ese UUID.
- Panel `/cuenta` con pedidos activos y datos básicos del perfil.
- Historial `/cuenta/pedidos` y detalle privado por pedido.
- Seguimiento automático cada 20 segundos mientras el pedido no sea terminal.
- Timeline construido desde `order_events` y snapshots históricos del pedido.

## Límites de esta fase

- Pedidos históricos con `customer_user_id IS NULL` se conservan, pero no se
  adjudican automáticamente a una cuenta por teléfono o email.
- No hay cancelación desde el cliente todavía.
- No hay libreta de direcciones ni edición de perfil todavía.
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
