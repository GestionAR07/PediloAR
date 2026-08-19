export const MAX_VISIBLE_NEW_ORDER_TOASTS = 3;
export const SEEN_NEW_ORDER_ID_CAP = 50;
export const NEW_ORDER_CHIME_COOLDOWN_MS = 2500;
export const NEW_ORDER_TOAST_VISIBLE_MS = 7500;
export const NEW_ORDER_TOAST_EXIT_MS = 180;

export type NewOrderChimeKind = "full" | "soft" | "none";

export type MerchantNewOrderInsertResult = {
  visibleOrderIds: string[];
  lastFullChimeAtMs: number | null;
  isDuplicate: boolean;
  chime: NewOrderChimeKind;
};

let sessionSeenOrderIds = new Set<string>();
let sessionLastFullChimeAtMs: number | null = null;

export function merchantOrderDetailHref(
  merchantId: string,
  orderId: string,
): string {
  return `/merchant/${merchantId}/orders/${orderId}`;
}

export function dismissMerchantNewOrderToast(
  visibleOrderIds: readonly string[],
  orderId: string,
): string[] {
  return visibleOrderIds.filter((id) => id !== orderId);
}

export function applyMerchantNewOrderInsert(input: {
  seenOrderIds: Set<string>;
  visibleOrderIds: readonly string[];
  lastFullChimeAtMs: number | null;
  soundEnabled: boolean;
  orderId: string;
  nowMs: number;
  maxVisible?: number;
  seenCap?: number;
  chimeCooldownMs?: number;
}): MerchantNewOrderInsertResult {
  const maxVisible = input.maxVisible ?? MAX_VISIBLE_NEW_ORDER_TOASTS;
  const seenCap = input.seenCap ?? SEEN_NEW_ORDER_ID_CAP;
  const chimeCooldownMs = input.chimeCooldownMs ?? NEW_ORDER_CHIME_COOLDOWN_MS;

  if (input.seenOrderIds.has(input.orderId)) {
    return {
      visibleOrderIds: [...input.visibleOrderIds],
      lastFullChimeAtMs: input.lastFullChimeAtMs,
      isDuplicate: true,
      chime: "none",
    };
  }

  input.seenOrderIds.add(input.orderId);
  while (input.seenOrderIds.size > seenCap) {
    const oldest = input.seenOrderIds.values().next().value;
    if (typeof oldest !== "string") {
      break;
    }
    input.seenOrderIds.delete(oldest);
  }

  const appended = [...input.visibleOrderIds, input.orderId];
  const visibleOrderIds =
    appended.length > maxVisible
      ? appended.slice(appended.length - maxVisible)
      : appended;

  if (!input.soundEnabled) {
    return {
      visibleOrderIds,
      lastFullChimeAtMs: input.lastFullChimeAtMs,
      isDuplicate: false,
      chime: "none",
    };
  }

  const playFull =
    input.lastFullChimeAtMs === null ||
    input.nowMs - input.lastFullChimeAtMs >= chimeCooldownMs;

  return {
    visibleOrderIds,
    lastFullChimeAtMs: playFull ? input.nowMs : input.lastFullChimeAtMs,
    isDuplicate: false,
    chime: playFull ? "full" : "soft",
  };
}

export function recordSessionMerchantNewOrderInsert(input: {
  visibleOrderIds: readonly string[];
  soundEnabled: boolean;
  orderId: string;
  nowMs: number;
}): MerchantNewOrderInsertResult {
  const result = applyMerchantNewOrderInsert({
    seenOrderIds: sessionSeenOrderIds,
    lastFullChimeAtMs: sessionLastFullChimeAtMs,
    visibleOrderIds: input.visibleOrderIds,
    soundEnabled: input.soundEnabled,
    orderId: input.orderId,
    nowMs: input.nowMs,
  });
  sessionLastFullChimeAtMs = result.lastFullChimeAtMs;
  return result;
}

/** Test helper: drop session dedupe and chime cooldown. */
export function resetMerchantNewOrderAlertForTests(): void {
  sessionSeenOrderIds = new Set();
  sessionLastFullChimeAtMs = null;
}
