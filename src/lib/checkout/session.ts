export const CHECKOUT_ATTEMPT_STORAGE_KEY = "mr.checkout.attempt";
export const CHECKOUT_SUCCESS_STORAGE_KEY = "mr.checkout.success";
export const CHECKOUT_FROZEN_STORAGE_KEY = "mr.checkout.frozen";

export type CheckoutAttemptPhase = "form" | "reviewed" | "unknown";

export type CheckoutAttemptState = {
  idempotencyKey: string;
  requestSignature: string;
  quoteFingerprint: string | null;
  phase: CheckoutAttemptPhase;
};

export type CheckoutSuccessState = {
  orderId: string;
  orderRef: string;
  merchantId: string;
  merchantName: string;
  totalCents: number;
  fulfillmentMethod: string;
  status: "PENDING";
  replayed: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createIdempotencyKey(
  randomUuid: () => string = () => crypto.randomUUID(),
): string {
  return randomUuid();
}

export function parseCheckoutAttempt(
  raw: string | null,
): CheckoutAttemptState | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    if (typeof parsed.idempotencyKey !== "string" || !parsed.idempotencyKey) {
      return null;
    }
    if (typeof parsed.requestSignature !== "string") return null;
    if (
      parsed.quoteFingerprint != null &&
      typeof parsed.quoteFingerprint !== "string"
    ) {
      return null;
    }
    if (
      parsed.phase !== "form" &&
      parsed.phase !== "reviewed" &&
      parsed.phase !== "unknown"
    ) {
      return null;
    }
    return {
      idempotencyKey: parsed.idempotencyKey,
      requestSignature: parsed.requestSignature,
      quoteFingerprint:
        typeof parsed.quoteFingerprint === "string"
          ? parsed.quoteFingerprint
          : null,
      phase: parsed.phase,
    };
  } catch {
    return null;
  }
}

export function resolveAttemptForSignature(
  current: CheckoutAttemptState | null,
  signature: string,
  createKey: () => string = createIdempotencyKey,
): CheckoutAttemptState {
  if (!current) {
    return {
      idempotencyKey: createKey(),
      requestSignature: signature,
      quoteFingerprint: null,
      phase: "form",
    };
  }

  if (current.requestSignature === signature) {
    return current;
  }

  if (current.phase === "unknown") {
    return current;
  }

  return {
    idempotencyKey: createKey(),
    requestSignature: signature,
    quoteFingerprint: null,
    phase: "form",
  };
}

export function markAttemptReviewed(
  current: CheckoutAttemptState,
  fingerprint: string,
): CheckoutAttemptState {
  return {
    ...current,
    quoteFingerprint: fingerprint,
    phase: current.phase === "unknown" ? "unknown" : "reviewed",
  };
}

export function markAttemptUnknown(
  current: CheckoutAttemptState,
): CheckoutAttemptState {
  return {
    ...current,
    phase: "unknown",
  };
}

export function clearAttemptQuote(
  current: CheckoutAttemptState,
): CheckoutAttemptState {
  if (current.phase === "unknown") {
    return current;
  }
  return {
    ...current,
    quoteFingerprint: null,
    phase: "form",
  };
}

export function readCheckoutAttempt(
  storage: Pick<Storage, "getItem"> | null | undefined,
): CheckoutAttemptState | null {
  if (!storage) return null;
  try {
    return parseCheckoutAttempt(storage.getItem(CHECKOUT_ATTEMPT_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeCheckoutAttempt(
  storage: Pick<Storage, "setItem"> | null | undefined,
  attempt: CheckoutAttemptState,
): void {
  if (!storage) return;
  try {
    storage.setItem(CHECKOUT_ATTEMPT_STORAGE_KEY, JSON.stringify(attempt));
  } catch {
    // ignore quota / private mode
  }
}

export function clearCheckoutAttempt(
  storage: Pick<Storage, "removeItem"> | null | undefined,
): void {
  if (!storage) return;
  try {
    storage.removeItem(CHECKOUT_ATTEMPT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function parseCheckoutSuccess(
  raw: string | null,
): CheckoutSuccessState | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    if (typeof parsed.orderId !== "string" || !parsed.orderId) return null;
    if (typeof parsed.orderRef !== "string") return null;
    if (typeof parsed.merchantId !== "string") return null;
    if (typeof parsed.merchantName !== "string") return null;
    if (
      typeof parsed.totalCents !== "number" ||
      !Number.isInteger(parsed.totalCents)
    ) {
      return null;
    }
    if (typeof parsed.fulfillmentMethod !== "string") return null;
    if (parsed.status !== "PENDING") return null;
    if (typeof parsed.replayed !== "boolean") return null;
    return {
      orderId: parsed.orderId,
      orderRef: parsed.orderRef,
      merchantId: parsed.merchantId,
      merchantName: parsed.merchantName,
      totalCents: parsed.totalCents,
      fulfillmentMethod: parsed.fulfillmentMethod,
      status: "PENDING",
      replayed: parsed.replayed,
    };
  } catch {
    return null;
  }
}

export function readCheckoutSuccess(
  storage: Pick<Storage, "getItem"> | null | undefined,
): CheckoutSuccessState | null {
  if (!storage) return null;
  try {
    return parseCheckoutSuccess(storage.getItem(CHECKOUT_SUCCESS_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeCheckoutSuccess(
  storage: Pick<Storage, "setItem"> | null | undefined,
  success: CheckoutSuccessState,
): void {
  if (!storage) return;
  try {
    storage.setItem(CHECKOUT_SUCCESS_STORAGE_KEY, JSON.stringify(success));
  } catch {
    // ignore
  }
}

export function clearCheckoutSuccess(
  storage: Pick<Storage, "removeItem"> | null | undefined,
): void {
  if (!storage) return;
  try {
    storage.removeItem(CHECKOUT_SUCCESS_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export type FrozenCheckoutDraft = {
  merchantId: string;
  customerZoneId: string;
  customerName: string;
  customerPhone: string;
  fulfillmentMethod: string;
  deliveryZoneId: string;
  street: string;
  number: string;
  floorApartment: string;
  reference: string;
  paymentMethodCode: string;
  idempotencyKey: string;
  expectedQuoteFingerprint: string;
};

function parseFrozenDraft(raw: string | null): FrozenCheckoutDraft | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    const required: Array<keyof FrozenCheckoutDraft> = [
      "merchantId",
      "customerZoneId",
      "customerName",
      "customerPhone",
      "fulfillmentMethod",
      "deliveryZoneId",
      "street",
      "number",
      "floorApartment",
      "reference",
      "paymentMethodCode",
      "idempotencyKey",
      "expectedQuoteFingerprint",
    ];
    for (const key of required) {
      if (typeof parsed[key] !== "string") return null;
    }
    return parsed as FrozenCheckoutDraft;
  } catch {
    return null;
  }
}

export function readFrozenCheckoutDraft(
  storage: Pick<Storage, "getItem"> | null | undefined,
): FrozenCheckoutDraft | null {
  if (!storage) return null;
  try {
    return parseFrozenDraft(storage.getItem(CHECKOUT_FROZEN_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeFrozenCheckoutDraft(
  storage: Pick<Storage, "setItem"> | null | undefined,
  draft: FrozenCheckoutDraft,
): void {
  if (!storage) return;
  try {
    storage.setItem(CHECKOUT_FROZEN_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // ignore
  }
}

export function clearFrozenCheckoutDraft(
  storage: Pick<Storage, "removeItem"> | null | undefined,
): void {
  if (!storage) return;
  try {
    storage.removeItem(CHECKOUT_FROZEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}
