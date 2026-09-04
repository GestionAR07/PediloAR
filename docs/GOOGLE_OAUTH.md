# Google OAuth branding and identity (Pedilo)

This file is the **canonical checklist** for Google login branding and for
reusing an existing Pedilo account. Credentials never live in this repository.

Public app name in product copy: **Pedilo** (`src/lib/app-info.ts`).

The OAuth **start** lives in `src/app/auth/oauth/actions.ts`. The flag is
`NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` in `src/config/auth-providers.ts`. The PKCE
callback is `src/app/auth/confirm/route.ts`. Post-login routing and identity
reuse are `src/app/auth/oauth/continue/page.tsx`.

## Why the consent screen shows a raw Supabase project name

Google shows whatever **application name** is configured on the **OAuth consent
screen** in Google Cloud, plus the authorized domains of the redirect URI.

The redirect URI registered in Google is the Supabase Auth callback:

`https://<project-ref>.supabase.co/auth/v1/callback`

Users therefore see `<project-ref>.supabase.co` (the raw project host) unless a
**custom Auth domain** is configured in Supabase. That hostname is not something
Pedilo can override from Next.js.

## Manual configuration (outside this repo)

Do not paste Client IDs, Client Secrets, or service-role keys into Git.

### 1. Google Cloud — OAuth consent screen

1. Open Google Cloud Console → APIs & Services → **OAuth consent screen**.
2. Set **App name** to `Pedilo` (exactly that public brand, not the GitHub
   repo name and not the Supabase project ref).
3. Set a support email and the authorized domains you control.
4. Keep the client type **Web application**.
5. Authorized JavaScript origins (examples):
   - `http://localhost:3001` (local Next.js)
   - the production Pedilo origin
6. Authorized redirect URIs: the callback shown in Supabase → Authentication →
   Providers → Google:
   `https://<project-ref>.supabase.co/auth/v1/callback`

After saving, Google can take time to refresh the consent-screen name. The
button in Pedilo already says **Continuar con Google**; it does not print the
Supabase project name.

### 2. Supabase — Google provider

1. Authentication → Providers → Google: paste Client ID and Client Secret
   **only in the dashboard**.
2. Add `APP_BASE_URL` + `/auth/confirm` to the redirect allow list
   (see `docs/CUSTOMER_ACCOUNTS.md`).
3. Enable **Automatic linking** of identities that share a **verified** email
   (Dashboard → Authentication → Providers / User sessions, wording varies by
   project version). This is how an Owner who already registered by email keeps
   the same `auth.users` UUID when they later use Google.

Without automatic linking, Google may create a **second** `auth.users` row.
Pedilo **does not** copy `merchant_users` or platform roles onto that new UUID.
The continue page signs the Google session out and shows
`/login?error=account_exists`.

### 3. Recommended later: custom Auth domain

To stop showing `*.supabase.co` on the consent screen and in email links:

1. Attach a domain you own (for example `auth.pedilo.example`) as the Supabase
   **custom Auth domain**.
2. Update the Google authorized redirect URI to
   `https://auth.pedilo.example/auth/v1/callback`.
3. Keep the Next.js origin (`APP_BASE_URL`) unchanged except for the
   `/auth/confirm` allow-list entry.

This is infrastructure, not an application code change.

## Identity reuse implemented in Pedilo

After Google PKCE succeeds:

1. The session email must be present and **verified**. Otherwise the session is
   cleared (`oauth_session`).
2. If the Auth Admin API is available (`SUPABASE_SECRET_KEY` on the server),
   Pedilo looks for **another** `auth.users` row with the same email. A hit is
   an unsafe split identity: sign out, `account_exists`, no membership rewrite.
3. The existing `user_profiles` row for the session UUID is reused. Roles and
   `merchant_users` memberships stay on that UUID.
4. If the Auth trigger raced (`PROFILE_MISSING`), Pedilo creates the missing
   `user_profiles` row as `USER` / `ACTIVE` without elevating roles.
5. Owners and admins go to `/merchant/:id` or `/admin` even if the customer
   phone is empty. Buyer destinations (`/cuenta`, `/checkout`) collect **only**
   the missing name/phone fields.

Linking two already-created Auth users is a **controlled** Supabase/Google
operation (automatic linking, or a support-led identity link). The app never
does it by rewriting foreign keys in a request.
