import { describe, expect, it } from "vitest";
import {
  APP_NAME,
  APP_SERVICE_AREA,
  APP_TAGLINE,
  getFoundationStatusLabel,
} from "./app-info";

describe("app-info", () => {
  it("exposes the product name and public tagline", () => {
    expect(APP_NAME).toBe("Marketplace Rawson");
    expect(APP_TAGLINE).toContain("Rawson");
    expect(APP_SERVICE_AREA).toBe("Rawson · Playa Unión");
  });

  it("builds a status label from name and tagline", () => {
    expect(getFoundationStatusLabel()).toBe(`${APP_NAME} — ${APP_TAGLINE}`);
  });
});
