import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getActiveMerchantOrderInsertSubscription,
  MERCHANT_ORDER_INSERTED_EVENT,
  merchantOrderBroadcastTopic,
  resetMerchantOrderInsertSubscriptionForTests,
  subscribeMerchantOrderInserts,
  type MerchantOrderRealtimeClient,
} from "./order-inbox-realtime";

const MERCHANT_A = "11111111-1111-4111-8111-111111111111";
const MERCHANT_B = "22222222-2222-4222-8222-222222222222";

type Binding = {
  type: string;
  filter: { event: string };
  callback: () => void;
};

class FakeChannel {
  readonly name: string;
  readonly options: { config?: { private?: boolean } } | undefined;
  readonly bindings: Binding[] = [];
  subscribed = false;
  removed = false;

  constructor(name: string, options?: { config?: { private?: boolean } }) {
    this.name = name;
    this.options = options;
  }

  on(type: "broadcast", filter: { event: string }, callback: () => void) {
    this.bindings.push({ type, filter, callback });
    return this;
  }

  subscribe() {
    this.subscribed = true;
    return this;
  }

  emit(type: string, event: string) {
    for (const binding of this.bindings) {
      if (binding.type !== type) continue;
      if (binding.filter.event !== event) continue;
      binding.callback();
    }
  }
}

function createFakeClient() {
  const channels: FakeChannel[] = [];
  const removed: FakeChannel[] = [];
  const setAuth = vi.fn(async () => {});
  const client: MerchantOrderRealtimeClient = {
    channel(name: string, options?: { config?: { private?: boolean } }) {
      const channel = new FakeChannel(name, options);
      channels.push(channel);
      return channel;
    },
    removeChannel(channel: unknown) {
      const fake = channel as FakeChannel;
      fake.removed = true;
      removed.push(fake);
    },
    realtime: { setAuth },
  };
  return { client, channels, removed, setAuth };
}

afterEach(() => {
  resetMerchantOrderInsertSubscriptionForTests();
});

describe("subscribeMerchantOrderInserts", () => {
  it("opens one private broadcast channel scoped to the merchant", async () => {
    const { client, channels, setAuth } = createFakeClient();
    await subscribeMerchantOrderInserts({
      client,
      merchantId: MERCHANT_A,
      onInsert: () => {},
    });

    expect(setAuth).toHaveBeenCalledTimes(1);
    expect(channels).toHaveLength(1);
    expect(channels[0]?.name).toBe(merchantOrderBroadcastTopic(MERCHANT_A));
    expect(channels[0]?.options).toEqual({ config: { private: true } });
    expect(channels[0]?.subscribed).toBe(true);
    expect(channels[0]?.bindings).toHaveLength(1);
    expect(channels[0]?.bindings[0]).toMatchObject({
      type: "broadcast",
      filter: { event: MERCHANT_ORDER_INSERTED_EVENT },
    });
    expect(getActiveMerchantOrderInsertSubscription()).toEqual({
      merchantId: MERCHANT_A,
      channelName: merchantOrderBroadcastTopic(MERCHANT_A),
    });
  });

  it("calls onInsert on order_inserted and ignores other events", async () => {
    const { client, channels } = createFakeClient();
    const onInsert = vi.fn();
    await subscribeMerchantOrderInserts({
      client,
      merchantId: MERCHANT_A,
      onInsert,
    });

    channels[0]?.emit("broadcast", "order_updated");
    channels[0]?.emit("postgres_changes", "INSERT");
    expect(onInsert).not.toHaveBeenCalled();

    channels[0]?.emit("broadcast", MERCHANT_ORDER_INSERTED_EVENT);
    expect(onInsert).toHaveBeenCalledTimes(1);
    expect(onInsert).toHaveBeenCalledWith();
  });

  it("unsubscribes and removes the channel on cleanup", async () => {
    const { client, channels, removed } = createFakeClient();
    const { unsubscribe } = await subscribeMerchantOrderInserts({
      client,
      merchantId: MERCHANT_A,
      onInsert: () => {},
    });

    unsubscribe();

    expect(removed).toEqual([channels[0]]);
    expect(channels[0]?.removed).toBe(true);
    expect(getActiveMerchantOrderInsertSubscription()).toBeNull();
  });

  it("drops the previous merchant subscription when the merchant changes", async () => {
    const { client, channels } = createFakeClient();
    await subscribeMerchantOrderInserts({
      client,
      merchantId: MERCHANT_A,
      onInsert: () => {},
    });
    await subscribeMerchantOrderInserts({
      client,
      merchantId: MERCHANT_B,
      onInsert: () => {},
    });

    expect(channels).toHaveLength(2);
    expect(channels[0]?.name).toBe(merchantOrderBroadcastTopic(MERCHANT_A));
    expect(channels[0]?.removed).toBe(true);
    expect(channels[1]?.name).toBe(merchantOrderBroadcastTopic(MERCHANT_B));
    expect(channels[1]?.removed).toBe(false);
    expect(getActiveMerchantOrderInsertSubscription()).toEqual({
      merchantId: MERCHANT_B,
      channelName: merchantOrderBroadcastTopic(MERCHANT_B),
    });
  });

  it("does not keep a duplicate subscription for the same merchant", async () => {
    const { client, channels } = createFakeClient();
    await subscribeMerchantOrderInserts({
      client,
      merchantId: MERCHANT_A,
      onInsert: () => {},
    });
    await subscribeMerchantOrderInserts({
      client,
      merchantId: MERCHANT_A,
      onInsert: () => {},
    });

    expect(channels).toHaveLength(2);
    expect(channels[0]?.removed).toBe(true);
    expect(channels[1]?.removed).toBe(false);
    expect(getActiveMerchantOrderInsertSubscription()?.channelName).toBe(
      merchantOrderBroadcastTopic(MERCHANT_A),
    );
  });

  it("does not mutate local order state from the listener", async () => {
    const { client, channels } = createFakeClient();
    const localOrders = Object.freeze([{ id: "existing-order" }]);
    const snapshot = [...localOrders];
    const onInsert = vi.fn();

    await subscribeMerchantOrderInserts({
      client,
      merchantId: MERCHANT_A,
      onInsert,
    });
    channels[0]?.emit("broadcast", MERCHANT_ORDER_INSERTED_EVENT);

    expect(onInsert).toHaveBeenCalledTimes(1);
    expect(onInsert.mock.calls[0]).toEqual([]);
    expect(localOrders).toEqual(snapshot);
  });

  it("does not subscribe when merchantId is not a UUID", async () => {
    const { client, channels } = createFakeClient();
    const { unsubscribe } = await subscribeMerchantOrderInserts({
      client,
      merchantId: "not-a-merchant",
      onInsert: () => {},
    });

    unsubscribe();
    expect(channels).toHaveLength(0);
    expect(getActiveMerchantOrderInsertSubscription()).toBeNull();
  });
});
