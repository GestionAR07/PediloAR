import { err, ok, type Result } from "@/domain/shared/result";

export type MerchantActivationReadiness = {
  merchantId: string;
  status: string;
  pickupEnabled: boolean;
  merchantDeliveryEnabled: boolean;
  activeOwnerCount: number;
  activeDeliveryZoneCount: number;
  activePaymentMethodCount: number;
  activeCatalogProductCount: number;
};

export type MerchantActivationBlocker =
  | "OWNER_REQUIRED"
  | "FULFILLMENT_REQUIRED"
  | "DELIVERY_ZONE_REQUIRED"
  | "PAYMENT_METHOD_REQUIRED"
  | "CATALOG_PRODUCT_REQUIRED";

export const MERCHANT_ACTIVATION_BLOCKER_LABELS: Record<
  MerchantActivationBlocker,
  string
> = {
  OWNER_REQUIRED: "Asigná al menos un propietario activo.",
  FULFILLMENT_REQUIRED: "Activá retiro o delivery propio.",
  DELIVERY_ZONE_REQUIRED:
    "Configurá al menos una zona activa para el delivery propio.",
  PAYMENT_METHOD_REQUIRED: "Activá al menos un medio de pago.",
  CATALOG_PRODUCT_REQUIRED:
    "Publicá al menos un producto disponible dentro de una categoría activa.",
};

export type MerchantActivationError = {
  code: string;
  message: string;
  blockers?: MerchantActivationBlocker[];
};

export type ActivateMerchantDeps = {
  requirePlatformAdmin: () => Promise<void>;
  findActivationReadiness: (
    merchantId: string,
  ) => Promise<MerchantActivationReadiness | null>;
  activateDraftMerchant: (
    merchantId: string,
  ) => Promise<{ id: string; status: string } | null>;
};

export function getMerchantActivationBlockers(
  readiness: MerchantActivationReadiness,
): MerchantActivationBlocker[] {
  const blockers: MerchantActivationBlocker[] = [];

  if (readiness.activeOwnerCount < 1) {
    blockers.push("OWNER_REQUIRED");
  }
  if (!readiness.pickupEnabled && !readiness.merchantDeliveryEnabled) {
    blockers.push("FULFILLMENT_REQUIRED");
  }
  if (
    readiness.merchantDeliveryEnabled &&
    readiness.activeDeliveryZoneCount < 1
  ) {
    blockers.push("DELIVERY_ZONE_REQUIRED");
  }
  if (readiness.activePaymentMethodCount < 1) {
    blockers.push("PAYMENT_METHOD_REQUIRED");
  }
  if (readiness.activeCatalogProductCount < 1) {
    blockers.push("CATALOG_PRODUCT_REQUIRED");
  }

  return blockers;
}

export async function activateMerchant(
  merchantIdInput: string,
  deps: ActivateMerchantDeps,
): Promise<
  Result<
    { merchantId: string; status: "ACTIVE"; alreadyActive: boolean },
    MerchantActivationError
  >
> {
  await deps.requirePlatformAdmin();

  const merchantId = merchantIdInput.trim();
  if (!merchantId) {
    return err({
      code: "INVALID_MERCHANT",
      message: "El comercio no es válido.",
    });
  }

  const readiness = await deps.findActivationReadiness(merchantId);
  if (!readiness) {
    return err({
      code: "MERCHANT_NOT_FOUND",
      message: "El comercio no existe.",
    });
  }

  if (readiness.status === "ACTIVE") {
    return ok({ merchantId, status: "ACTIVE", alreadyActive: true });
  }

  if (readiness.status !== "DRAFT") {
    return err({
      code: "INVALID_STATUS",
      message:
        "Solo se puede activar un comercio que esté en estado borrador. La reactivación de comercios suspendidos se gestiona por separado.",
    });
  }

  const blockers = getMerchantActivationBlockers(readiness);
  if (blockers.length > 0) {
    return err({
      code: "MERCHANT_NOT_READY",
      message: `Antes de activar el comercio: ${blockers
        .map((blocker) => MERCHANT_ACTIVATION_BLOCKER_LABELS[blocker])
        .join(" ")}`,
      blockers,
    });
  }

  const activated = await deps.activateDraftMerchant(merchantId);
  if (!activated || activated.status !== "ACTIVE") {
    return err({
      code: "ACTIVATION_FAILED",
      message:
        "No se pudo activar el comercio. Actualizá la página y volvé a intentarlo.",
    });
  }

  return ok({ merchantId, status: "ACTIVE", alreadyActive: false });
}
