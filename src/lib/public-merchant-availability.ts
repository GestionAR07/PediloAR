import type { MerchantOperationalStatus } from "@/domain/merchant/operational-availability";

export type PublicMerchantAvailabilityPresentation = {
  label: string;
  tone: "available" | "paused" | "unavailable";
};

/** Buyer-facing copy — distinct from merchant backoffice presentation. */
export function getPublicMerchantAvailabilityPresentation(
  operationalStatus: MerchantOperationalStatus,
): PublicMerchantAvailabilityPresentation {
  switch (operationalStatus) {
    case "ACCEPTING":
      return { label: "Disponible", tone: "available" };
    case "TEMPORARILY_PAUSED":
    case "MANUALLY_PAUSED":
      return { label: "Pausado temporalmente", tone: "paused" };
    case "NOT_ACTIVE":
      return { label: "No disponible", tone: "unavailable" };
  }
}
