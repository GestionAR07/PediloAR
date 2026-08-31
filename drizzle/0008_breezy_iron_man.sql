CREATE TABLE "merchant_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"business_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text NOT NULL,
	"city_id" uuid NOT NULL,
	"zone_id" uuid NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"merchant_id" uuid,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_user_id" uuid,
	"rejection_reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_applications_status_check" CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
	CONSTRAINT "merchant_applications_business_name_not_blank" CHECK (length(btrim("merchant_applications"."business_name")) > 0),
	CONSTRAINT "merchant_applications_contact_name_not_blank" CHECK (length(btrim("merchant_applications"."contact_name")) > 0),
	CONSTRAINT "merchant_applications_contact_email_not_blank" CHECK (length(btrim("merchant_applications"."contact_email")) > 0),
	CONSTRAINT "merchant_applications_contact_phone_not_blank" CHECK (length(btrim("merchant_applications"."contact_phone")) > 0),
	CONSTRAINT "merchant_applications_status_coherence_check" CHECK ((
        ("merchant_applications"."status" = 'PENDING'
          AND "merchant_applications"."merchant_id" IS NULL
          AND "merchant_applications"."reviewed_at" IS NULL
          AND "merchant_applications"."reviewed_by_user_id" IS NULL
          AND length(btrim("merchant_applications"."rejection_reason")) = 0)
        OR ("merchant_applications"."status" = 'APPROVED'
          AND "merchant_applications"."merchant_id" IS NOT NULL
          AND "merchant_applications"."reviewed_at" IS NOT NULL
          AND "merchant_applications"."reviewed_by_user_id" IS NOT NULL
          AND length(btrim("merchant_applications"."rejection_reason")) = 0)
        OR ("merchant_applications"."status" = 'REJECTED'
          AND "merchant_applications"."merchant_id" IS NULL
          AND "merchant_applications"."reviewed_at" IS NOT NULL
          AND "merchant_applications"."reviewed_by_user_id" IS NOT NULL)
      ))
);
--> statement-breakpoint
ALTER TABLE "merchant_applications" ADD CONSTRAINT "merchant_applications_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_applications" ADD CONSTRAINT "merchant_applications_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_applications" ADD CONSTRAINT "merchant_applications_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_applications" ADD CONSTRAINT "merchant_applications_reviewed_by_user_id_user_profiles_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."user_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "merchant_applications_status_idx" ON "merchant_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "merchant_applications_created_at_idx" ON "merchant_applications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "merchant_applications_contact_email_idx" ON "merchant_applications" USING btree ("contact_email");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_applications_merchant_id_uidx" ON "merchant_applications" USING btree ("merchant_id");--> statement-breakpoint
ALTER TABLE "merchant_applications" ENABLE ROW LEVEL SECURITY;