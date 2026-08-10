import { describe, expect, it } from "vitest";
import {
  APP_NAME,
  APP_SERVICE_AREA,
  APP_TAGLINE,
  getFoundationStatusLabel,
} from "./app-info";

describe("app-info", () => {
  it("exposes the product name and technical status tagline", () => {
    expect(APP_NAME).toBe("Marketplace Rawson");
    expect(APP_TAGLINE).toBe("Base técnica operativa");
    expect(APP_SERVICE_AREA).toBe("Rawson · Playa Unión");
  });

  it("builds the foundation status label used by the home page", () => {
    expect(getFoundationStatusLabel()).toBe(
      "Marketplace Rawson — Base técnica operativa",
    );
  });
});
