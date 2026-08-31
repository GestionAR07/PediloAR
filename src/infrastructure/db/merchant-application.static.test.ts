import fs from "node:fs";
import path from "node:path";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { MERCHANT_APPLICATION_STATUS_VALUES } from "./schema/enums";
import { merchantApplications } from "./schema/merchant-application";

const ROOT = process.cwd();
const MIGRATION = path.join(ROOT, "drizzle", "0008_breezy_iron_man.sql");
const REPOSITORY = path.join(
  ROOT,
  "src/infrastructure/db/repositories/merchant-application-repository.ts",
);

function readMigration(): string {
  return fs.readFileSync(MIGRATION, "utf8");
}

function stripSqlComments(sql: string): string {
  return sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

describe("merchant applications infrastructure (static)", () => {
  it("exposes allowed application statuses and default PENDING", () => {
    expect(MERCHANT_APPLICATION_STATUS_VALUES).toEqual([
      "PENDING",
      "APPROVED",
      "REJECTED",
    ]);

    const sql = readMigration();
    expect(sql).toContain("merchant_applications_status_check");
    expect(sql).toContain("'PENDING', 'APPROVED', 'REJECTED'");
    expect(sql).toContain(`"status" text DEFAULT 'PENDING' NOT NULL`);
  });

  it("encodes status coherence constraints for pending, approved, and rejected", () => {
    const sql = readMigration();
    expect(sql).toContain("merchant_applications_status_coherence_check");
    expect(sql).toMatch(
      /status" = 'PENDING'[\s\S]*merchant_id" IS NULL[\s\S]*reviewed_at" IS NULL[\s\S]*reviewed_by_user_id" IS NULL[\s\S]*rejection_reason"\)\) = 0/,
    );
    expect(sql).toMatch(
      /status" = 'APPROVED'[\s\S]*merchant_id" IS NOT NULL[\s\S]*reviewed_at" IS NOT NULL[\s\S]*reviewed_by_user_id" IS NOT NULL[\s\S]*rejection_reason"\)\) = 0/,
    );
    expect(sql).toMatch(
      /status" = 'REJECTED'[\s\S]*merchant_id" IS NULL[\s\S]*reviewed_at" IS NOT NULL[\s\S]*reviewed_by_user_id" IS NOT NULL/,
    );
  });

  it("defines foreign keys and nullable unique merchant_id without unique contact_email", () => {
    const sql = readMigration();
    expect(sql).toContain("merchant_applications_city_id_cities_id_fk");
    expect(sql).toContain("merchant_applications_zone_id_zones_id_fk");
    expect(sql).toContain("merchant_applications_merchant_id_merchants_id_fk");
    expect(sql).toContain(
      "merchant_applications_reviewed_by_user_id_user_profiles_id_fk",
    );
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "merchant_applications_merchant_id_uidx"',
    );
    expect(sql).toContain(
      'CREATE INDEX "merchant_applications_contact_email_idx"',
    );
    expect(sql).not.toMatch(
      /CREATE UNIQUE INDEX "merchant_applications_contact_email/,
    );

    const columns = Object.values(getTableColumns(merchantApplications)).map(
      (column) => column.name,
    );
    expect(columns).toEqual(
      expect.arrayContaining([
        "status",
        "business_name",
        "contact_name",
        "contact_email",
        "contact_phone",
        "city_id",
        "zone_id",
        "description",
        "message",
        "merchant_id",
        "reviewed_at",
        "reviewed_by_user_id",
        "rejection_reason",
        "created_at",
        "updated_at",
      ]),
    );
  });

  it("enables RLS without permissive public policies", () => {
    const sql = stripSqlComments(readMigration());
    expect(sql).toContain(
      'ALTER TABLE "merchant_applications" ENABLE ROW LEVEL SECURITY',
    );
    expect(sql).not.toMatch(/CREATE POLICY/i);
    expect(sql.includes("USING (true)")).toBe(false);
    expect(sql.includes("USING(true)")).toBe(false);
    expect(sql).not.toMatch(/TO anon/i);
  });

  it("indexes status and created_at for admin listing", () => {
    const sql = readMigration();
    expect(sql).toContain('CREATE INDEX "merchant_applications_status_idx"');
    expect(sql).toContain(
      'CREATE INDEX "merchant_applications_created_at_idx"',
    );
  });
});

describe("merchant application repository (static)", () => {
  const source = fs.readFileSync(REPOSITORY, "utf8");

  it("is server-only and does not depend on client or Supabase auth/admin", () => {
    expect(source).toContain('import "server-only"');
    expect(source).not.toMatch(/@supabase\/supabase-js/);
    expect(source).not.toMatch(/@supabase\/ssr/);
    expect(source).not.toMatch(/createClient/);
    expect(source).not.toMatch(/createServerClient/);
    expect(source).not.toMatch(/auth\.admin/);
    expect(source).not.toContain('"use client"');
  });

  it("never inserts merchants or creates users", () => {
    expect(source).not.toMatch(/insert\s*\(\s*merchants\s*\)/);
    expect(source).not.toContain(".insert(merchants)");
    expect(source).not.toContain("merchantUsers");
    expect(source).not.toContain("userProfiles");
    expect(source).not.toMatch(/createUser|signUp|invite/i);
  });

  it("exposes repository operations and pending duplicate identity by email + business name", () => {
    expect(source).toContain("insertMerchantApplication");
    expect(source).toContain("listMerchantApplicationsForAdmin");
    expect(source).toContain("findMerchantApplicationById");
    expect(source).toContain("findPendingDuplicate");
    expect(source).toContain("markApproved");
    expect(source).toContain("markRejected");
    expect(source).toContain("normalizeApplicationEmail");
    expect(source).toContain("normalizeApplicationBusinessName");
    expect(source).toContain(
      "lower(btrim(${merchantApplications.contactEmail}))",
    );
    expect(source).toContain(
      "regexp_replace(btrim(${merchantApplications.businessName})",
    );
    expect(source).toContain('status: "PENDING"');
    expect(source).toContain(
      "contactEmail: normalizeApplicationEmail(input.contactEmail)",
    );
  });

  it("supports optional transaction client for atomic approval in a later phase", () => {
    expect(source).toContain("export type MerchantApplicationDbTx");
    expect(source).toMatch(
      /Parameters<\s*Parameters<Db\["transaction"\]>\[0\]\s*>\[0\]/,
    );
    expect(source).toMatch(/tx\?: MerchantApplicationDbTx/);
    expect(source).toContain("const executor = tx ?? getDb()");
    expect(source).toContain("markApproved(");
    expect(source).toContain("markRejected(");
    expect(source).toMatch(
      /markApproved[\s\S]*eq\(merchantApplications\.status, "PENDING"\)/,
    );
  });
});
