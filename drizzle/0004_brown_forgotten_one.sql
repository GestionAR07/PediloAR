ALTER TABLE "orders" ADD COLUMN "customer_name_snapshot" text NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "customer_phone_snapshot" text NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "merchant_name_snapshot" text NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_name_snapshot_not_blank" CHECK (length(btrim("orders"."customer_name_snapshot")) > 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_phone_snapshot_not_blank" CHECK (length(btrim("orders"."customer_phone_snapshot")) > 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_merchant_name_snapshot_not_blank" CHECK (length(btrim("orders"."merchant_name_snapshot")) > 0);