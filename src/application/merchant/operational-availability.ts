import {
  addMinutesToInstant,
  getMerchantOperationalStatus,
  isTemporaryPauseDurationMinutes,
  type TemporaryPauseDurationMinutes,
} from "@/domain/merchant/operational-availability";
import type { MerchantStatus } from "@/domain/merchant/enums";
import { err, ok, type Result } from "@/domain/shared/result";
import { isValidUuid } from "@/lib/uuid";

export type MerchantOperationalError = {
  code: string;
  message: string;
};

export const MERCHANT_OPERATIONAL_ALLOWED_ROLES = ["OWNER", "STAFF"] as const;

export type MerchantOperationalDeps = {
  requireOperationalAccess: (merchantId: string) => Promise<void>;
  findMerchantOperationalState: (merchantId: string) => Promise<{
    id: string;
    status: MerchantStatus;
    acceptingOrders: boolean;
    pausedUntil: Date | null;
  } | null>;
  setMerchantOperationalState: (
    merchantId: string,
    state: { acceptingOrders: boolean; pausedUntil: Date | null },
  ) => Promise<{
    id: string;
    acceptingOrders: boolean;
    pausedUntil: Date | null;
  } | null>;
  now: () => Date;
};

async function loadActiveMerchant(
  merchantId: string,
  deps: MerchantOperationalDeps,
): Promise<
  Result<
    {
      id: string;
      status: MerchantStatus;
      acceptingOrders: boolean;
      pausedUntil: Date | null;
    },
    MerchantOperationalError
  >
> {
  if (!isValidUuid(merchantId)) {
    return err({
      code: "MERCHANT_NOT_FOUND",
      message: "El comercio no existe.",
    });
  }

  const merchant = await deps.findMerchantOperationalState(merchantId);
  if (!merchant) {
    return err({
      code: "MERCHANT_NOT_FOUND",
      message: "El comercio no existe.",
    });
  }

  if (merchant.status !== "ACTIVE") {
    return err({
      code: "MERCHANT_NOT_ACTIVE",
      message:
        merchant.status === "DRAFT"
          ? "Tu comercio todavía no está activo para recibir pedidos."
          : "El comercio no puede recibir pedidos en su estado actual.",
    });
  }

  return ok(merchant);
}

export async function pauseMerchantOrdersTemporarily(
  merchantId: string,
  durationMinutes: number,
  deps: MerchantOperationalDeps,
): Promise<
  Result<
    {
      pausedUntil: Date;
      operationalStatus: ReturnType<typeof getMerchantOperationalStatus>;
    },
    MerchantOperationalError
  >
> {
  await deps.requireOperationalAccess(merchantId);

  if (!isTemporaryPauseDurationMinutes(durationMinutes)) {
    return err({
      code: "INVALID_DURATION",
      message: "La duración de pausa no es válida.",
    });
  }

  const merchantResult = await loadActiveMerchant(merchantId, deps);
  if (!merchantResult.ok) {
    return merchantResult;
  }

  const now = deps.now();
  const pausedUntil = addMinutesToInstant(now, durationMinutes);

  const updated = await deps.setMerchantOperationalState(merchantId, {
    acceptingOrders: true,
    pausedUntil,
  });
  if (!updated) {
    return err({
      code: "MERCHANT_NOT_FOUND",
      message: "El comercio no existe.",
    });
  }

  return ok({
    pausedUntil,
    operationalStatus: getMerchantOperationalStatus(
      { ...merchantResult.value, acceptingOrders: true, pausedUntil },
      now,
    ),
  });
}

export async function pauseMerchantOrdersUntilManualResume(
  merchantId: string,
  deps: MerchantOperationalDeps,
): Promise<
  Result<
    { operationalStatus: ReturnType<typeof getMerchantOperationalStatus> },
    MerchantOperationalError
  >
> {
  await deps.requireOperationalAccess(merchantId);

  const merchantResult = await loadActiveMerchant(merchantId, deps);
  if (!merchantResult.ok) {
    return merchantResult;
  }

  const now = deps.now();
  const updated = await deps.setMerchantOperationalState(merchantId, {
    acceptingOrders: false,
    pausedUntil: null,
  });
  if (!updated) {
    return err({
      code: "MERCHANT_NOT_FOUND",
      message: "El comercio no existe.",
    });
  }

  return ok({
    operationalStatus: getMerchantOperationalStatus(
      {
        ...merchantResult.value,
        acceptingOrders: false,
        pausedUntil: null,
      },
      now,
    ),
  });
}

export async function resumeMerchantOrders(
  merchantId: string,
  deps: MerchantOperationalDeps,
): Promise<
  Result<
    { operationalStatus: ReturnType<typeof getMerchantOperationalStatus> },
    MerchantOperationalError
  >
> {
  await deps.requireOperationalAccess(merchantId);

  const merchantResult = await loadActiveMerchant(merchantId, deps);
  if (!merchantResult.ok) {
    return merchantResult;
  }

  const now = deps.now();
  const updated = await deps.setMerchantOperationalState(merchantId, {
    acceptingOrders: true,
    pausedUntil: null,
  });
  if (!updated) {
    return err({
      code: "MERCHANT_NOT_FOUND",
      message: "El comercio no existe.",
    });
  }

  return ok({
    operationalStatus: getMerchantOperationalStatus(
      {
        ...merchantResult.value,
        acceptingOrders: true,
        pausedUntil: null,
      },
      now,
    ),
  });
}

export type { TemporaryPauseDurationMinutes };
