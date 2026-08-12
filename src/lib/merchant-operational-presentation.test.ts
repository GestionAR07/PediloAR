import { describe, expect, it } from "vitest";
import { getMerchantOperationalPresentation } from "./merchant-operational-presentation";

describe("getMerchantOperationalPresentation", () => {
  it("describes accepting state", () => {
    const presentation = getMerchantOperationalPresentation({
      operationalStatus: "ACCEPTING",
      merchantStatus: "ACTIVE",
      resumesAtLabel: null,
    });
    expect(presentation.headline).toBe("Tomando pedidos");
    expect(presentation.canManagePause).toBe(true);
  });

  it("describes temporary pause with resume time", () => {
    const presentation = getMerchantOperationalPresentation({
      operationalStatus: "TEMPORARILY_PAUSED",
      merchantStatus: "ACTIVE",
      resumesAtLabel: "14:45",
    });
    expect(presentation.description).toContain("14:45");
  });

  it("disables controls for DRAFT merchants", () => {
    const presentation = getMerchantOperationalPresentation({
      operationalStatus: "NOT_ACTIVE",
      merchantStatus: "DRAFT",
      resumesAtLabel: null,
    });
    expect(presentation.canManagePause).toBe(false);
    expect(presentation.description).toContain("todavía no está activo");
  });

  it("disables controls for SUSPENDED merchants", () => {
    const presentation = getMerchantOperationalPresentation({
      operationalStatus: "NOT_ACTIVE",
      merchantStatus: "SUSPENDED",
      resumesAtLabel: null,
    });
    expect(presentation.canManagePause).toBe(false);
    expect(presentation.description).toContain("suspendido");
  });
});
