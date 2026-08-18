import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getActiveMerchantOrderInsertSubscription,
  merchantOrderInsertChannelName,
  merchantOrderInsertFilter,
  resetMerchantOrderInsertSubscriptionForTests,
  subscribeMerchantOrderInserts,
  type MerchantOrderInsertChangeFilter,
  type MerchantOrderRealtimeClient,
} from "./order-inbox-realtime";

const MERCHANT_A = "11111111-1111-4111-8111-111111111111";
const MERCHANT_B = "22222222-2222-4222-8222-222222222222";

type Binding = {
  type: string;
  filter: MerchantOrderInsertChangeFilter;
  callback: () => void;
};

class FakeChannel {
  readonly name: string;
  readonly bindings: Binding[] = [];
  subscribed = false;
  removed = false;

  constructor(name: string) {
    this.name = name;
  }

  on(
    type: "postgres_changes",
    filter: MerchantOrderInsertChangeFilter,
    callback: () => void,
  ) {
    this.bindings.push({ type, filter, callback });
    return this;
  }

  subscribe() {
    this.subscribed = true;
    return this;
  }

  emit(event: string) {
    for (const binding of this.bindings) {
      if (binding.type !== "postgres_changes") continue;
      if (binding.filter.event !== event) continue;
      binding.callback();
    }
  }
}

function createFakeClient() {
  const channels: FakeChannel[] = [];
  const removed: FakeChannel[] = [];
  const client: MerchantOrderRealtimeClient = {
    channel(name: string) {
      const channel = new FakeChannel(name);
      channels.push(channel);
      return channel;
    },
    removeChannel(channel: unknown) {
      const fake = channel as FakeChannel;
      fake.removed = true;
      removed.push(fake);
    },
  };
  return { client, channels, removed };
}

afterEach(() => {
  resetMerchantOrderInsertSubscriptionForTests();
});

describe("subscribeMerchantOrderInserts", () => {
  it("opens a merchant-scoped INSERT channel", () => {
    const { client, channels } = createFakeClient();
    subscribeMerchantOrderInserts({
      client,
      merchantId: MERCHANT_A,
      onInsert: () => {},
    });

    expect(channels).toHaveLength(1);
    expect(channels[0]?.name).toBe(merchantOrderInsertChannelName(MERCHANT_A));
    expect(channels[0]?.subscribed).toBe(true);
    expect(channels[0]?.bindings).toHaveLength(1);
    expect(channels[0]?.bindings[0]).toMatchObject({
      type: "postgres_changes",
      filter: {
        event: "INSERT",
        schema: "public",
        table: "orders",
        filter: merchantOrderInsertFilter(MERCHANT_A),
      },
    });
    expect(getActiveMerchantOrderInsertSubscription()).toEqual({
      merchantId: MERCHANT_A,
      channelName: merchantOrderInsertChannelName(MERCHANT_A),
    });
  });

  it("subscribes only to INSERT", () => {
    const { client, channels } = createFakeClient();
    subscribeMerchantOrderInserts({
      client,
      merchantId: MERCHANT_A,
      onInsert: () => {},
    });

    const events = channels[0]?.bindings.map((binding) => binding.filter.event);
    expect(events).toEqual(["INSERT"]);
  });

  it("calls onInsert on INSERT and does not call it on UPDATE", () => {
    const { client, channels } = createFakeClient();
    const onInsert = vi.fn();
    subscribeMerchantOrderInserts({
      client,
      merchantId: MERCHANT_A,
      onInsert,
    });

    channels[0]?.emit("UPDATE");
    expect(onInsert).not.toHaveBeenCalled();

    channels[0]?.emit("INSERT");
    expect(onInsert).toHaveBeenCalledTimes(1);
    expect(onInsert).toHaveBeenCalledWith();
  });

  it("unsubscribes and removes the channel on cleanup", () => {
    const { client, channels, removed } = createFakeClient();
    const { unsubscribe } = subscribeMerchantOrderInserts({
      client,
      merchantId: MERCHANT_A,
      onInsert: () => {},
    });

    unsubscribe();

    expect(removed).toEqual([channels[0]]);
    expect(channels[0]?.removed).toBe(true);
    expect(getActiveMerchantOrderInsertSubscription()).toBeNull();
  });

  it("drops the previous merchant subscription when the merchant changes", () => {
    const { client, channels } = createFakeClient();
    subscribeMerchantOrderInserts({
      client,
      merchantId: MERCHANT_A,
      onInsert: () => {},
    });
    subscribeMerchantOrderInserts({
      client,
      merchantId: MERCHANT_B,
      onInsert: () => {},
    });

    expect(channels).toHaveLength(2);
    expect(channels[0]?.name).toBe(merchantOrderInsertChannelName(MERCHANT_A));
    expect(channels[0]?.removed).toBe(true);
    expect(channels[1]?.name).toBe(merchantOrderInsertChannelName(MERCHANT_B));
    expect(channels[1]?.removed).toBe(false);
    expect(getActiveMerchantOrderInsertSubscription()).toEqual({
      merchantId: MERCHANT_B,
      channelName: merchantOrderInsertChannelName(MERCHANT_B),
    });
  });

  it("does not keep a duplicate subscription for the same merchant", () => {
    const { client, channels } = createFakeClient();
    subscribeMerchantOrderInserts({
      client,
      merchantId: MERCHANT_A,
      onInsert: () => {},
    });
    subscribeMerchantOrderInserts({
      client,
      merchantId: MERCHANT_A,
      onInsert: () => {},
    });

    expect(channels).toHaveLength(2);
    expect(channels[0]?.removed).toBe(true);
    expect(channels[1]?.removed).toBe(false);
    expect(getActiveMerchantOrderInsertSubscription()?.channelName).toBe(
      merchantOrderInsertChannelName(MERCHANT_A),
    );
  });

  it("does not mutate local order state from the listener", () => {
    const { client, channels } = createFakeClient();
    const localOrders = Object.freeze([{ id: "existing-order" }]);
    const snapshot = [...localOrders];
    const onInsert = vi.fn();

    subscribeMerchantOrderInserts({
      client,
      merchantId: MERCHANT_A,
      onInsert,
    });
    channels[0]?.emit("INSERT");

    expect(onInsert).toHaveBeenCalledTimes(1);
    expect(onInsert.mock.calls[0]).toEqual([]);
    expect(localOrders).toEqual(snapshot);
  });

  it("does not subscribe when merchantId is not a UUID", () => {
    const { client, channels } = createFakeClient();
    const { unsubscribe } = subscribeMerchantOrderInserts({
      client,
      merchantId: "not-a-merchant",
      onInsert: () => {},
    });

    unsubscribe();
    expect(channels).toHaveLength(0);
    expect(getActiveMerchantOrderInsertSubscription()).toBeNull();
  });
});
