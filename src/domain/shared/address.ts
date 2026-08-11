import type { CityId, ZoneId } from "./ids";

/** Frozen delivery address captured at order/checkout time. No GPS required. */
export type DeliveryAddressSnapshot = {
  cityId: CityId;
  zoneId: ZoneId;
  street: string;
  number: string;
  floorApartment?: string;
  reference?: string;
};
