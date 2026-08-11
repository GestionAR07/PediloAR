# Autorización — Marketplace Rawson

Checkpoint: ver `docs/CHECKPOINTS.md` (`AUTH_FOUNDATION_*`).

## Modelo de identidad

```text
Supabase auth.users  (credenciales, sesión, JWT)
        │
        │ id = PK (UUID)
        ▼
public.user_profiles
  platform_role: USER | ADMIN
  status: ACTIVE | SUSPENDED
        │
        ├── platform ADMIN → operaciones de plataforma (server-side)
        │
        └── platform USER (default) → cliente futuro + posible staff de comercios
                │
                ▼
        public.merchant_users
          role: OWNER | STAFF   ← NO es rol global
          active: boolean
                │
                ▼
             merchants
```

### Qué NO es un rol global

`OWNER` y `STAFF` **no** viven en JWT claims ni en `user_metadata`.

Son filas de `merchant_users` scopeadas a un `merchant_id`.

El mismo profile puede:

- ser cliente (`platform_role = USER`);
- ser OWNER de un comercio y STAFF de otro;
- no pertenecer a ningún comercio.

Nunca existen roles de plataforma `MERCHANT` / `OWNER` / `STAFF`.

## Autorización en el servidor

Helpers (`src/server/auth/authorization.ts`, pure policy en `policy.ts`):

| Helper                      | Comprueba                              |
| --------------------------- | -------------------------------------- |
| `requireAuthenticatedUser`  | sesión Supabase verificada (`getUser`) |
| `requireActiveUser`         | + `user_profiles.status = ACTIVE`      |
| `requirePlatformAdmin`      | + `platform_role = ADMIN`              |
| `requireMerchantMembership` | + membership activa                    |
| `requireMerchantRole`       | + rol en la lista permitida            |

### Confianza

- Identidad: **solo** sesión Supabase verificada (no confiar en `userId` del browser).
- Roles: **solo** columnas DB (`user_profiles`, `merchant_users`).
- Ocultar links en UI **no** es seguridad.

## Profile provisioning

Trigger `on_auth_user_created` en `auth.users` INSERT → `user_profiles` con:

- `platform_role = USER`
- `status = ACTIVE`
- `display_name` opcional desde metadata (nunca se usa para authz)

Función `SECURITY DEFINER` con `search_path = ''` e insert schema-qualified.

Un trigger roto impide signup/login flows de Auth — validar en Supabase dev.

## Bootstrap del primer ADMIN (manual, dev)

1. Crear un usuario Auth en el proyecto **marketplace-rawson-dev** (Dashboard → Authentication).
2. Confirmar que existe fila en `user_profiles` (mismo UUID).
3. Elevar **solo** ese profile:

```sql
UPDATE public.user_profiles
SET platform_role = 'ADMIN',
    updated_at = now()
WHERE id = '<auth-user-uuid>';
```

4. Login en `/login` → `/admin` debe responder “Acceso administrativo validado”.
5. Sin membership, `/merchant` debe redirigir.
6. Logout → `/admin` vuelve a pedir login.

**Nunca** commitear passwords ni usuarios default (`admin/admin`, etc.).

## Desactivación normal de usuarios

Preferir:

```sql
UPDATE public.user_profiles
SET status = 'SUSPENDED', updated_at = now()
WHERE id = '<uuid>';
```

No hard-delete de órdenes/historial. `merchant_users` usa `ON DELETE RESTRICT` hacia profiles.

## RLS (baseline 3A)

RLS **enabled** en todas las tablas `public` del schema marketplace.

Policies creadas en 3A:

| Tabla            | Policy                      | Acción                                              |
| ---------------- | --------------------------- | --------------------------------------------------- |
| `user_profiles`  | `user_profiles_select_own`  | SELECT propia fila (authenticated)                  |
| `merchant_users` | `merchant_users_select_own` | SELECT propias memberships                          |
| `merchants`      | `merchants_select_member`   | SELECT comercios donde el user es membership activa |

- Sin `USING (true)`.
- Sin UPDATE de `user_profiles` por clientes autenticados (impide self-elevate de `platform_role`).
- Otras tablas: RLS on, **sin** policies → Data API deniega por defecto.

El servidor Next usa `DATABASE_URL` (role de conexión que no queda sujeto a las mismas policies del rol `authenticated` de PostgREST). La authz de negocio se aplica en helpers server-side.

## Rutas mínimas

| Ruta        | Guard                  |
| ----------- | ---------------------- |
| `/login`    | público (no signup)    |
| `/admin`    | ADMIN + ACTIVE         |
| `/merchant` | ACTIVE + ≥1 membership |

## Fase 3B (onboarding)

Ver [`MERCHANT_ONBOARDING.md`](./MERCHANT_ONBOARDING.md).

- ADMIN crea Merchant `DRAFT` + geografía mínima en UI.
- Invita OWNER vía Supabase Auth Admin (`SUPABASE_SECRET_KEY` server-only).
- Membership `merchant_users.role = OWNER` es la fuente de autoridad.
- Flujo: invite → `/auth/confirm` → `/set-password` → `/merchant`.

No incluye: public customer signup, OAuth, MFA, Storage, catálogo, checkout.
