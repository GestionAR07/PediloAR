# Product images — Supabase Storage

## Decision

Bucket: **`product-images`** (PRIVATE).

- Persist only `products.image_path` (object path), never signed URLs.
- **Writes** run exclusively on the server with the **service-role** client after `requireMerchantRole(OWNER|STAFF)`.
- **Reads** for merchant backoffice use short-lived signed URLs generated server-side.
- `SUPABASE_SECRET_KEY` never goes to the browser.

Why private for Fase 4B:

- Product images are not public yet (no storefront).
- Avoids accidental public write/list exposure.
- Fase 5 storefront may keep signed URLs or switch the bucket to public **read** while keeping writes server-only — report that change explicitly if chosen later.

## Bootstrap (dev)

Applied via Drizzle migration `drizzle/0003_needy_shocker.sql`:

1. `products.image_path` (nullable text)
2. Storage bucket `product-images` (private, 5 MB, jpeg/png/webp)
3. SELECT policy for authenticated merchant members on their path prefix
4. No authenticated INSERT/UPDATE/DELETE policies (service role only for writes)

```powershell
npm run db:migrate
```

## Object path

`{merchantId}/products/{productId}/{uuid}.{jpg|png|webp}`

## Limits

- MIME: `image/jpeg`, `image/png`, `image/webp` (no SVG)
- Max size: 5 MB
