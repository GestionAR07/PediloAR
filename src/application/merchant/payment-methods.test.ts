import { describe, expect, it, vi } from "vitest";
import { AuthzError } from "@/server/auth/errors";
import {
  listMerchantPaymentMethodSettings,
  presentPaymentMethodSettings,
  saveMerchantPaymentMethods,
  type MerchantPaymentMethodRow,
  type PaymentMethodWriteDeps,
  type SaveMerchantPaymentMethodsInput,
} from "./payment-methods";

const MERCHANT_A = "11111111-1111-4111-8111-111111111111";
const MERCHANT_B = "22222222-2222-4222-8222-222222222222";

function emptyInput(): SaveMerchantPaymentMethodsInput {
  return {
    CASH: { active: false, instructions: "" },
    TRANSFER: { active: false, instructions: "" },
    MERCADO_PAGO: { active: false, instructions: "" },
  };
}

function memoryStore(initial: MerchantPaymentMethodRow[] = []): {
  rows: MerchantPaymentMethodRow[];
  deps: PaymentMethodWriteDeps;
} {
  const rows = [...initial];
  const deps: PaymentMethodWriteDeps = {
    requirePaymentMethodAccess: vi.fn(async () => undefined),
    listPaymentMethods: vi.fn(async () => [...rows]),
    upsertPaymentMethods: vi.fn(async (_merchantId, methods) => {
      const next = [...methods];
      rows.splice(0, rows.length, ...next);
      return next;
    }),
  };
  return { rows, deps };
}

describe("presentPaymentMethodSettings", () => {
  it("shows three inactive methods when the merchant has no rows", () => {
    const views = presentPaymentMethodSettings([]);
    expect(views.map((row) => row.code)).toEqual([
      "CASH",
      "TRANSFER",
      "MERCADO_PAGO",
    ]);
    expect(views.every((row) => row.active === false)).toBe(true);
    expect(views.every((row) => row.instructions === "")).toBe(true);
    expect(views.map((row) => row.label)).toEqual([
      "Efectivo",
      "Transferencia",
      "Mercado Pago",
    ]);
  });
});

describe("saveMerchantPaymentMethods", () => {
  it("requires membership before writing", async () => {
    const { deps } = memoryStore();
    deps.requirePaymentMethodAccess = vi.fn(async () => {
      throw new AuthzError("NOT_MERCHANT_MEMBER", "no");
    });
    await expect(
      saveMerchantPaymentMethods(MERCHANT_A, emptyInput(), deps),
    ).rejects.toMatchObject({ code: "NOT_MERCHANT_MEMBER" });
    expect(deps.upsertPaymentMethods).not.toHaveBeenCalled();
  });

  it("denies a user without membership", async () => {
    const { deps } = memoryStore();
    deps.requirePaymentMethodAccess = vi.fn(async () => {
      throw new AuthzError("UNAUTHENTICATED", "no");
    });
    await expect(
      saveMerchantPaymentMethods(MERCHANT_A, emptyInput(), deps),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("allows OWNER and STAFF through the access gate", async () => {
    const { deps } = memoryStore();
    const result = await saveMerchantPaymentMethods(
      MERCHANT_A,
      { ...emptyInput(), CASH: { active: true, instructions: "" } },
      deps,
    );
    expect(result.ok).toBe(true);
    expect(deps.requirePaymentMethodAccess).toHaveBeenCalledWith(MERCHANT_A);
  });

  it("creates CASH active=true on first save", async () => {
    const { deps, rows } = memoryStore();
    const result = await saveMerchantPaymentMethods(
      MERCHANT_A,
      { ...emptyInput(), CASH: { active: true, instructions: "" } },
      deps,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.find((row) => row.code === "CASH")?.active).toBe(
        true,
      );
    }
    expect(rows.filter((row) => row.code === "CASH")).toHaveLength(1);
    expect(rows.find((row) => row.code === "CASH")).toMatchObject({
      active: true,
      label: "Efectivo",
    });
  });

  it("keeps CASH active after a subsequent list (refresh)", async () => {
    const { deps } = memoryStore();
    await saveMerchantPaymentMethods(
      MERCHANT_A,
      { ...emptyInput(), CASH: { active: true, instructions: "" } },
      deps,
    );
    const listed = await listMerchantPaymentMethodSettings(MERCHANT_A, deps);
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.value.find((row) => row.code === "CASH")?.active).toBe(
        true,
      );
    }
  });

  it("deactivates CASH without deleting the row", async () => {
    const { deps, rows } = memoryStore();
    await saveMerchantPaymentMethods(
      MERCHANT_A,
      { ...emptyInput(), CASH: { active: true, instructions: "" } },
      deps,
    );
    const result = await saveMerchantPaymentMethods(
      MERCHANT_A,
      emptyInput(),
      deps,
    );
    expect(result.ok).toBe(true);
    expect(rows.find((row) => row.code === "CASH")?.active).toBe(false);
    expect(rows.filter((row) => row.code === "CASH")).toHaveLength(1);
  });

  it("persists TRANSFER instructions while active", async () => {
    const { deps } = memoryStore();
    const result = await saveMerchantPaymentMethods(
      MERCHANT_A,
      {
        ...emptyInput(),
        TRANSFER: {
          active: true,
          instructions: "  Transferí al alias COMERCIO.MP  ",
        },
      },
      deps,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const transfer = result.value.find((row) => row.code === "TRANSFER");
      expect(transfer?.active).toBe(true);
      expect(transfer?.instructions).toBe("Transferí al alias COMERCIO.MP");
      expect(transfer?.label).toBe("Transferencia");
    }
  });

  it("keeps TRANSFER instructions after deactivating", async () => {
    const { deps } = memoryStore();
    await saveMerchantPaymentMethods(
      MERCHANT_A,
      {
        ...emptyInput(),
        TRANSFER: {
          active: true,
          instructions: "Transferí al alias COMERCIO.MP",
        },
      },
      deps,
    );
    const deactivated = await saveMerchantPaymentMethods(
      MERCHANT_A,
      {
        ...emptyInput(),
        TRANSFER: {
          active: false,
          instructions: "Transferí al alias COMERCIO.MP",
        },
      },
      deps,
    );
    expect(deactivated.ok).toBe(true);
    if (deactivated.ok) {
      const transfer = deactivated.value.find((row) => row.code === "TRANSFER");
      expect(transfer?.active).toBe(false);
      expect(transfer?.instructions).toBe("Transferí al alias COMERCIO.MP");
    }
  });

  it("restores previous TRANSFER instructions on reactivate", async () => {
    const { deps } = memoryStore();
    const saved = {
      ...emptyInput(),
      TRANSFER: {
        active: false,
        instructions: "Transferí al alias COMERCIO.MP",
      },
    };
    await saveMerchantPaymentMethods(MERCHANT_A, saved, deps);
    const reactivated = await saveMerchantPaymentMethods(
      MERCHANT_A,
      {
        ...saved,
        TRANSFER: { ...saved.TRANSFER, active: true },
      },
      deps,
    );
    expect(reactivated.ok).toBe(true);
    if (reactivated.ok) {
      const transfer = reactivated.value.find((row) => row.code === "TRANSFER");
      expect(transfer?.active).toBe(true);
      expect(transfer?.instructions).toBe("Transferí al alias COMERCIO.MP");
    }
  });

  it("persists MERCADO_PAGO the same way", async () => {
    const { deps } = memoryStore();
    await saveMerchantPaymentMethods(
      MERCHANT_A,
      {
        ...emptyInput(),
        MERCADO_PAGO: {
          active: true,
          instructions: "Pagá al alias/QR del comercio.",
        },
      },
      deps,
    );
    const listed = await listMerchantPaymentMethodSettings(MERCHANT_A, deps);
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      const mp = listed.value.find((row) => row.code === "MERCADO_PAGO");
      expect(mp?.active).toBe(true);
      expect(mp?.instructions).toBe("Pagá al alias/QR del comercio.");
      expect(mp?.label).toBe("Mercado Pago");
    }
  });

  it("saves several methods in one upsert call", async () => {
    const { deps } = memoryStore();
    const result = await saveMerchantPaymentMethods(
      MERCHANT_A,
      {
        CASH: { active: true, instructions: "" },
        TRANSFER: { active: true, instructions: "Alias X" },
        MERCADO_PAGO: { active: false, instructions: "QR" },
      },
      deps,
    );
    expect(result.ok).toBe(true);
    expect(deps.upsertPaymentMethods).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(deps.upsertPaymentMethods).mock.calls[0]![1];
    expect(payload).toHaveLength(3);
    expect(payload.map((row) => row.code)).toEqual([
      "CASH",
      "TRANSFER",
      "MERCADO_PAGO",
    ]);
  });

  it("does not duplicate a code on repeated save", async () => {
    const { deps, rows } = memoryStore();
    const cashOn = {
      ...emptyInput(),
      CASH: { active: true, instructions: "" },
    };
    await saveMerchantPaymentMethods(MERCHANT_A, cashOn, deps);
    await saveMerchantPaymentMethods(MERCHANT_A, cashOn, deps);
    expect(rows.filter((row) => row.code === "CASH")).toHaveLength(1);
    expect(rows).toHaveLength(3);
  });

  it("does not write merchant B when authorized for A", async () => {
    const { deps } = memoryStore();
    await saveMerchantPaymentMethods(
      MERCHANT_A,
      { ...emptyInput(), CASH: { active: true, instructions: "" } },
      deps,
    );
    expect(deps.requirePaymentMethodAccess).toHaveBeenCalledWith(MERCHANT_A);
    expect(deps.upsertPaymentMethods).toHaveBeenCalledWith(
      MERCHANT_A,
      expect.any(Array),
    );
    expect(deps.upsertPaymentMethods).not.toHaveBeenCalledWith(
      MERCHANT_B,
      expect.anything(),
    );
  });

  it("rejects cross-merchant writes at the access gate", async () => {
    const { deps } = memoryStore();
    deps.requirePaymentMethodAccess = vi.fn(async (merchantId) => {
      if (merchantId !== MERCHANT_A) {
        throw new AuthzError("NOT_MERCHANT_MEMBER", "no");
      }
    });
    await expect(
      saveMerchantPaymentMethods(MERCHANT_B, emptyInput(), deps),
    ).rejects.toMatchObject({ code: "NOT_MERCHANT_MEMBER" });
    expect(deps.upsertPaymentMethods).not.toHaveBeenCalled();
  });

  it("forces canonical labels and ignores extra browser fields", async () => {
    const { deps } = memoryStore();
    const sneaky = {
      ...emptyInput(),
      CASH: { active: true, instructions: "" },
    } as SaveMerchantPaymentMethodsInput & {
      CASH: SaveMerchantPaymentMethodsInput["CASH"] & { label?: string };
    };
    sneaky.CASH.label = "Bitcoin";
    const result = await saveMerchantPaymentMethods(MERCHANT_A, sneaky, deps);
    expect(result.ok).toBe(true);
    const payload = vi.mocked(deps.upsertPaymentMethods).mock.calls[0]![1];
    expect(payload.find((row) => row.code === "CASH")?.label).toBe("Efectivo");
    expect(payload.every((row) => row.label !== "Bitcoin")).toBe(true);
  });

  it("rejects overly long instructions", async () => {
    const { deps } = memoryStore();
    const result = await saveMerchantPaymentMethods(
      MERCHANT_A,
      {
        ...emptyInput(),
        TRANSFER: { active: true, instructions: "x".repeat(2001) },
      },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_INSTRUCTIONS");
    }
    expect(deps.upsertPaymentMethods).not.toHaveBeenCalled();
  });
});
