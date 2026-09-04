import { describe, expect, it, vi } from "vitest";
import {
  customerProfileHref,
  hasCompleteCustomerContact,
  missingCustomerContactFields,
  parseCustomerContactProfile,
  parseMissingCustomerContactFields,
  sanitizeCustomerDestination,
  updateCustomerContact,
} from "./profile";

describe("customer contact profile", () => {
  it("requires a valid name and phone", () => {
    expect(
      hasCompleteCustomerContact({ displayName: "Ana", phone: null }),
    ).toBe(false);
    expect(
      hasCompleteCustomerContact({
        displayName: "Ana López",
        phone: "+54 280 412-3456",
      }),
    ).toBe(true);
    expect(
      parseCustomerContactProfile({ displayName: "", phone: "123" }).ok,
    ).toBe(false);
  });

  it("blocks external destinations and completion loops", () => {
    expect(sanitizeCustomerDestination("https://evil.test")).toBe("/cuenta");
    expect(sanitizeCustomerDestination("/cuenta/perfil?next=/checkout")).toBe(
      "/cuenta",
    );
    expect(sanitizeCustomerDestination("/auth/oauth/continue")).toBe("/cuenta");
    expect(sanitizeCustomerDestination("/checkout")).toBe("/checkout");
    expect(customerProfileHref("/checkout", true)).toBe(
      "/cuenta/perfil?next=%2Fcheckout&required=1",
    );
    expect(
      customerProfileHref("/cuenta", { required: true, missing: ["phone"] }),
    ).toBe("/cuenta/perfil?next=%2Fcuenta&required=1&missing=phone");
    expect(
      missingCustomerContactFields({ displayName: "Ana", phone: null }),
    ).toEqual(["phone"]);
    expect(parseMissingCustomerContactFields("phone,name")).toEqual([
      "phone",
      "name",
    ]);
    expect(parseMissingCustomerContactFields("role")).toBeNull();
  });

  it("persists only validated contact fields for the authenticated user", async () => {
    const updateCustomerContactProfile = vi.fn().mockResolvedValue(undefined);
    const result = await updateCustomerContact(
      "user-1",
      { displayName: "  Ana López ", phone: " 280 412-3456 " },
      { updateCustomerContactProfile },
    );
    expect(result).toEqual({
      ok: true,
      value: { displayName: "Ana López", phone: "280 412-3456" },
    });
    expect(updateCustomerContactProfile).toHaveBeenCalledWith("user-1", {
      displayName: "Ana López",
      phone: "280 412-3456",
    });
  });
});
