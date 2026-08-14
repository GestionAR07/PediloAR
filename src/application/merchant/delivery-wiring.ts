import "server-only";

import {
  DELIVERY_SETTINGS_ALLOWED_ROLES,
  listMerchantDeliverySettings as listMerchantDeliverySettingsUseCase,
  saveMerchantDeliverySettings as saveMerchantDeliverySettingsUseCase,
  type SaveMerchantDeliverySettingsInput,
} from "@/application/merchant/delivery-settings";
import { listZonesByCityId } from "@/infrastructure/db/repositories/geography-repository";
import {
  listMerchantDeliveryZones,
  saveMerchantDeliverySettings as persistMerchantDeliverySettings,
} from "@/infrastructure/db/repositories/merchant-delivery-repository";
import { findMerchantDetailById } from "@/infrastructure/db/repositories/merchant-repository";
import { requireMerchantRole } from "@/server/auth/authorization";

async function requireDeliveryAccess(merchantId: string): Promise<void> {
  await requireMerchantRole(merchantId, DELIVERY_SETTINGS_ALLOWED_ROLES);
}

function deliverySettingsDeps() {
  return {
    requireDeliveryAccess,
    findMerchant: async (merchantId: string) => {
      const merchant = await findMerchantDetailById(merchantId);
      if (!merchant) {
        return null;
      }
      return {
        id: merchant.id,
        cityId: merchant.cityId,
        cityName: merchant.cityName,
        pickupEnabled: merchant.pickupEnabled,
        merchantDeliveryEnabled: merchant.merchantDeliveryEnabled,
      };
    },
    listZonesForCity: async (cityId: string) => {
      const zones = await listZonesByCityId(cityId);
      return zones.map((zone) => ({
        id: zone.id,
        name: zone.name,
        cityName: zone.cityName,
      }));
    },
    listDeliveryZones: listMerchantDeliveryZones,
    saveDeliverySettings: persistMerchantDeliverySettings,
  };
}

export async function listMerchantDeliverySettingsApp(merchantId: string) {
  return listMerchantDeliverySettingsUseCase(
    merchantId,
    deliverySettingsDeps(),
  );
}

export async function saveMerchantDeliverySettingsApp(
  merchantId: string,
  input: SaveMerchantDeliverySettingsInput,
) {
  return saveMerchantDeliverySettingsUseCase(
    merchantId,
    input,
    deliverySettingsDeps(),
  );
}
