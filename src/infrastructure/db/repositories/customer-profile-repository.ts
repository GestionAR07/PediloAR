import "server-only";

import { eq } from "drizzle-orm";
import type { ValidCustomerContactProfile } from "@/application/customer/profile";
import { getDb } from "@/infrastructure/db/client";
import { userProfiles } from "@/infrastructure/db/schema";

export async function updateCustomerContactProfile(
  userId: string,
  profile: ValidCustomerContactProfile,
): Promise<void> {
  const rows = await getDb()
    .update(userProfiles)
    .set({
      displayName: profile.displayName,
      phone: profile.phone,
      updatedAt: new Date(),
    })
    .where(eq(userProfiles.id, userId))
    .returning({ id: userProfiles.id });

  if (!rows[0]) {
    throw new Error("Authenticated user profile was not found");
  }
}
