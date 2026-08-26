import { describe, expect, it } from "vitest";
import {
  CHECKOUT_FORM_DRAFT_STORAGE_KEY,
  clearCheckoutFormSessionDraft,
  createIdempotencyKey,
  markAttemptReviewed,
  markAttemptUnknown,
  parseCheckoutAttempt,
  parseCheckoutFormSessionDraft,
  readCheckoutFormSessionDraft,
  resolveAttemptForSignature,
  clearAttemptQuote,
  writeCheckoutFormSessionDraft,
  type CheckoutFormSessionDraft,
} from "./session";

describe("checkout attempt lifecycle", () => {
  it("creates a new key when the request signature changes before an Order", () => {
    const current = resolveAttemptForSignature(null, "sig-a", () => "key-1");
    expect(current.idempotencyKey).toBe("key-1");
    const edited = resolveAttemptForSignature(current, "sig-b", () => "key-2");
    expect(edited.idempotencyKey).toBe("key-2");
    expect(edited.quoteFingerprint).toBeNull();
    expect(edited.phase).toBe("form");
  });

  it("keeps the same key on an unknown network outcome even if the form later differs", () => {
    const reviewed = markAttemptReviewed(
      resolveAttemptForSignature(null, "sig-a", () => "key-1"),
      "fp-1",
    );
    const unknown = markAttemptUnknown(reviewed);
    const afterEdit = resolveAttemptForSignature(
      unknown,
      "sig-b",
      () => "key-2",
    );
    expect(afterEdit.idempotencyKey).toBe("key-1");
    expect(afterEdit.phase).toBe("unknown");
  });

  it("keeps the same key while the signature is unchanged", () => {
    const current = markAttemptReviewed(
      resolveAttemptForSignature(null, "sig-a", () => "key-1"),
      "fp-1",
    );
    const again = resolveAttemptForSignature(current, "sig-a", () => "key-2");
    expect(again.idempotencyKey).toBe("key-1");
    expect(again.quoteFingerprint).toBe("fp-1");
  });

  it("parses a persisted attempt and uses crypto.randomUUID when available", () => {
    const parsed = parseCheckoutAttempt(
      JSON.stringify({
        idempotencyKey: "abc",
        requestSignature: "sig",
        quoteFingerprint: null,
        phase: "form",
      }),
    );
    expect(parsed?.idempotencyKey).toBe("abc");
    expect(createIdempotencyKey(() => "uuid-1")).toBe("uuid-1");
  });

  it("clears a quote fingerprint without dropping an unknown retry", () => {
    const reviewed = markAttemptReviewed(
      resolveAttemptForSignature(null, "sig-a", () => "key-1"),
      "fp-1",
    );
    const cleared = clearAttemptQuote(reviewed);
    expect(cleared.quoteFingerprint).toBeNull();
    expect(cleared.phase).toBe("form");
    expect(cleared.idempotencyKey).toBe("key-1");
    expect(clearAttemptQuote(markAttemptUnknown(reviewed)).phase).toBe(
      "unknown",
    );
  });
});

describe("checkout form session draft", () => {
  it("persists and clears only the temporary form fields", () => {
    const items = new Map<string, string>();
    const storage = {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => items.set(key, value),
      removeItem: (key: string) => items.delete(key),
    };
    const draft = {
      version: 1,
      merchantId: "merchant-1",
      customerName: "Pediloar",
      customerPhone: "2804123456",
      fulfillmentMethod: "MERCHANT_DELIVERY",
      deliveryZoneId: "zone-1",
      street: "123",
      number: "123",
      floorApartment: "Casa de prueba",
      reference: "Portón violeta",
      paymentMethodCode: "CASH",
    } satisfies CheckoutFormSessionDraft;

    writeCheckoutFormSessionDraft(storage, draft);
    expect(items.has(CHECKOUT_FORM_DRAFT_STORAGE_KEY)).toBe(true);
    expect(readCheckoutFormSessionDraft(storage)).toEqual(draft);

    clearCheckoutFormSessionDraft(storage);
    expect(readCheckoutFormSessionDraft(storage)).toBeNull();
  });

  it("rejects malformed or unsupported drafts", () => {
    expect(parseCheckoutFormSessionDraft(null)).toBeNull();
    expect(parseCheckoutFormSessionDraft("not-json")).toBeNull();
    expect(
      parseCheckoutFormSessionDraft(
        JSON.stringify({ version: 2, merchantId: "merchant-1" }),
      ),
    ).toBeNull();
    expect(
      parseCheckoutFormSessionDraft(
        JSON.stringify({ version: 1, merchantId: "merchant-1" }),
      ),
    ).toBeNull();
  });
});
