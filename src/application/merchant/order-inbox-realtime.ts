import { isValidUuid } from "@/lib/uuid";

export const MERCHANT_ORDER_BROADCAST_TOPIC_PREFIX = "merchant-orders";
export const MERCHANT_ORDER_INSERTED_EVENT = "order_inserted";

export type MerchantOrderBroadcastBinding = {
  type: "broadcast";
  filter: { event: typeof MERCHANT_ORDER_INSERTED_EVENT };
  callback: (message?: unknown) => void;
};

export type MerchantOrderRealtimeChannel = {
  on: (
    type: "broadcast",
    filter: { event: typeof MERCHANT_ORDER_INSERTED_EVENT },
    callback: (message?: unknown) => void,
  ) => {
    subscribe: (onStatus?: (status: string, err?: unknown) => void) => unknown;
  };
};

export type MerchantOrderRealtimeClient = {
  channel: (
    name: string,
    options?: { config?: { private?: boolean } },
  ) => MerchantOrderRealtimeChannel;
  removeChannel: (channel: unknown) => unknown;
  realtime?: {
    setAuth: (token?: string | null) => Promise<void>;
  };
};

type ActiveMerchantOrderInsertSubscription = {
  merchantId: string;
  channelName: string;
  unsubscribe: () => void;
};

let activeSubscription: ActiveMerchantOrderInsertSubscription | null = null;

export function merchantOrderBroadcastTopic(merchantId: string): string {
  return `${MERCHANT_ORDER_BROADCAST_TOPIC_PREFIX}:${merchantId}`;
}

/** Consumer-facing payload: orderId only. Never forwards other Broadcast fields. */
export function readMerchantOrderInsertedOrderId(
  message: unknown,
): string | null {
  if (message === null || typeof message !== "object") {
    return null;
  }
  const record = message as { payload?: unknown; orderId?: unknown };
  const nested =
    record.payload !== null && typeof record.payload === "object"
      ? (record.payload as { orderId?: unknown }).orderId
      : undefined;
  const candidate = typeof nested === "string" ? nested : record.orderId;
  if (typeof candidate !== "string" || !isValidUuid(candidate)) {
    return null;
  }
  return candidate;
}

export type MerchantOrderInsertedEvent = {
  orderId: string | null;
};

export function getActiveMerchantOrderInsertSubscription(): {
  merchantId: string;
  channelName: string;
} | null {
  if (!activeSubscription) {
    return null;
  }
  return {
    merchantId: activeSubscription.merchantId,
    channelName: activeSubscription.channelName,
  };
}

/**
 * At most one private Broadcast subscription at a time.
 * Authorization is RLS on realtime.messages (member of that merchant).
 * Phase A: INSERT ping only — do not merge payload into local Order state.
 *
 * Returns cleanup synchronously. Async setAuth must not create or subscribe
 * a channel after that cleanup has run.
 */
export function subscribeMerchantOrderInserts(input: {
  client: MerchantOrderRealtimeClient;
  merchantId: string;
  onInsert: (event: MerchantOrderInsertedEvent) => void;
}): { unsubscribe: () => void; ready: Promise<void> } {
  const previous = activeSubscription;
  activeSubscription = null;
  previous?.unsubscribe();

  if (!isValidUuid(input.merchantId)) {
    return { unsubscribe() {}, ready: Promise.resolve() };
  }

  let cancelled = false;
  let channel: MerchantOrderRealtimeChannel | null = null;
  const channelName = merchantOrderBroadcastTopic(input.merchantId);

  const unsubscribe = () => {
    cancelled = true;
    if (channel) {
      void input.client.removeChannel(channel);
      channel = null;
    }
    if (activeSubscription?.unsubscribe === unsubscribe) {
      activeSubscription = null;
    }
  };

  activeSubscription = {
    merchantId: input.merchantId,
    channelName,
    unsubscribe,
  };

  const ready = (async () => {
    if (input.client.realtime?.setAuth) {
      try {
        await input.client.realtime.setAuth();
      } catch {
        /* setAuth failure must not throw out of subscribe */
      }
    }

    if (cancelled) {
      return;
    }

    channel = input.client.channel(channelName, {
      config: { private: true },
    });

    if (cancelled) {
      void input.client.removeChannel(channel);
      channel = null;
      return;
    }

    channel
      .on("broadcast", { event: MERCHANT_ORDER_INSERTED_EVENT }, (message) => {
        input.onInsert({
          orderId: readMerchantOrderInsertedOrderId(message),
        });
      })
      .subscribe();
  })();

  return { unsubscribe, ready };
}

/** Test helper: drop the module-level subscription guard. */
export function resetMerchantOrderInsertSubscriptionForTests(): void {
  const current = activeSubscription;
  activeSubscription = null;
  current?.unsubscribe();
}
