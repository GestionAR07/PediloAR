import { describe, expect, it } from "vitest";
import {
  isPubliclyListableMerchantStatus,
  merchantServesCustomerZone,
} from "./public-zone-eligibility";

const MERCHANT_A = "11111111-1111-4111-8111-111111111111";
const ZONE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ZONE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("public zone eligibility", () => {
  it("lists only ACTIVE merchants publicly", () => {
    expect(isPubliclyListableMerchantStatus("ACTIVE")).toBe(true);
    expect(isPubliclyListableMerchantStatus("DRAFT")).toBe(false);
    expect(isPubliclyListableMerchantStatus("SUSPENDED")).toBe(false);
  });

  it("includes pickup merchants in their home zone", () => {
    expect(
      merchantServesCustomerZone(
        {
          id: MERCHANT_A,
          status: "ACTIVE",
          zoneId: ZONE_A,
          pickupEnabled: true,
          merchantDeliveryEnabled: false,
        },
        ZONE_A,
        [],
      ),
    ).toBe(true);
  });

  it("excludes pickup merchants from other zones without delivery", () => {
    expect(
      merchantServesCustomerZone(
        {
          id: MERCHANT_A,
          status: "ACTIVE",
          zoneId: ZONE_A,
          pickupEnabled: true,
          merchantDeliveryEnabled: false,
        },
        ZONE_B,
        [],
      ),
    ).toBe(false);
  });

  it("includes merchants with active delivery to the customer zone", () => {
    expect(
      merchantServesCustomerZone(
        {
          id: MERCHANT_A,
          status: "ACTIVE",
          zoneId: ZONE_A,
          pickupEnabled: false,
          merchantDeliveryEnabled: true,
        },
        ZONE_B,
        [
          {
            merchantId: MERCHANT_A,
            zoneId: ZONE_B,
            active: true,
          },
        ],
      ),
    ).toBe(true);
  });

  it("excludes DRAFT / SUSPENDED even with delivery links", () => {
    expect(
      merchantServesCustomerZone(
        {
          id: MERCHANT_A,
          status: "DRAFT",
          zoneId: ZONE_A,
          pickupEnabled: true,
          merchantDeliveryEnabled: true,
        },
        ZONE_A,
        [{ merchantId: MERCHANT_A, zoneId: ZONE_A, active: true }],
      ),
    ).toBe(false);
  });
});
