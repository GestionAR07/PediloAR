import { describe, expect, it, vi } from "vitest";
import { PRODUCT_IMAGE_MAX_BYTES } from "./product-image";
import { gateProductImageBeforeUpload } from "./product-image-client-gate";

describe("gateProductImageBeforeUpload", () => {
  it("allows a 4.9 MB JPEG (does not block)", () => {
    const gate = gateProductImageBeforeUpload({
      type: "image/jpeg",
      size: Math.floor(4.9 * 1024 * 1024),
    });
    expect(gate).toEqual({ proceed: true });
  });

  it("allows exactly 5 MB", () => {
    const gate = gateProductImageBeforeUpload({
      type: "image/jpeg",
      size: PRODUCT_IMAGE_MAX_BYTES,
    });
    expect(gate).toEqual({ proceed: true });
  });

  it("rejects >5 MB without needing a Server Action", () => {
    const upsertAction = vi.fn();
    const gate = gateProductImageBeforeUpload({
      type: "image/jpeg",
      size: PRODUCT_IMAGE_MAX_BYTES + 1,
    });
    expect(gate.proceed).toBe(false);
    if (!gate.proceed) {
      expect(gate.error).toBe("La imagen no puede superar los 5 MB.");
    }
    // Caller must skip the action when proceed is false.
    if (!gate.proceed) {
      // no-op path
    } else {
      upsertAction();
    }
    expect(upsertAction).not.toHaveBeenCalled();
  });

  it("rejects invalid MIME without calling action", () => {
    const upsertAction = vi.fn();
    const gate = gateProductImageBeforeUpload({
      type: "image/svg+xml",
      size: 1024,
    });
    expect(gate.proceed).toBe(false);
    if (!gate.proceed) {
      expect(gate.error).toBe("Solo se permiten imágenes JPG, PNG o WEBP.");
    } else {
      upsertAction();
    }
    expect(upsertAction).not.toHaveBeenCalled();
  });
});
