import { describe, expect, it } from "vitest";
import {
  getMerchantProductAvailabilityStatus,
  getProductAvailabilityToggleLabel,
  getProductAvailabilityToggleSuccessMessage,
} from "./product-availability-presentation";

describe("getMerchantProductAvailabilityStatus", () => {
  it("shows Disponible for NOT_TRACKED with available=true", () => {
    const status = getMerchantProductAvailabilityStatus({
      active: true,
      available: true,
      stockMode: "NOT_TRACKED",
      stockQuantity: null,
    });
    expect(status.label).toBe("Disponible");
    expect(status.operationallyAvailable).toBe(true);
  });

  it("shows Sin stock when TRACKED stock=0 even if available=true", () => {
    const status = getMerchantProductAvailabilityStatus({
      active: true,
      available: true,
      stockMode: "TRACKED",
      stockQuantity: 0,
    });
    expect(status.label).toBe("Sin stock");
    expect(status.detail).toBe("Stock: 0");
    expect(status.operationallyAvailable).toBe(false);
  });

  it("shows No disponible when available=false even with stock", () => {
    const status = getMerchantProductAvailabilityStatus({
      active: true,
      available: false,
      stockMode: "TRACKED",
      stockQuantity: 10,
    });
    expect(status.label).toBe("No disponible");
    expect(status.detail).toContain("Stock: 10");
    expect(status.detail).toContain("venta pausada");
    expect(status.operationallyAvailable).toBe(false);
  });

  it("shows Inactivo when active=false", () => {
    const status = getMerchantProductAvailabilityStatus({
      active: false,
      available: true,
      stockMode: "NOT_TRACKED",
      stockQuantity: null,
    });
    expect(status.label).toBe("Inactivo");
    expect(status.operationallyAvailable).toBe(false);
  });
});

describe("availability toggle copy", () => {
  it("uses pause/resume sale language instead of stock", () => {
    expect(getProductAvailabilityToggleLabel(true)).toBe("Pausar venta");
    expect(getProductAvailabilityToggleLabel(false)).toBe("Reanudar venta");
    expect(getProductAvailabilityToggleSuccessMessage(false)).toBe(
      "Venta pausada",
    );
    expect(getProductAvailabilityToggleSuccessMessage(true)).toBe(
      "Venta reanudada",
    );
  });
});
