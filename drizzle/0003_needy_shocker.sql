-- Product image path (app schema)
ALTER TABLE "products" ADD COLUMN "image_path" text;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Supabase Storage: private product-images bucket
-- Writes: server-only via service role after requireMerchantRole.
-- Reads: signed URLs from server (or SELECT policy for authenticated members).
-- No authenticated INSERT/UPDATE/DELETE policies (deny by default).
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
--> statement-breakpoint

DROP POLICY IF EXISTS "product_images_select_member" ON storage.objects;
--> statement-breakpoint

CREATE POLICY "product_images_select_member"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1
    FROM public.merchant_users mu
    WHERE mu.user_id = auth.uid()
      AND mu.active = true
      AND (storage.foldername(name))[1] = mu.merchant_id::text
  )
);
