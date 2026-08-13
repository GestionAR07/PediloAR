import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../client";
import { merchantPaymentMethods } from "../schema";

export type MerchantPaymentMethodRecord = {
  id: string;
  merchantId: string;
  code: string;
  label: string;
  instructions: string;
  active: boolean;
  sortOrder: number;
};

export type UpsertMerchantPaymentMethodInput = {
  code: string;
  label: string;
  instructions: string;
  active: boolean;
  sortOrder: number;
};

const RETURNING = {
  id: merchantPaymentMethods.id,
  merchantId: merchantPaymentMethods.merchantId,
  code: merchantPaymentMethods.code,
  label: merchantPaymentMethods.label,
  instructions: merchantPaymentMethods.instructions,
  active: merchantPaymentMethods.active,
  sortOrder: merchantPaymentMethods.sortOrder,
};

export async function listMerchantPaymentMethods(
  merchantId: string,
): Promise<MerchantPaymentMethodRecord[]> {
  const db = getDb();
  return db
    .select(RETURNING)
    .from(merchantPaymentMethods)
    .where(eq(merchantPaymentMethods.merchantId, merchantId))
    .orderBy(
      asc(merchantPaymentMethods.sortOrder),
      asc(merchantPaymentMethods.code),
    );
}

/**
 * Upserts the provided methods for one merchant in a single transaction.
 * UNIQUE(merchant_id, code) prevents duplicates; existing instructions are
 * overwritten with the supplied values (callers keep inactive instructions).
 */
export async function upsertMerchantPaymentMethods(
  merchantId: string,
  methods: readonly UpsertMerchantPaymentMethodInput[],
): Promise<MerchantPaymentMethodRecord[]> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const result: MerchantPaymentMethodRecord[] = [];

    for (const method of methods) {
      const existing = await tx
        .select({ id: merchantPaymentMethods.id })
        .from(merchantPaymentMethods)
        .where(
          and(
            eq(merchantPaymentMethods.merchantId, merchantId),
            eq(merchantPaymentMethods.code, method.code),
          ),
        )
        .limit(1);

      if (existing[0]) {
        const updated = await tx
          .update(merchantPaymentMethods)
          .set({
            label: method.label,
            instructions: method.instructions,
            active: method.active,
            sortOrder: method.sortOrder,
            updatedAt: new Date(),
          })
          .where(eq(merchantPaymentMethods.id, existing[0].id))
          .returning(RETURNING);
        const row = updated[0];
        if (!row) {
          throw new Error("Failed to update merchant payment method");
        }
        result.push(row);
        continue;
      }

      const inserted = await tx
        .insert(merchantPaymentMethods)
        .values({
          merchantId,
          code: method.code,
          label: method.label,
          instructions: method.instructions,
          active: method.active,
          sortOrder: method.sortOrder,
        })
        .returning(RETURNING);
      const row = inserted[0];
      if (!row) {
        throw new Error("Failed to insert merchant payment method");
      }
      result.push(row);
    }

    return result;
  });
}
