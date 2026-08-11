import { describe, expect, it } from "vitest";
import {
  createCity,
  createProvince,
  createZone,
  type GeographyWriteDeps,
} from "./write-geography";

function deps(overrides: Partial<GeographyWriteDeps> = {}): GeographyWriteDeps {
  return {
    requirePlatformAdmin: async () => undefined,
    findProvinceById: async () => ({ id: "p1" }),
    findCityById: async () => ({ id: "c1", provinceId: "p1" }),
    insertProvince: async (input) => ({
      id: "p1",
      name: input.name,
      code: input.code,
    }),
    insertCity: async () => ({ id: "c1" }),
    insertZone: async () => ({ id: "z1" }),
    isUniqueViolation: () => false,
    ...overrides,
  };
}

describe("geography writes", () => {
  it("creates province with name + code", async () => {
    const result = await createProvince(
      { name: "Chubut", code: "ar-u" },
      deps(),
    );
    expect(result.ok).toBe(true);
  });

  it("rejects invalid city timezone", async () => {
    const result = await createCity(
      {
        provinceId: "p1",
        name: "Rawson",
        slug: "rawson",
        timezone: "Not/AZone",
      },
      deps(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_TIMEZONE");
    }
  });

  it("creates zone under existing city", async () => {
    const result = await createZone(
      { cityId: "c1", name: "Centro", slug: "centro" },
      deps(),
    );
    expect(result.ok).toBe(true);
  });

  it("rejects zone for missing city", async () => {
    const result = await createZone(
      { cityId: "missing", name: "X", slug: "x" },
      deps({ findCityById: async () => null }),
    );
    expect(result.ok).toBe(false);
  });
});
