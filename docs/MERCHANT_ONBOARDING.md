# Merchant onboarding (Fase 3B) — Marketplace Rawson

Checkpoint objetivo: `MERCHANT_ONBOARDING_READY` (solo tras validación E2E manual).

Código de esta fase: onboarding asistido de comercios + invitación OWNER.

## Variables de entorno

En `.env.local` (nunca commitear):

```env
APP_BASE_URL=http://localhost:3001
DATABASE_URL=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
```

| Variable              | Dónde            | Uso                                                 |
| --------------------- | ---------------- | --------------------------------------------------- |
| `APP_BASE_URL`        | server-only      | Origen para redirects de invitación                 |
| `SUPABASE_SECRET_KEY` | server-only      | Auth Admin: localizar usuarios, `inviteUserByEmail` |
| `NEXT_PUBLIC_*`       | browser + server | Sesión SSR/cliente (clave pública)                  |

**Prohibido:** `NEXT_PUBLIC_SUPABASE_SECRET_KEY`.

La secret **no** autoriza al caller: primero `requirePlatformAdmin()`, luego Admin API.

Puerto dev: este proyecto suele usar **3001** si 3000 está ocupado:

```powershell
npx next dev -p 3001
```

## Configuración manual en Supabase Dashboard

Cursor/agente **no** puede modificar el Dashboard. Operador en **marketplace-rawson-dev**:

### 1. URL Configuration

**Authentication → URL Configuration**

- **Site URL** (desarrollo): `http://localhost:3001`
- **Redirect URLs** (permitidas), al menos:

```text
http://localhost:3001/auth/confirm
http://localhost:3001/**
```

Ajustar host/puerto si el dev server corre en otro port.

### 2. Plantilla Invite user (SSR + token_hash)

**Authentication → Email Templates → Invite user**

Usar confirmación por **Token Hash** hacia la ruta SSR de la app (no depender solo del SPA hash fragment de Supabase).

Ejemplo de cuerpo (HTML simplificado):

```html
<h2>Te invitaron a Marketplace Rawson</h2>
<p>Aceptá la invitación para acceder al panel de comercio:</p>
<p>
  <a
    href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/set-password"
  >
    Aceptar invitación
  </a>
</p>
```

Notas:

- `type=invite` es obligatorio para el flujo de invitación.
- `next=/set-password` es ruta interna; la app rechaza open redirects.
- `SiteURL` debe coincidir con el Site URL de Auth (p.ej. `http://localhost:3001`).
- Tras verificar el token, `/auth/confirm` crea la sesión (cookies SSR) y redirige a `/set-password`.

### 3. Flujo esperado

```text
ADMIN crea Merchant DRAFT
  → ADMIN invita OWNER (email)
  → Supabase envía mail (Invite)
  → Link: /auth/confirm?token_hash=…&type=invite&next=/set-password
  → sesión cookies SSR
  → /set-password (updateUser password del usuario)
  → /merchant (membership OWNER en merchant_users)
```

## Superficies de producto

| Ruta                    | Quién                           |
| ----------------------- | ------------------------------- |
| `/admin/geography`      | ADMIN — Province / City / Zone  |
| `/admin/merchants`      | ADMIN — listado                 |
| `/admin/merchants/new`  | ADMIN — crear DRAFT             |
| `/admin/merchants/[id]` | ADMIN — detalle + invitar OWNER |
| `/auth/confirm`         | callback email                  |
| `/set-password`         | usuario autenticado post-invite |
| `/merchant`             | membership activa               |
| `/merchant/[id]`        | membership de **ese** merchant  |

### Datos piloto (manual, sin seed SQL)

Desde `/admin/geography`:

- Province: **Chubut**, code **AR-U**
- City: **Rawson**, timezone **America/Argentina/Catamarca**
- Zones: a elección del operador (sin inventar barrios en código)

### Schema notes

- `provinces` tiene `name` + `code` (no hay columna `slug`).
- Merchants siempre `status = DRAFT`, `platform_delivery_enabled = false` en create.
- OWNER/STAFF viven en `merchant_users` (no en `platform_role`).

## Seguridad

- Admin client: `src/infrastructure/supabase/admin.ts` (`server-only`).
- No client-side authorization for ADMIN writes.
- Cross-merchant: `requireMerchantMembership(merchantId)` + query filtrada.
- STAFF no se eleva silenciosamente a OWNER.
- Sin policies `USING (true)` nuevas.
- Migraciones `0000` / `0001` intactas.

## Validación manual (checklist E2E)

1. `SUPABASE_SECRET_KEY` en server `.env.local`
2. `APP_BASE_URL=http://localhost:3001`
3. Site URL + Redirect URLs en Supabase
4. Plantilla Invite con TokenHash → `/auth/confirm`
5. Geografía piloto en `/admin/geography`
6. Crear Merchant DRAFT
7. Invitar email OWNER de prueba
8. Recibir email real
9. Abrir invitación
10. `/auth/confirm` OK
11. Establecer contraseña
12. `/merchant` OK
13. Comercio visible
14. Rol OWNER
15. Status sigue DRAFT
16. Owner no entra a `/admin`
17. Owner no entra a otro merchantId
18. Logout OK

Si el código está listo pero falta este E2E:

`MERCHANT_ONBOARDING_READY_MANUAL_VALIDATION_PENDING`

## Fuera de alcance (3B)

Catálogo, productos, pedidos, carrito, checkout, platform delivery, mapas, Storage, OAuth, customer signup público, activación AUTO de merchant.
