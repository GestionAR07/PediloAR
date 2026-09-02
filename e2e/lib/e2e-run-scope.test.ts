import { describe, expect, it } from "vitest";
import { E2eCreatedResourceRegistry, e2eRunMarker } from "./e2e-run-scope";

describe("E2eCreatedResourceRegistry", () => {
  it("uses an explicit E2E marker and tracks exact created resource IDs", () => {
    const registry = new E2eCreatedResourceRegistry("run_12345678");
    expect(registry.marker).toBe("[E2E:run_12345678]");

    registry.register({ kind: "order", id: "order-1" });
    registry.register({ kind: "product", id: "product-1" });
    registry.register({ kind: "order", id: "order-1" });

    expect(registry.list()).toEqual([
      { kind: "order", id: "order-1" },
      { kind: "product", id: "product-1" },
    ]);
  });

  it("requires cleanup to clear every exact registered resource", () => {
    const registry = new E2eCreatedResourceRegistry("run_12345678");
    registry.register({ kind: "order", id: "order-1" });

    expect(() => registry.assertCleanupComplete()).toThrow(
      "1 scoped resource(s) remain",
    );

    registry.clearRegistered({ kind: "order", id: "order-1" });
    expect(() => registry.assertCleanupComplete()).not.toThrow();
  });

  it("rejects invalid run IDs and blank resource IDs", () => {
    expect(() => e2eRunMarker("short")).toThrow("invalid run id");

    const registry = new E2eCreatedResourceRegistry("run_12345678");
    expect(() => registry.register({ kind: "other", id: "   " })).toThrow(
      "resource id is required",
    );
  });
});
