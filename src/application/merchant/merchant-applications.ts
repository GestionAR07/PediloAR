import { err, ok, type Result } from "@/domain/shared/result";
import { isValidEmailFormat, normalizeEmail } from "@/lib/email";
import { isValidSlug, normalizeSlug } from "@/lib/slug";
import type {
  MerchantApplicationDbTx,
  MerchantApplicationRecord,
} from "@/infrastructure/db/repositories/merchant-application-repository";
import type {
  MerchantDbTx,
  MerchantDetailRecord,
} from "@/infrastructure/db/repositories/merchant-repository";
import type { AuthorizedContext } from "@/server/auth/authorization";

export type MerchantApplicationError = {
  code: string;
  message: string;
};

export type SubmitMerchantApplicationInput = {
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  cityId: string;
  zoneId: string;
  description?: string;
  message?: string;
};

export type ApproveMerchantApplicationInput = {
  applicationId: string;
  slug: string;
  pickupEnabled: boolean;
  merchantDeliveryEnabled: boolean;
  preparationMinutes: number;
};

export type RejectMerchantApplicationInput = {
  applicationId: string;
  rejectionReason: string;
};

type MerchantApplicationTx = MerchantApplicationDbTx & MerchantDbTx;

class MerchantApplicationAbort extends Error {
  readonly applicationError: MerchantApplicationError;

  constructor(applicationError: MerchantApplicationError) {
    super(applicationError.message);
    this.name = "MerchantApplicationAbort";
    this.applicationError = applicationError;
  }
}

function abort(error: MerchantApplicationError): never {
  throw new MerchantApplicationAbort(error);
}

function mapAbort(error: unknown): MerchantApplicationError | null {
  if (error instanceof MerchantApplicationAbort) {
    return error.applicationError;
  }
  return null;
}

export type SubmitMerchantApplicationDeps = {
  findCityById: (id: string) => Promise<{ id: string } | null>;
  findZoneById: (id: string) => Promise<{ id: string; cityId: string } | null>;
  findPendingDuplicate: (
    contactEmail: string,
    businessName: string,
  ) => Promise<MerchantApplicationRecord | null>;
  insertMerchantApplication: (input: {
    businessName: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    cityId: string;
    zoneId: string;
    description: string;
    message: string;
  }) => Promise<MerchantApplicationRecord>;
};

export type ApproveMerchantApplicationDeps = {
  requirePlatformAdmin: () => Promise<AuthorizedContext>;
  findMerchantBySlug: (slug: string) => Promise<{ id: string } | null>;
  runTransaction: <T>(
    fn: (tx: MerchantApplicationTx) => Promise<T>,
  ) => Promise<T>;
  findMerchantApplicationById: (
    applicationId: string,
    tx: MerchantApplicationTx,
  ) => Promise<MerchantApplicationRecord | null>;
  insertMerchantDraft: (
    input: {
      name: string;
      slug: string;
      description: string;
      cityId: string;
      zoneId: string;
      pickupEnabled: boolean;
      merchantDeliveryEnabled: boolean;
      preparationMinutes: number;
    },
    tx: MerchantApplicationTx,
  ) => Promise<MerchantDetailRecord>;
  markApproved: (
    input: {
      applicationId: string;
      merchantId: string;
      reviewedByUserId: string;
    },
    tx: MerchantApplicationTx,
  ) => Promise<MerchantApplicationRecord | null>;
  isUniqueViolation: (error: unknown) => boolean;
};

export type RejectMerchantApplicationDeps = {
  requirePlatformAdmin: () => Promise<AuthorizedContext>;
  markRejected: (input: {
    applicationId: string;
    reviewedByUserId: string;
    rejectionReason: string;
  }) => Promise<MerchantApplicationRecord | null>;
};

export async function submitMerchantApplication(
  input: SubmitMerchantApplicationInput,
  deps: SubmitMerchantApplicationDeps,
): Promise<Result<MerchantApplicationRecord, MerchantApplicationError>> {
  const businessName = input.businessName.trim();
  const contactName = input.contactName.trim();
  const contactEmail = normalizeEmail(input.contactEmail);
  const contactPhone = input.contactPhone.trim();
  const cityId = input.cityId.trim();
  const zoneId = input.zoneId.trim();
  const description = (input.description ?? "").trim();
  const message = (input.message ?? "").trim();

  if (!businessName) {
    return err({
      code: "INVALID_BUSINESS_NAME",
      message: "El nombre del comercio es obligatorio.",
    });
  }
  if (!contactName) {
    return err({
      code: "INVALID_CONTACT_NAME",
      message: "El nombre de contacto es obligatorio.",
    });
  }
  if (!isValidEmailFormat(contactEmail)) {
    return err({
      code: "INVALID_EMAIL",
      message: "El email de contacto no es válido.",
    });
  }
  if (!contactPhone) {
    return err({
      code: "INVALID_CONTACT_PHONE",
      message: "El teléfono de contacto es obligatorio.",
    });
  }
  if (!cityId || !zoneId) {
    return err({
      code: "INVALID_GEOGRAPHY",
      message: "Seleccioná ciudad y zona.",
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

  const pendingDuplicate = await deps.findPendingDuplicate(
    contactEmail,
    businessName,
  );
  if (pendingDuplicate) {
    return err({
      code: "PENDING_DUPLICATE",
      message: "Ya existe una solicitud pendiente con ese email y comercio.",
    });
  }

  const application = await deps.insertMerchantApplication({
    businessName,
    contactName,
    contactEmail,
    contactPhone,
    cityId: city.id,
    zoneId: zone.id,
    description,
    message,
  });

  return ok(application);
}

export async function approveMerchantApplication(
  input: ApproveMerchantApplicationInput,
  deps: ApproveMerchantApplicationDeps,
): Promise<
  Result<
    { application: MerchantApplicationRecord; merchant: MerchantDetailRecord },
    MerchantApplicationError
  >
> {
  const admin = await deps.requirePlatformAdmin();
  const reviewedByUserId = admin.user.id;

  const applicationId = input.applicationId.trim();
  const slug = normalizeSlug(input.slug);
  const preparationMinutes = Number(input.preparationMinutes);

  if (!applicationId) {
    return err({
      code: "INVALID_APPLICATION_ID",
      message: "La solicitud no es válida.",
    });
  }
  if (!isValidSlug(slug)) {
    return err({
      code: "INVALID_SLUG",
      message: "El slug no es válido (minúsculas, números y guiones).",
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

  const existingSlug = await deps.findMerchantBySlug(slug);
  if (existingSlug) {
    return err({
      code: "DUPLICATE_SLUG",
      message: "Ya existe un comercio con ese slug.",
    });
  }

  try {
    const result = await deps.runTransaction(async (tx) => {
      const application = await deps.findMerchantApplicationById(
        applicationId,
        tx,
      );
      if (!application) {
        abort({
          code: "APPLICATION_NOT_FOUND",
          message: "La solicitud no existe.",
        });
      }
      if (application.status !== "PENDING") {
        abort({
          code: "APPLICATION_NOT_PENDING",
          message: "La solicitud ya fue revisada.",
        });
      }

      const merchant = await deps.insertMerchantDraft(
        {
          name: application.businessName,
          slug,
          description: application.description,
          cityId: application.cityId,
          zoneId: application.zoneId,
          pickupEnabled: Boolean(input.pickupEnabled),
          merchantDeliveryEnabled: Boolean(input.merchantDeliveryEnabled),
          preparationMinutes,
        },
        tx,
      );

      if (merchant.status !== "DRAFT" || merchant.platformDeliveryEnabled) {
        abort({
          code: "INVARIANT_VIOLATION",
          message: "El comercio no respetó las reglas de onboarding.",
        });
      }

      const approved = await deps.markApproved(
        {
          applicationId,
          merchantId: merchant.id,
          reviewedByUserId,
        },
        tx,
      );
      if (!approved) {
        abort({
          code: "APPROVAL_MARK_FAILED",
          message: "No se pudo aprobar la solicitud.",
        });
      }

      return { application: approved, merchant };
    });

    return ok(result);
  } catch (error) {
    const aborted = mapAbort(error);
    if (aborted) {
      return err(aborted);
    }
    if (deps.isUniqueViolation(error)) {
      return err({
        code: "DUPLICATE_SLUG",
        message: "Ya existe un comercio con ese slug.",
      });
    }
    return err({
      code: "WRITE_FAILED",
      message: "No se pudo aprobar la solicitud.",
    });
  }
}

export async function rejectMerchantApplication(
  input: RejectMerchantApplicationInput,
  deps: RejectMerchantApplicationDeps,
): Promise<Result<MerchantApplicationRecord, MerchantApplicationError>> {
  const admin = await deps.requirePlatformAdmin();
  const reviewedByUserId = admin.user.id;

  const applicationId = input.applicationId.trim();
  const rejectionReason = input.rejectionReason.trim();

  if (!applicationId) {
    return err({
      code: "INVALID_APPLICATION_ID",
      message: "La solicitud no es válida.",
    });
  }
  if (!rejectionReason) {
    return err({
      code: "INVALID_REJECTION_REASON",
      message: "El motivo de rechazo es obligatorio.",
    });
  }

  const rejected = await deps.markRejected({
    applicationId,
    reviewedByUserId,
    rejectionReason,
  });
  if (!rejected) {
    return err({
      code: "APPLICATION_NOT_FOUND_OR_NOT_PENDING",
      message: "La solicitud no existe o ya fue revisada.",
    });
  }

  return ok(rejected);
}
