import { err, ok, type Result } from "@/domain/shared/result";
import { isValidSlug, normalizeSlug } from "@/lib/slug";
import type { ApplicationError } from "../geography/write-geography";

export type CreateMerchantInput = {
  name: string;
  slug: string;
  description?: string;
  cityId: string;
  zoneId: string;
  pickupEnabled: boolean;
  merchantDeliveryEnabled: boolean;
  preparationMinutes: number;
  /** Ignored — server forces DRAFT */
  status?: string;
  /** Ignored — server forces false */
  platformDeliveryEnabled?: boolean;
};

export type CreateMerchantDeps = {
  requirePlatformAdmin: () => Promise<void>;
  findCityById: (id: string) => Promise<{ id: string } | null>;
  findZoneById: (id: string) => Promise<{ id: string; cityId: string } | null>;
  findMerchantBySlug: (slug: string) => Promise<{ id: string } | null>;
  insertMerchantDraft: (input: {
    name: string;
    slug: string;
    description: string;
    cityId: string;
    zoneId: string;
    pickupEnabled: boolean;
    merchantDeliveryEnabled: boolean;
    preparationMinutes: number;
  }) => Promise<{
    id: string;
    status: string;
    platformDeliveryEnabled: boolean;
  }>;
  isUniqueViolation: (error: unknown) => boolean;
};

/**
 * Assists platform admin in creating a DRAFT merchant.
 * Always forces status=DRAFT and platformDeliveryEnabled=false.
 */
export async function createMerchant(
  input: CreateMerchantInput,
  deps: CreateMerchantDeps,
): Promise<
  Result<
    { id: string; status: string; platformDeliveryEnabled: boolean },
    ApplicationError
  >
> {
  await deps.requirePlatformAdmin();

  const name = input.name.trim();
  const slug = normalizeSlug(input.slug);
  const description = (input.description ?? "").trim();
  const cityId = input.cityId.trim();
  const zoneId = input.zoneId.trim();
  const preparationMinutes = Number(input.preparationMinutes);

  if (!name) {
    return err({ code: "INVALID_NAME", message: "El nombre es obligatorio." });
  }
  if (!isValidSlug(slug)) {
    return err({
      code: "INVALID_SLUG",
      message: "El slug no es válido (minúsculas, números y guiones).",
    });
  }
  if (!cityId || !zoneId) {
    return err({
      code: "INVALID_GEOGRAPHY",
      message: "Seleccioná ciudad y zona.",
    });
  }
  if (
    !Number.isInteger(preparationMinutes) ||
    preparationMinutes < 0 ||
    preparationMinutes > 24 * 60
  ) {
    return err({
      code: "INVALID_PREPARATION",
      message: "El tiempo de preparación no es válido.",
    });
  }

  const city = await deps.findCityById(cityId);
  if (!city) {
    return err({
      code: "CITY_NOT_FOUND",
      message: "La ciudad seleccionada no existe.",
    });
  }

  const zone = await deps.findZoneById(zoneId);
  if (!zone) {
    return err({
      code: "ZONE_NOT_FOUND",
      message: "La zona seleccionada no existe.",
    });
  }

  if (zone.cityId !== city.id) {
    return err({
      code: "ZONE_CITY_MISMATCH",
      message: "La zona no pertenece a la ciudad seleccionada.",
    });
  }

  const existingSlug = await deps.findMerchantBySlug(slug);
  if (existingSlug) {
    return err({
      code: "DUPLICATE_SLUG",
      message: "Ya existe un comercio con ese slug.",
    });
  }

  try {
    const merchant = await deps.insertMerchantDraft({
      name,
      slug,
      description,
      cityId: city.id,
      zoneId: zone.id,
      pickupEnabled: Boolean(input.pickupEnabled),
      merchantDeliveryEnabled: Boolean(input.merchantDeliveryEnabled),
      preparationMinutes,
    });

    // Defense in depth: never trust insert return for invariants (tests mock enforcement)
    if (
      merchant.status !== "DRAFT" ||
      merchant.platformDeliveryEnabled !== false
    ) {
      return err({
        code: "INVARIANT_VIOLATION",
        message: "El comercio no respetó las reglas de onboarding.",
      });
    }

    return ok({
      id: merchant.id,
      status: merchant.status,
      platformDeliveryEnabled: merchant.platformDeliveryEnabled,
    });
  } catch (error) {
    if (deps.isUniqueViolation(error)) {
      return err({
        code: "DUPLICATE_SLUG",
        message: "Ya existe un comercio con ese slug.",
      });
    }
    return err({
      code: "WRITE_FAILED",
      message: "No se pudo crear el comercio.",
    });
  }
}
