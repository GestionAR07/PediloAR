import "server-only";

import {
  createCity as createCityUseCase,
  createProvince as createProvinceUseCase,
  createZone as createZoneUseCase,
  type CreateCityInput,
  type CreateProvinceInput,
  type CreateZoneInput,
  type GeographyWriteDeps,
} from "@/application/geography/write-geography";
import {
  createMerchant as createMerchantUseCase,
  type CreateMerchantDeps,
  type CreateMerchantInput,
} from "@/application/merchant/create-merchant";
import {
  inviteMerchantOwner as inviteMerchantOwnerUseCase,
  type InviteMerchantOwnerDeps,
  type InviteMerchantOwnerInput,
} from "@/application/merchant/invite-merchant-owner";
import { appAbsoluteUrl } from "@/config/app-base-url";
import {
  findCityById,
  findProvinceById,
  findZoneById,
  insertCity,
  insertProvince,
  insertZone,
} from "@/infrastructure/db/repositories/geography-repository";
import {
  findMerchantBySlug,
  findMerchantDetailById,
  insertMerchantDraft,
} from "@/infrastructure/db/repositories/merchant-repository";
import {
  ensureUserProfile,
  findMerchantUser,
  insertMerchantOwner,
} from "@/infrastructure/db/repositories/merchant-user-repository";
import { isUniqueViolation } from "@/infrastructure/db/pg-errors";
import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin";
import {
  findAuthUserByEmail,
  inviteAuthUserByEmail,
} from "@/infrastructure/supabase/auth-admin";
import { hasSupabaseSecretKey } from "@/infrastructure/supabase/env";
import { requirePlatformAdmin } from "@/server/auth/authorization";
import { sanitizeInternalPath } from "@/lib/safe-redirect";

async function requireAdminGate(): Promise<void> {
  await requirePlatformAdmin();
}

function geographyDeps(): GeographyWriteDeps {
  return {
    requirePlatformAdmin: requireAdminGate,
    findProvinceById,
    findCityById,
    insertProvince,
    insertCity,
    insertZone,
    isUniqueViolation,
  };
}

function createMerchantDeps(): CreateMerchantDeps {
  return {
    requirePlatformAdmin: requireAdminGate,
    findCityById,
    findZoneById,
    findMerchantBySlug,
    insertMerchantDraft,
    isUniqueViolation,
  };
}

function inviteDeps(): InviteMerchantOwnerDeps {
  return {
    requirePlatformAdmin: requireAdminGate,
    findMerchantById: async (id) => {
      const row = await findMerchantDetailById(id);
      return row ? { id: row.id } : null;
    },
    findAuthUserByEmail: async (email) => {
      const admin = createSupabaseAdminClient();
      return findAuthUserByEmail(admin, email);
    },
    inviteAuthUser: async (input) => {
      const admin = createSupabaseAdminClient();
      return inviteAuthUserByEmail(admin, input);
    },
    ensureUserProfile,
    findMembership: findMerchantUser,
    insertOwnerMembership: async (input) => {
      await insertMerchantOwner(input);
    },
    getInviteRedirectTo: () => {
      const next = sanitizeInternalPath("/set-password", "/set-password");
      return appAbsoluteUrl(`/auth/confirm?next=${encodeURIComponent(next)}`);
    },
    secretConfigured: () => hasSupabaseSecretKey(),
  };
}

export async function createProvinceApp(input: CreateProvinceInput) {
  return createProvinceUseCase(input, geographyDeps());
}

export async function createCityApp(input: CreateCityInput) {
  return createCityUseCase(input, geographyDeps());
}

export async function createZoneApp(input: CreateZoneInput) {
  return createZoneUseCase(input, geographyDeps());
}

export async function createMerchantApp(input: CreateMerchantInput) {
  return createMerchantUseCase(input, createMerchantDeps());
}

export async function inviteMerchantOwnerApp(input: InviteMerchantOwnerInput) {
  return inviteMerchantOwnerUseCase(input, inviteDeps());
}
