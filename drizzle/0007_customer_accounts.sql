ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_user_id_user_profiles_id_fk" FOREIGN KEY ("customer_user_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

-- Customer registration stores contact defaults in the profile provisioned by
-- the existing auth.users trigger. Role and status remain server-controlled.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
	INSERT INTO public.user_profiles (
		id,
		display_name,
		phone,
		platform_role,
		status
	)
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
		NULLIF(btrim(COALESCE(NEW.raw_user_meta_data ->> 'phone', '')), ''),
		'USER',
		'ACTIVE'
	)
	ON CONFLICT (id) DO NOTHING;
	RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;
--> statement-breakpoint

-- Defense in depth for authenticated Supabase clients. The application reads
-- through customer-scoped server repositories, while RLS independently limits
-- every order aggregate table to the signed-in owner.
CREATE POLICY "orders_select_own"
	ON "orders"
	FOR SELECT
	TO authenticated
	USING (auth.uid() = customer_user_id);
--> statement-breakpoint
CREATE POLICY "order_items_select_own"
	ON "order_items"
	FOR SELECT
	TO authenticated
	USING (
		EXISTS (
			SELECT 1 FROM public.orders o
			WHERE o.id = order_items.order_id
				AND o.customer_user_id = auth.uid()
		)
	);
--> statement-breakpoint
CREATE POLICY "order_item_options_select_own"
	ON "order_item_options"
	FOR SELECT
	TO authenticated
	USING (
		EXISTS (
			SELECT 1
			FROM public.order_items oi
			JOIN public.orders o ON o.id = oi.order_id
			WHERE oi.id = order_item_options.order_item_id
				AND o.customer_user_id = auth.uid()
		)
	);
--> statement-breakpoint
CREATE POLICY "order_events_select_own"
	ON "order_events"
	FOR SELECT
	TO authenticated
	USING (
		EXISTS (
			SELECT 1 FROM public.orders o
			WHERE o.id = order_events.order_id
				AND o.customer_user_id = auth.uid()
		)
	);
--> statement-breakpoint
CREATE POLICY "deliveries_select_own"
	ON "deliveries"
	FOR SELECT
	TO authenticated
	USING (
		EXISTS (
			SELECT 1 FROM public.orders o
			WHERE o.id = deliveries.order_id
				AND o.customer_user_id = auth.uid()
		)
	);
