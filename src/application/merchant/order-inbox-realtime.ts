import { isValidUuid } from "@/lib/uuid";

export const MERCHANT_ORDER_BROADCAST_TOPIC_PREFIX = "merchant-orders";
export const MERCHANT_ORDER_INSERTED_EVENT = "order_inserted";

export type MerchantOrderBroadcastBinding = {
  type: "broadcast";
  filter: { event: typeof MERCHANT_ORDER_INSERTED_EVENT };
  callback: () => void;
};

export type MerchantOrderRealtimeChannel = {
  on: (
    type: "broadcast",
    filter: { event: typeof MERCHANT_ORDER_INSERTED_EVENT },
    callback: () => void,
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

function isDevRuntime(): boolean {
  return process.env.NODE_ENV === "development";
}

export function merchantRealtimeDevLog(
  message: string,
  detail?: Record<string, unknown>,
): void {
  if (!isDevRuntime()) {
    return;
  }
  if (detail) {
    console.info(message, detail);
    return;
  }
  console.info(message);
}

function sanitizeSubscribeError(err: unknown): Record<string, unknown> | null {
  if (err === null || err === undefined) {
    return null;
  }
  if (typeof err !== "object") {
    return { message: String(err) };
  }
  const record = err as {
    name?: unknown;
    message?: unknown;
    code?: unknown;
    cause?: unknown;
  };
  return {
    name: typeof record.name === "string" ? record.name : undefined,
    message: typeof record.message === "string" ? record.message : undefined,
    code:
      typeof record.code === "string" || typeof record.code === "number"
        ? record.code
        : undefined,
    cause: sanitizeCause(record.cause),
  };
}

function sanitizeCause(cause: unknown): unknown {
  if (cause === null || cause === undefined) {
    return undefined;
  }
  if (typeof cause === "string") {
    return cause.replace(/Bearer\s+\S+/gi, "[redacted]").slice(0, 300);
  }
  if (typeof cause === "object") {
    const record = cause as {
      name?: unknown;
      message?: unknown;
      code?: unknown;
    };
    return {
      name: typeof record.name === "string" ? record.name : undefined,
      message:
        typeof record.message === "string"
          ? record.message.replace(/Bearer\s+\S+/gi, "[redacted]").slice(0, 300)
          : undefined,
      code:
        typeof record.code === "string" || typeof record.code === "number"
          ? record.code
          : undefined,
    };
  }
  return typeof cause;
}

export function merchantOrderBroadcastTopic(merchantId: string): string {
  return `${MERCHANT_ORDER_BROADCAST_TOPIC_PREFIX}:${merchantId}`;
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
 * At most one private Broadcast subscription at a time.
 * Authorization is RLS on realtime.messages (member of that merchant).
 * Phase A: INSERT ping only — do not merge payload into local Order state.
 */
export async function subscribeMerchantOrderInserts(input: {
  client: MerchantOrderRealtimeClient;
  merchantId: string;
  onInsert: () => void;
}): Promise<{ unsubscribe: () => void }> {
  const previous = activeSubscription;
  activeSubscription = null;
  previous?.unsubscribe();

  if (!isValidUuid(input.merchantId)) {
    return { unsubscribe() {} };
  }

  if (input.client.realtime?.setAuth) {
    merchantRealtimeDevLog("[merchant-realtime] setAuth start");
    try {
      await input.client.realtime.setAuth();
    } catch (error) {
      merchantRealtimeDevLog("[merchant-realtime] setAuth error", {
        ...sanitizeSubscribeError(error),
      });
    }
    merchantRealtimeDevLog("[merchant-realtime] setAuth done");
  }

  const channelName = merchantOrderBroadcastTopic(input.merchantId);
  const channel = input.client.channel(channelName, {
    config: { private: true },
  });
  merchantRealtimeDevLog("[merchant-realtime] channel created", {
    channelName,
    private: true,
  });

  merchantRealtimeDevLog("[merchant-realtime] subscribe called");
  channel
    .on("broadcast", { event: MERCHANT_ORDER_INSERTED_EVENT }, () => {
      input.onInsert();
    })
    .subscribe((status, err) => {
      merchantRealtimeDevLog("[merchant-realtime] status", { status });
      const sanitized = sanitizeSubscribeError(err);
      if (sanitized) {
        console.error("[merchant-realtime] subscribe error", sanitized);
      }
    });

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
