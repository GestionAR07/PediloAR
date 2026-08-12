import type { MerchantOperationalStatus } from "@/domain/merchant/operational-availability";
import type { MerchantStatus } from "@/domain/merchant/enums";

export type MerchantOperationalPresentation = {
  headline: string;
  description: string;
  canManagePause: boolean;
  statusReason: string | null;
};

export function getMerchantOperationalPresentation(input: {
  operationalStatus: MerchantOperationalStatus;
  merchantStatus: MerchantStatus;
  resumesAtLabel: string | null;
}): MerchantOperationalPresentation {
  switch (input.operationalStatus) {
    case "ACCEPTING":
      return {
        headline: "Tomando pedidos",
        description: "Los clientes pueden realizar pedidos normalmente.",
        canManagePause: true,
        statusReason: null,
      };
    case "TEMPORARILY_PAUSED":
      return {
        headline: "Pedidos pausados",
        description: input.resumesAtLabel
          ? `Se reanudan automáticamente a las ${input.resumesAtLabel}.`
          : "Se reanudarán automáticamente al vencer la pausa.",
        canManagePause: true,
        statusReason: null,
      };
    case "MANUALLY_PAUSED":
      return {
        headline: "Pedidos pausados",
        description: "No se reanudarán hasta que los actives nuevamente.",
        canManagePause: true,
        statusReason: null,
      };
    case "NOT_ACTIVE":
      if (input.merchantStatus === "DRAFT") {
        return {
          headline: "Comercio en preparación",
          description:
            "Tu comercio todavía no está activo para recibir pedidos.",
          canManagePause: false,
          statusReason: "DRAFT",
        };
      }
      if (input.merchantStatus === "SUSPENDED") {
        return {
          headline: "Comercio suspendido",
          description:
            "El comercio está suspendido por la plataforma y no puede recibir pedidos.",
          canManagePause: false,
          statusReason: "SUSPENDED",
        };
      }
      return {
        headline: "No disponible",
        description: "Este comercio no puede recibir pedidos.",
        canManagePause: false,
        statusReason: input.merchantStatus,
      };
  }
}
