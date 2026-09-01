import "server-only";

import { and, count, desc, eq, sql } from "drizzle-orm";
import { getDb, type Db } from "../client";
import { cities, merchantApplications, zones } from "../schema";

export type MerchantApplicationDbTx = Parameters<
  Parameters<Db["transaction"]>[0]
>[0];

export type MerchantApplicationRecord = {
  id: string;
  status: string;
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  cityId: string;
  zoneId: string;
  cityName: string;
  zoneName: string;
  description: string;
  message: string;
  merchantId: string | null;
  reviewedAt: Date | null;
  reviewedByUserId: string | null;
  rejectionReason: string;
  createdAt: Date;
  updatedAt: Date;
};

export type InsertMerchantApplicationInput = {
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  cityId: string;
  zoneId: string;
  description?: string;
  message?: string;
};

export type MarkApprovedInput = {
  applicationId: string;
  merchantId: string;
  reviewedByUserId: string;
};

export type MarkRejectedInput = {
  applicationId: string;
  reviewedByUserId: string;
  rejectionReason: string;
};

function normalizeApplicationEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeApplicationBusinessName(businessName: string): string {
  return businessName.trim().toLowerCase().replace(/\s+/g, " ");
}

function mapApplicationRow(row: {
  id: string;
  status: string;
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  cityId: string;
  zoneId: string;
  cityName: string;
  zoneName: string;
  description: string;
  message: string;
  merchantId: string | null;
  reviewedAt: Date | null;
  reviewedByUserId: string | null;
  rejectionReason: string;
  createdAt: Date;
  updatedAt: Date;
}): MerchantApplicationRecord {
  return row;
}

async function selectApplicationById(
  executor: Pick<MerchantApplicationDbTx, "select">,
  applicationId: string,
): Promise<MerchantApplicationRecord | null> {
  const rows = await executor
    .select({
      id: merchantApplications.id,
      status: merchantApplications.status,
      businessName: merchantApplications.businessName,
      contactName: merchantApplications.contactName,
      contactEmail: merchantApplications.contactEmail,
      contactPhone: merchantApplications.contactPhone,
      cityId: merchantApplications.cityId,
      zoneId: merchantApplications.zoneId,
      cityName: cities.name,
      zoneName: zones.name,
      description: merchantApplications.description,
      message: merchantApplications.message,
      merchantId: merchantApplications.merchantId,
      reviewedAt: merchantApplications.reviewedAt,
      reviewedByUserId: merchantApplications.reviewedByUserId,
      rejectionReason: merchantApplications.rejectionReason,
      createdAt: merchantApplications.createdAt,
      updatedAt: merchantApplications.updatedAt,
    })
    .from(merchantApplications)
    .innerJoin(cities, eq(cities.id, merchantApplications.cityId))
    .innerJoin(zones, eq(zones.id, merchantApplications.zoneId))
    .where(eq(merchantApplications.id, applicationId))
    .limit(1);

  const row = rows[0];
  return row ? mapApplicationRow(row) : null;
}

export async function insertMerchantApplication(
  input: InsertMerchantApplicationInput,
  tx?: MerchantApplicationDbTx,
): Promise<MerchantApplicationRecord> {
  const executor = tx ?? getDb();
  const inserted = await executor
    .insert(merchantApplications)
    .values({
      businessName: input.businessName,
      contactName: input.contactName,
      contactEmail: normalizeApplicationEmail(input.contactEmail),
      contactPhone: input.contactPhone,
      cityId: input.cityId,
      zoneId: input.zoneId,
      description: input.description ?? "",
      message: input.message ?? "",
      status: "PENDING",
    })
    .returning({ id: merchantApplications.id });

  const id = inserted[0]?.id;
  if (!id) {
    throw new Error("Failed to insert merchant application");
  }

  const record = await selectApplicationById(executor, id);
  if (!record) {
    throw new Error("Merchant application inserted but not found");
  }
  return record;
}

export async function listMerchantApplicationsForAdmin(
  tx?: MerchantApplicationDbTx,
): Promise<MerchantApplicationRecord[]> {
  const executor = tx ?? getDb();
  const rows = await executor
    .select({
      id: merchantApplications.id,
      status: merchantApplications.status,
      businessName: merchantApplications.businessName,
      contactName: merchantApplications.contactName,
      contactEmail: merchantApplications.contactEmail,
      contactPhone: merchantApplications.contactPhone,
      cityId: merchantApplications.cityId,
      zoneId: merchantApplications.zoneId,
      cityName: cities.name,
      zoneName: zones.name,
      description: merchantApplications.description,
      message: merchantApplications.message,
      merchantId: merchantApplications.merchantId,
      reviewedAt: merchantApplications.reviewedAt,
      reviewedByUserId: merchantApplications.reviewedByUserId,
      rejectionReason: merchantApplications.rejectionReason,
      createdAt: merchantApplications.createdAt,
      updatedAt: merchantApplications.updatedAt,
    })
    .from(merchantApplications)
    .innerJoin(cities, eq(cities.id, merchantApplications.cityId))
    .innerJoin(zones, eq(zones.id, merchantApplications.zoneId))
    .orderBy(desc(merchantApplications.createdAt));

  return rows.map(mapApplicationRow);
}

export async function findMerchantApplicationById(
  applicationId: string,
  tx?: MerchantApplicationDbTx,
): Promise<MerchantApplicationRecord | null> {
  const executor = tx ?? getDb();
  return selectApplicationById(executor, applicationId);
}

export async function findPendingDuplicate(
  contactEmail: string,
  businessName: string,
  tx?: MerchantApplicationDbTx,
): Promise<MerchantApplicationRecord | null> {
  const executor = tx ?? getDb();
  const normalizedEmail = normalizeApplicationEmail(contactEmail);
  const normalizedBusinessName = normalizeApplicationBusinessName(businessName);

  const rows = await executor
    .select({
      id: merchantApplications.id,
      status: merchantApplications.status,
      businessName: merchantApplications.businessName,
      contactName: merchantApplications.contactName,
      contactEmail: merchantApplications.contactEmail,
      contactPhone: merchantApplications.contactPhone,
      cityId: merchantApplications.cityId,
      zoneId: merchantApplications.zoneId,
      cityName: cities.name,
      zoneName: zones.name,
      description: merchantApplications.description,
      message: merchantApplications.message,
      merchantId: merchantApplications.merchantId,
      reviewedAt: merchantApplications.reviewedAt,
      reviewedByUserId: merchantApplications.reviewedByUserId,
      rejectionReason: merchantApplications.rejectionReason,
      createdAt: merchantApplications.createdAt,
      updatedAt: merchantApplications.updatedAt,
    })
    .from(merchantApplications)
    .innerJoin(cities, eq(cities.id, merchantApplications.cityId))
    .innerJoin(zones, eq(zones.id, merchantApplications.zoneId))
    .where(
      and(
        eq(merchantApplications.status, "PENDING"),
        sql`lower(btrim(${merchantApplications.contactEmail})) = ${normalizedEmail}`,
        sql`lower(regexp_replace(btrim(${merchantApplications.businessName}), '\\s+', ' ', 'g')) = ${normalizedBusinessName}`,
      ),
    )
    .limit(1);

  const row = rows[0];
  return row ? mapApplicationRow(row) : null;
}

export async function countPendingMerchantApplicationsByEmail(
  contactEmail: string,
  tx?: MerchantApplicationDbTx,
): Promise<number> {
  const executor = tx ?? getDb();
  const normalizedEmail = normalizeApplicationEmail(contactEmail);

  const rows = await executor
    .select({ count: count() })
    .from(merchantApplications)
    .where(
      and(
        eq(merchantApplications.status, "PENDING"),
        sql`lower(btrim(${merchantApplications.contactEmail})) = ${normalizedEmail}`,
      ),
    );

  return Number(rows[0]?.count ?? 0);
}

export async function markApproved(
  input: MarkApprovedInput,
  tx?: MerchantApplicationDbTx,
): Promise<MerchantApplicationRecord | null> {
  const executor = tx ?? getDb();
  const now = new Date();
  const updated = await executor
    .update(merchantApplications)
    .set({
      status: "APPROVED",
      merchantId: input.merchantId,
      reviewedAt: now,
      reviewedByUserId: input.reviewedByUserId,
      rejectionReason: "",
      updatedAt: now,
    })
    .where(
      and(
        eq(merchantApplications.id, input.applicationId),
        eq(merchantApplications.status, "PENDING"),
      ),
    )
    .returning({ id: merchantApplications.id });

  const id = updated[0]?.id;
  if (!id) {
    return null;
  }

  return selectApplicationById(executor, id);
}

export async function markRejected(
  input: MarkRejectedInput,
  tx?: MerchantApplicationDbTx,
): Promise<MerchantApplicationRecord | null> {
  const executor = tx ?? getDb();
  const now = new Date();
  const updated = await executor
    .update(merchantApplications)
    .set({
      status: "REJECTED",
      merchantId: null,
      reviewedAt: now,
      reviewedByUserId: input.reviewedByUserId,
      rejectionReason: input.rejectionReason,
      updatedAt: now,
    })
    .where(
      and(
        eq(merchantApplications.id, input.applicationId),
        eq(merchantApplications.status, "PENDING"),
      ),
    )
    .returning({ id: merchantApplications.id });

  const id = updated[0]?.id;
  if (!id) {
    return null;
  }

  return selectApplicationById(executor, id);
}
