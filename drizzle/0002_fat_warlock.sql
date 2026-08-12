ALTER TABLE "merchants" ADD COLUMN "accepting_orders" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "paused_until" timestamp with time zone;