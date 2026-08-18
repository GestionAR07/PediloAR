import { isValidUuid } from "@/lib/uuid";

export const MERCHANT_ORDER_INSERT_CHANNEL_PREFIX = "merchant-inbox-orders";

export type MerchantOrderInsertChangeFilter = {
  event: "INSERT";
  schema: "public";
  table: "orders";
  filter: string;
};

export type MerchantOrderRealtimeChannel = {
  on: (
    type: "postgres_changes",
    filter: MerchantOrderInsertChangeFilter,
    callback: () => void,
  ) => { subscribe: () => unknown };
};

export type MerchantOrderRealtimeClient = {
  channel: (name: string) => MerchantOrderRealtimeChannel;
  removeChannel: (channel: unknown) => unknown;
};

type ActiveMerchantOrderInsertSubscription = {
  merchantId: string;
  channelName: string;
  unsubscribe: () => void;
};

let activeSubscription: ActiveMerchantOrderInsertSubscription | null = null;

export function merchantOrderInsertChannelName(merchantId: string): string {
  return `${MERCHANT_ORDER_INSERT_CHANNEL_PREFIX}:${merchantId}`;
}

export function merchantOrderInsertFilter(merchantId: string): string {
  return `merchant_id=eq.${merchantId}`;
}

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
 * At most one INSERT subscription at a time.
 * Filter is client-side scoping only — Realtime still applies Postgres RLS.
 * The listener must not merge payloads into local Order state.
 */
export function subscribeMerchantOrderInserts(input: {
  client: MerchantOrderRealtimeClient;
  merchantId: string;
  onInsert: () => void;
}): { unsubscribe: () => void } {
  const previous = activeSubscription;
  activeSubscription = null;
  previous?.unsubscribe();

  if (!isValidUuid(input.merchantId)) {
    return { unsubscribe() {} };
  }

  const channelName = merchantOrderInsertChannelName(input.merchantId);
  const channel = input.client.channel(channelName);

  channel
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "orders",
        filter: merchantOrderInsertFilter(input.merchantId),
      },
      () => {
        input.onInsert();
      },
    )
    .subscribe();

  let open = true;
  const unsubscribe = () => {
    if (!open) {
      return;
    }
    open = false;
    void input.client.removeChannel(channel);
    if (activeSubscription?.unsubscribe === unsubscribe) {
      activeSubscription = null;
    }
  };

  activeSubscription = {
    merchantId: input.merchantId,
    channelName,
    unsubscribe,
  };

  return { unsubscribe };
}

/** Test helper: drop the module-level subscription guard. */
export function resetMerchantOrderInsertSubscriptionForTests(): void {
  const current = activeSubscription;
  activeSubscription = null;
  current?.unsubscribe();
}
