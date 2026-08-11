CREATE TABLE "cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"province_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"timezone" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cities_name_not_blank" CHECK (length(btrim("cities"."name")) > 0),
	CONSTRAINT "cities_slug_not_blank" CHECK (length(btrim("cities"."slug")) > 0),
	CONSTRAINT "cities_timezone_not_blank" CHECK (length(btrim("cities"."timezone")) > 0)
);
--> statement-breakpoint
CREATE TABLE "provinces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provinces_name_not_blank" CHECK (length(btrim("provinces"."name")) > 0),
	CONSTRAINT "provinces_code_not_blank" CHECK (length(btrim("provinces"."code")) > 0)
);
--> statement-breakpoint
CREATE TABLE "zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "zones_name_not_blank" CHECK (length(btrim("zones"."name")) > 0),
	CONSTRAINT "zones_slug_not_blank" CHECK (length(btrim("zones"."slug")) > 0)
);
--> statement-breakpoint
CREATE TABLE "merchant_delivery_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"zone_id" uuid NOT NULL,
	"delivery_fee_cents" bigint NOT NULL,
	"minimum_order_cents" bigint NOT NULL,
	"estimated_minutes" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_delivery_zones_estimated_minutes_check" CHECK ("merchant_delivery_zones"."estimated_minutes" >= 0),
	CONSTRAINT "merchant_delivery_zones_fee_nonneg" CHECK ("merchant_delivery_zones"."delivery_fee_cents" >= 0),
	CONSTRAINT "merchant_delivery_zones_minimum_nonneg" CHECK ("merchant_delivery_zones"."minimum_order_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "merchant_opening_intervals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"open_minute" integer NOT NULL,
	"close_minute" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_opening_intervals_weekday_check" CHECK ("merchant_opening_intervals"."weekday" >= 0 AND "merchant_opening_intervals"."weekday" <= 6),
	CONSTRAINT "merchant_opening_intervals_open_minute_check" CHECK ("merchant_opening_intervals"."open_minute" >= 0 AND "merchant_opening_intervals"."open_minute" < 1440),
	CONSTRAINT "merchant_opening_intervals_close_minute_check" CHECK ("merchant_opening_intervals"."close_minute" > 0 AND "merchant_opening_intervals"."close_minute" <= 1440),
	CONSTRAINT "merchant_opening_intervals_range_check" CHECK ("merchant_opening_intervals"."close_minute" > "merchant_opening_intervals"."open_minute")
);
--> statement-breakpoint
CREATE TABLE "merchant_payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_payment_methods_code_check" CHECK (code IN ('CASH', 'TRANSFER', 'MERCADO_PAGO')),
	CONSTRAINT "merchant_payment_methods_label_not_blank" CHECK (length(btrim("merchant_payment_methods"."label")) > 0)
);
--> statement-breakpoint
CREATE TABLE "merchant_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"external_user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_users_role_check" CHECK (role IN ('OWNER', 'STAFF'))
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid NOT NULL,
	"zone_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"pickup_enabled" boolean DEFAULT true NOT NULL,
	"merchant_delivery_enabled" boolean DEFAULT false NOT NULL,
	"platform_delivery_enabled" boolean DEFAULT false NOT NULL,
	"preparation_minutes" integer DEFAULT 30 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchants_name_not_blank" CHECK (length(btrim("merchants"."name")) > 0),
	CONSTRAINT "merchants_slug_not_blank" CHECK (length(btrim("merchants"."slug")) > 0),
	CONSTRAINT "merchants_status_check" CHECK (status IN ('DRAFT', 'ACTIVE', 'SUSPENDED')),
	CONSTRAINT "merchants_preparation_minutes_check" CHECK ("merchants"."preparation_minutes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "marketplace_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketplace_categories_name_not_blank" CHECK (length(btrim("marketplace_categories"."name")) > 0),
	CONSTRAINT "marketplace_categories_slug_not_blank" CHECK (length(btrim("marketplace_categories"."slug")) > 0)
);
--> statement-breakpoint
CREATE TABLE "merchant_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_categories_name_not_blank" CHECK (length(btrim("merchant_categories"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "merchant_marketplace_categories" (
	"merchant_id" uuid NOT NULL,
	"marketplace_category_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_marketplace_categories_pk" PRIMARY KEY("merchant_id","marketplace_category_id")
);
--> statement-breakpoint
CREATE TABLE "product_option_choices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price_delta_cents" bigint NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_option_choices_name_not_blank" CHECK (length(btrim("product_option_choices"."name")) > 0),
	CONSTRAINT "product_option_choices_price_delta_nonneg" CHECK ("product_option_choices"."price_delta_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "product_option_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"selection_mode" text NOT NULL,
	"min_selections" integer DEFAULT 0 NOT NULL,
	"max_selections" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_option_groups_name_not_blank" CHECK (length(btrim("product_option_groups"."name")) > 0),
	CONSTRAINT "product_option_groups_mode_check" CHECK (selection_mode IN ('SINGLE', 'MULTIPLE', 'QUANTITY')),
	CONSTRAINT "product_option_groups_min_nonneg" CHECK ("product_option_groups"."min_selections" >= 0),
	CONSTRAINT "product_option_groups_max_nonneg" CHECK ("product_option_groups"."max_selections" >= 0),
	CONSTRAINT "product_option_groups_bounds" CHECK ("product_option_groups"."max_selections" >= "product_option_groups"."min_selections"),
	CONSTRAINT "product_option_groups_single_bounds" CHECK ("product_option_groups"."selection_mode" <> 'SINGLE' OR ("product_option_groups"."min_selections" <= 1 AND "product_option_groups"."max_selections" <= 1))
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"merchant_category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price_cents" bigint NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"stock_mode" text DEFAULT 'NOT_TRACKED' NOT NULL,
	"stock_quantity" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_name_not_blank" CHECK (length(btrim("products"."name")) > 0),
	CONSTRAINT "products_price_nonneg" CHECK ("products"."price_cents" >= 0),
	CONSTRAINT "products_stock_mode_check" CHECK (stock_mode IN ('NOT_TRACKED', 'TRACKED')),
	CONSTRAINT "products_stock_tracked_check" CHECK ((
        "products"."stock_mode" <> 'TRACKED'
        OR (
          "products"."stock_quantity" IS NOT NULL
          AND "products"."stock_quantity" >= 0
        )
      ))
);
--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_events_from_status_check" CHECK (from_status IS NULL OR from_status IN ('PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELED')),
	CONSTRAINT "order_events_to_status_check" CHECK (to_status IN ('PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELED')),
	CONSTRAINT "order_events_actor_type_check" CHECK (actor_type IN ('CUSTOMER', 'MERCHANT_USER', 'ADMIN', 'SYSTEM'))
);
--> statement-breakpoint
CREATE TABLE "order_item_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_item_id" uuid NOT NULL,
	"option_group_id" uuid,
	"option_choice_id" uuid,
	"option_group_name_snapshot" text NOT NULL,
	"option_choice_name_snapshot" text NOT NULL,
	"price_delta_cents" bigint NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_item_options_quantity_positive" CHECK ("order_item_options"."quantity" >= 1),
	CONSTRAINT "order_item_options_group_name_not_blank" CHECK (length(btrim("order_item_options"."option_group_name_snapshot")) > 0),
	CONSTRAINT "order_item_options_choice_name_not_blank" CHECK (length(btrim("order_item_options"."option_choice_name_snapshot")) > 0)
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid,
	"product_name_snapshot" text NOT NULL,
	"unit_price_cents" bigint NOT NULL,
	"quantity" integer NOT NULL,
	"line_total_cents" bigint NOT NULL,
	"item_notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_items_quantity_positive" CHECK ("order_items"."quantity" >= 1),
	CONSTRAINT "order_items_name_not_blank" CHECK (length(btrim("order_items"."product_name_snapshot")) > 0)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"customer_user_id" uuid,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"fulfillment_method" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"item_subtotal_cents" bigint NOT NULL,
	"options_subtotal_cents" bigint NOT NULL,
	"order_subtotal_cents" bigint NOT NULL,
	"delivery_fee_cents" bigint NOT NULL,
	"total_cents" bigint NOT NULL,
	"payment_method_code" text NOT NULL,
	"payment_method_label" text NOT NULL,
	"payment_method_instructions" text DEFAULT '' NOT NULL,
	"delivery_city_id" uuid,
	"delivery_zone_id" uuid,
	"delivery_city_name_snapshot" text,
	"delivery_zone_name_snapshot" text,
	"delivery_street" text,
	"delivery_number" text,
	"delivery_floor_apartment" text,
	"delivery_reference" text,
	"canceled_at" timestamp with time zone,
	"canceled_by" text,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_status_check" CHECK (status IN ('PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELED')),
	CONSTRAINT "orders_fulfillment_method_check" CHECK (fulfillment_method IN ('PICKUP', 'MERCHANT_DELIVERY', 'PLATFORM_DELIVERY')),
	CONSTRAINT "orders_payment_method_code_check" CHECK (payment_method_code IN ('CASH', 'TRANSFER', 'MERCADO_PAGO')),
	CONSTRAINT "orders_canceled_by_check" CHECK (canceled_by IS NULL OR canceled_by IN ('CUSTOMER', 'MERCHANT_USER', 'ADMIN', 'SYSTEM')),
	CONSTRAINT "orders_cancel_reason_check" CHECK (cancel_reason IS NULL OR cancel_reason IN ('CUSTOMER_REQUEST', 'MERCHANT_UNAVAILABLE', 'OUT_OF_STOCK', 'PAYMENT_ISSUE', 'OTHER')),
	CONSTRAINT "orders_idempotency_key_shape" CHECK (char_length("orders"."idempotency_key") >= 8 AND char_length("orders"."idempotency_key") <= 128 AND "orders"."idempotency_key" ~ '^[A-Za-z0-9._~-]+$')
);
--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"fee_cents" bigint NOT NULL,
	"estimated_minutes" integer,
	"address_city_id" uuid,
	"address_zone_id" uuid,
	"address_city_name_snapshot" text,
	"address_zone_name_snapshot" text,
	"address_street" text NOT NULL,
	"address_number" text NOT NULL,
	"address_floor_apartment" text,
	"address_reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deliveries_provider_check" CHECK (provider IN ('MERCHANT', 'PLATFORM')),
	CONSTRAINT "deliveries_status_check" CHECK (status IN ('PENDING', 'REQUESTED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'CANCELED')),
	CONSTRAINT "deliveries_estimated_minutes_check" CHECK ("deliveries"."estimated_minutes" IS NULL OR "deliveries"."estimated_minutes" >= 0),
	CONSTRAINT "deliveries_street_not_blank" CHECK (length(btrim("deliveries"."address_street")) > 0),
	CONSTRAINT "deliveries_number_not_blank" CHECK (length(btrim("deliveries"."address_number")) > 0)
);
--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_province_id_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zones" ADD CONSTRAINT "zones_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_delivery_zones" ADD CONSTRAINT "merchant_delivery_zones_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_delivery_zones" ADD CONSTRAINT "merchant_delivery_zones_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_opening_intervals" ADD CONSTRAINT "merchant_opening_intervals_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_payment_methods" ADD CONSTRAINT "merchant_payment_methods_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_users" ADD CONSTRAINT "merchant_users_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_categories" ADD CONSTRAINT "merchant_categories_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_marketplace_categories" ADD CONSTRAINT "merchant_marketplace_categories_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_marketplace_categories" ADD CONSTRAINT "merchant_marketplace_categories_marketplace_category_id_marketplace_categories_id_fk" FOREIGN KEY ("marketplace_category_id") REFERENCES "public"."marketplace_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_option_choices" ADD CONSTRAINT "product_option_choices_group_id_product_option_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."product_option_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_option_groups" ADD CONSTRAINT "product_option_groups_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_merchant_category_id_merchant_categories_id_fk" FOREIGN KEY ("merchant_category_id") REFERENCES "public"."merchant_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_options" ADD CONSTRAINT "order_item_options_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_options" ADD CONSTRAINT "order_item_options_option_group_id_product_option_groups_id_fk" FOREIGN KEY ("option_group_id") REFERENCES "public"."product_option_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_options" ADD CONSTRAINT "order_item_options_option_choice_id_product_option_choices_id_fk" FOREIGN KEY ("option_choice_id") REFERENCES "public"."product_option_choices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_city_id_cities_id_fk" FOREIGN KEY ("delivery_city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_zone_id_zones_id_fk" FOREIGN KEY ("delivery_zone_id") REFERENCES "public"."zones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_address_city_id_cities_id_fk" FOREIGN KEY ("address_city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_address_zone_id_zones_id_fk" FOREIGN KEY ("address_zone_id") REFERENCES "public"."zones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cities_province_slug_uidx" ON "cities" USING btree ("province_id","slug");--> statement-breakpoint
CREATE INDEX "cities_province_id_idx" ON "cities" USING btree ("province_id");--> statement-breakpoint
CREATE UNIQUE INDEX "provinces_code_uidx" ON "provinces" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "zones_city_slug_uidx" ON "zones" USING btree ("city_id","slug");--> statement-breakpoint
CREATE INDEX "zones_city_id_idx" ON "zones" USING btree ("city_id");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_delivery_zones_merchant_zone_uidx" ON "merchant_delivery_zones" USING btree ("merchant_id","zone_id");--> statement-breakpoint
CREATE INDEX "merchant_delivery_zones_merchant_id_idx" ON "merchant_delivery_zones" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "merchant_opening_intervals_merchant_id_idx" ON "merchant_opening_intervals" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "merchant_opening_intervals_merchant_weekday_idx" ON "merchant_opening_intervals" USING btree ("merchant_id","weekday");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_payment_methods_merchant_code_uidx" ON "merchant_payment_methods" USING btree ("merchant_id","code");--> statement-breakpoint
CREATE INDEX "merchant_payment_methods_merchant_id_idx" ON "merchant_payment_methods" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_users_merchant_external_uidx" ON "merchant_users" USING btree ("merchant_id","external_user_id");--> statement-breakpoint
CREATE INDEX "merchant_users_merchant_id_idx" ON "merchant_users" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "merchants_slug_uidx" ON "merchants" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "merchants_city_id_idx" ON "merchants" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "merchants_status_idx" ON "merchants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "merchants_city_status_idx" ON "merchants" USING btree ("city_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "marketplace_categories_slug_uidx" ON "marketplace_categories" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_categories_merchant_name_uidx" ON "merchant_categories" USING btree ("merchant_id","name");--> statement-breakpoint
CREATE INDEX "merchant_categories_merchant_id_idx" ON "merchant_categories" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "merchant_marketplace_categories_category_idx" ON "merchant_marketplace_categories" USING btree ("marketplace_category_id");--> statement-breakpoint
CREATE INDEX "product_option_choices_group_id_idx" ON "product_option_choices" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "product_option_groups_product_id_idx" ON "product_option_groups" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "products_merchant_id_idx" ON "products" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "products_merchant_category_id_idx" ON "products" USING btree ("merchant_category_id");--> statement-breakpoint
CREATE INDEX "products_merchant_active_idx" ON "products" USING btree ("merchant_id","active");--> statement-breakpoint
CREATE INDEX "order_events_order_id_idx" ON "order_events" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_events_order_created_at_idx" ON "order_events" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "order_item_options_order_item_id_idx" ON "order_item_options" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_idempotency_key_uidx" ON "orders" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "orders_merchant_id_idx" ON "orders" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "orders_merchant_status_idx" ON "orders" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE INDEX "orders_merchant_created_at_idx" ON "orders" USING btree ("merchant_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_customer_user_id_idx" ON "orders" USING btree ("customer_user_id");--> statement-breakpoint
CREATE INDEX "orders_status_created_at_idx" ON "orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "deliveries_order_id_uidx" ON "deliveries" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "deliveries_status_idx" ON "deliveries" USING btree ("status");