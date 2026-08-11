-- Migration 0001: Auth foundation
-- Incremental; does NOT modify 0000_luxuriant_puma.sql
--
-- Boundary: auth.users is owned by Supabase. We reference it only via
-- user_profiles.id FK and a provisioning trigger in this migration.

-- ---------------------------------------------------------------------------
-- 1) Public user profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"phone" text,
	"platform_role" text DEFAULT 'USER' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_platform_role_check" CHECK (platform_role IN ('USER', 'ADMIN')),
	CONSTRAINT "user_profiles_status_check" CHECK (status IN ('ACTIVE', 'SUSPENDED'))
);
--> statement-breakpoint
CREATE INDEX "user_profiles_platform_role_idx" ON "user_profiles" USING btree ("platform_role");
--> statement-breakpoint
CREATE INDEX "user_profiles_status_idx" ON "user_profiles" USING btree ("status");
--> statement-breakpoint
-- FK into Supabase-managed auth schema (not owned by Drizzle).
ALTER TABLE "user_profiles"
	ADD CONSTRAINT "user_profiles_id_auth_users_id_fk"
	FOREIGN KEY ("id") REFERENCES "auth"."users"("id")
	ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 2) Provision profile on auth.users insert
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
	INSERT INTO public.user_profiles (id, display_name, platform_role, status)
	VALUES (
		NEW.id,
		NULLIF(
			btrim(
				COALESCE(
					NEW.raw_user_meta_data ->> 'display_name',
					NEW.raw_user_meta_data ->> 'full_name',
					''
				)
			),
			''
		),
		'USER',
		'ACTIVE'
	)
	ON CONFLICT (id) DO NOTHING;
	RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
--> statement-breakpoint
CREATE TRIGGER on_auth_user_created
	AFTER INSERT ON auth.users
	FOR EACH ROW
	EXECUTE FUNCTION public.handle_new_auth_user();
--> statement-breakpoint
-- Ensure function owner can insert profiles; revoke execute from PUBLIC.
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 3) merchant_users: external_user_id -> user_id + FK to user_profiles
-- ---------------------------------------------------------------------------
ALTER TABLE "merchant_users" RENAME COLUMN "external_user_id" TO "user_id";
--> statement-breakpoint
DROP INDEX IF EXISTS "merchant_users_merchant_external_uidx";
--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_users_merchant_user_uidx"
	ON "merchant_users" USING btree ("merchant_id","user_id");
--> statement-breakpoint
CREATE INDEX "merchant_users_user_id_idx"
	ON "merchant_users" USING btree ("user_id");
--> statement-breakpoint
ALTER TABLE "merchant_users"
	ADD CONSTRAINT "merchant_users_user_id_user_profiles_id_fk"
	FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id")
	ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 4) RLS baseline — enable on all public tables
-- Deny-by-default for tables without policies. Never open with permissive always-true policies.
-- ---------------------------------------------------------------------------
ALTER TABLE "provinces" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "cities" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "zones" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "merchants" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "merchant_users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "merchant_opening_intervals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "merchant_delivery_zones" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "merchant_payment_methods" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "marketplace_categories" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "merchant_marketplace_categories" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "merchant_categories" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "product_option_groups" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "product_option_choices" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "order_item_options" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "order_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "deliveries" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 5) Minimal authenticated policies (no public write on roles/status)
-- ---------------------------------------------------------------------------
CREATE POLICY "user_profiles_select_own"
	ON "user_profiles"
	FOR SELECT
	TO authenticated
	USING (auth.uid() = id);
--> statement-breakpoint
CREATE POLICY "merchant_users_select_own"
	ON "merchant_users"
	FOR SELECT
	TO authenticated
	USING (auth.uid() = user_id);
--> statement-breakpoint
CREATE POLICY "merchants_select_member"
	ON "merchants"
	FOR SELECT
	TO authenticated
	USING (
		EXISTS (
			SELECT 1
			FROM public.merchant_users mu
			WHERE mu.merchant_id = merchants.id
				AND mu.user_id = auth.uid()
				AND mu.active = true
		)
	);
