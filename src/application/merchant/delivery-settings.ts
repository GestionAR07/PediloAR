import { DomainError } from "@/domain/shared/errors";
import { err, ok, type Result } from "@/domain/shared/result";
import { parseMoneyInputToCents } from "@/lib/parse-money";
import { isValidUuid } from "@/lib/uuid";

export type DeliverySettingsApplicationError = {
  code: string;
  message: string;
};

export const DELIVERY_SETTINGS_ALLOWED_ROLES = ["OWNER", "STAFF"] as const;

/** Application-level ceiling. DB only requires estimated_minutes >= 0. */
export const MAX_DELIVERY_ESTIMATED_MINUTES = 1440;

export type ConfigurableCityZone = {
  id: string;
  name: string;
  cityName: string;
};

export type MerchantDeliveryZoneRow = {
  zoneId: string;
  zoneName: string;
  cityName: string;
  deliveryFeeCents: number;
  minimumOrderCents: number;
  estimatedMinutes: number;
  active: boolean;
};

export type DeliveryZoneSettingView = {
  zoneId: string;
  zoneName: string;
  cityName: string;
  configured: boolean;
  active: boolean;
  deliveryFeeCents: number | null;
  minimumOrderCents: number | null;
  estimatedMinutes: number | null;
};

export type DeliverySettingsView = {
  merchantDeliveryEnabled: boolean;
  pickupEnabled: boolean;
  cityName: string;
  zones: DeliveryZoneSettingView[];
};

export type SaveDeliveryZoneInput = {
  zoneId: string;
  active: boolean;
  feeInput: string;
  minimumInput: string;
  estimatedMinutesInput: string;
};

export type SaveMerchantDeliverySettingsInput = {
  merchantDeliveryEnabled: boolean;
  zones: readonly SaveDeliveryZoneInput[];
};

export type MerchantDeliveryContext = {
  id: string;
  cityId: string;
  cityName: string;
  pickupEnabled: boolean;
  merchantDeliveryEnabled: boolean;
};

export type DeliverySettingsWriteDeps = {
  requireDeliveryAccess: (merchantId: string) => Promise<void>;
  findMerchant: (merchantId: string) => Promise<MerchantDeliveryContext | null>;
  listZonesForCity: (cityId: string) => Promise<ConfigurableCityZone[]>;
  listDeliveryZones: (merchantId: string) => Promise<MerchantDeliveryZoneRow[]>;
  saveDeliverySettings: (
    merchantId: string,
    input: {
      merchantDeliveryEnabled: boolean;
      zones: readonly {
        zoneId: string;
        deliveryFeeCents: number;
        minimumOrderCents: number;
        estimatedMinutes: number;
        active: boolean;
      }[];
    },
  ) => Promise<MerchantDeliveryZoneRow[]>;
};

export function presentDeliverySettings(input: {
  merchant: MerchantDeliveryContext;
  cityZones: readonly ConfigurableCityZone[];
  rows: readonly MerchantDeliveryZoneRow[];
}): DeliverySettingsView {
  const byZoneId = new Map(input.rows.map((row) => [row.zoneId, row]));
  const zones = [...input.cityZones]
    .sort((left, right) => left.name.localeCompare(right.name, "es"))
    .map((zone) => {
      const existing = byZoneId.get(zone.id);
      return {
        zoneId: zone.id,
        zoneName: zone.name,
        cityName: zone.cityName,
        configured: Boolean(existing),
        active: existing?.active ?? false,
        deliveryFeeCents: existing?.deliveryFeeCents ?? null,
        minimumOrderCents: existing?.minimumOrderCents ?? null,
        estimatedMinutes: existing?.estimatedMinutes ?? null,
      };
    });

  return {
    merchantDeliveryEnabled: input.merchant.merchantDeliveryEnabled,
    pickupEnabled: input.merchant.pickupEnabled,
    cityName: input.merchant.cityName,
    zones,
  };
}

export async function listMerchantDeliverySettings(
  merchantId: string,
  deps: DeliverySettingsWriteDeps,
): Promise<Result<DeliverySettingsView, DeliverySettingsApplicationError>> {
  await deps.requireDeliveryAccess(merchantId);
  if (!isValidUuid(merchantId)) {
    return err({ code: "INVALID_MERCHANT", message: "Comercio inválido." });
  }

  const merchant = await deps.findMerchant(merchantId);
  if (!merchant) {
    return err({ code: "INVALID_MERCHANT", message: "Comercio inválido." });
  }

  const [cityZones, rows] = await Promise.all([
    deps.listZonesForCity(merchant.cityId),
    deps.listDeliveryZones(merchantId),
  ]);

  return ok(
    presentDeliverySettings({
      merchant,
      cityZones,
      rows,
    }),
  );
}

function isBlank(raw: string): boolean {
  return raw.trim() === "";
}

function shouldSkipUnconfiguredZone(
  input: SaveDeliveryZoneInput,
  configured: boolean,
): boolean {
  if (configured || input.active) {
    return false;
  }
  return (
    isBlank(input.feeInput) &&
    isBlank(input.minimumInput) &&
    isBlank(input.estimatedMinutesInput)
  );
}

function parseEstimatedMinutes(
  raw: string,
  zoneName: string,
): Result<number, DeliverySettingsApplicationError> {
  const trimmed = raw.trim();
  if (!trimmed) {
    return err({
      code: "INVALID_ESTIMATED_MINUTES",
      message: `Indicá el tiempo estimado para ${zoneName}.`,
    });
  }
  if (!/^\d+$/.test(trimmed)) {
    return err({
      code: "INVALID_ESTIMATED_MINUTES",
      message: `El tiempo estimado de ${zoneName} debe ser un entero en minutos.`,
    });
  }
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value < 0) {
    return err({
      code: "INVALID_ESTIMATED_MINUTES",
      message: `El tiempo estimado de ${zoneName} debe ser un entero mayor o igual a 0.`,
    });
  }
  if (value > MAX_DELIVERY_ESTIMATED_MINUTES) {
    return err({
      code: "INVALID_ESTIMATED_MINUTES",
      message: `El tiempo estimado de ${zoneName} no puede superar ${MAX_DELIVERY_ESTIMATED_MINUTES} minutos.`,
    });
  }
  return ok(value);
}

function parseMoneyField(
  raw: string,
  field: "fee" | "minimum",
  zoneName: string,
): Result<number, DeliverySettingsApplicationError> {
  try {
    return ok(parseMoneyInputToCents(raw));
  } catch (error) {
    if (error instanceof DomainError) {
      return err({
        code: field === "fee" ? "INVALID_DELIVERY_FEE" : "INVALID_MINIMUM",
        message:
          field === "fee"
            ? `El costo de envío de ${zoneName} no es válido.`
            : `El pedido mínimo de ${zoneName} no es válido.`,
      });
    }
    return err({
      code: field === "fee" ? "INVALID_DELIVERY_FEE" : "INVALID_MINIMUM",
      message:
        field === "fee"
          ? `El costo de envío de ${zoneName} no es válido.`
          : `El pedido mínimo de ${zoneName} no es válido.`,
    });
  }
}

export async function saveMerchantDeliverySettings(
  merchantId: string,
  input: SaveMerchantDeliverySettingsInput,
  deps: DeliverySettingsWriteDeps,
): Promise<Result<DeliverySettingsView, DeliverySettingsApplicationError>> {
  await deps.requireDeliveryAccess(merchantId);

  if (!isValidUuid(merchantId)) {
    return err({ code: "INVALID_MERCHANT", message: "Comercio inválido." });
  }

  const merchant = await deps.findMerchant(merchantId);
  if (!merchant) {
    return err({ code: "INVALID_MERCHANT", message: "Comercio inválido." });
  }

  const [cityZones, existingRows] = await Promise.all([
    deps.listZonesForCity(merchant.cityId),
    deps.listDeliveryZones(merchantId),
  ]);

  const allowedZoneIds = new Set(cityZones.map((zone) => zone.id));
  const zoneNameById = new Map(cityZones.map((zone) => [zone.id, zone.name]));
  const configuredIds = new Set(existingRows.map((row) => row.zoneId));
  const seenZoneIds = new Set<string>();
  const zonesToPersist: Array<{
    zoneId: string;
    deliveryFeeCents: number;
    minimumOrderCents: number;
    estimatedMinutes: number;
    active: boolean;
  }> = [];

  for (const zone of input.zones) {
    if (!isValidUuid(zone.zoneId) || !allowedZoneIds.has(zone.zoneId)) {
      return err({
        code: "ZONE_NOT_ALLOWED",
        message: "Esa zona no pertenece al área de este comercio.",
      });
    }
    if (seenZoneIds.has(zone.zoneId)) {
      return err({
        code: "DUPLICATE_ZONE",
        message: "No se puede guardar la misma zona dos veces.",
      });
    }
    seenZoneIds.add(zone.zoneId);

    const zoneName = zoneNameById.get(zone.zoneId) ?? "esta zona";
    const configured = configuredIds.has(zone.zoneId);
    if (shouldSkipUnconfiguredZone(zone, configured)) {
      continue;
    }

    const fee = parseMoneyField(zone.feeInput, "fee", zoneName);
    if (!fee.ok) {
      return fee;
    }
    const minimum = parseMoneyField(zone.minimumInput, "minimum", zoneName);
    if (!minimum.ok) {
      return minimum;
    }
    const minutes = parseEstimatedMinutes(zone.estimatedMinutesInput, zoneName);
    if (!minutes.ok) {
      return minutes;
    }

    zonesToPersist.push({
      zoneId: zone.zoneId,
      deliveryFeeCents: fee.value,
      minimumOrderCents: minimum.value,
      estimatedMinutes: minutes.value,
      active: Boolean(zone.active),
    });
  }

  try {
    const savedRows = await deps.saveDeliverySettings(merchantId, {
      merchantDeliveryEnabled: Boolean(input.merchantDeliveryEnabled),
      zones: zonesToPersist,
    });
    return ok(
      presentDeliverySettings({
        merchant: {
          ...merchant,
          merchantDeliveryEnabled: Boolean(input.merchantDeliveryEnabled),
        },
        cityZones,
        rows: savedRows,
      }),
    );
  } catch {
    return err({
      code: "WRITE_FAILED",
      message: "No pudimos guardar los cambios.",
    });
  }
}
