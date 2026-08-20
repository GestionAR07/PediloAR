import { afterEach, describe, expect, it, vi } from "vitest";
import {
  configureOrderNotificationSoundHostForTests,
  getMerchantOrderAudioContextDebug,
} from "./order-notification-sound";
import {
  configureOrderConfirmationSoundHostForTests,
  getOrderConfirmationAudioDebug,
  ORDER_CONFIRMATION_PLAYBACK_GAIN,
  ORDER_CONFIRMATION_SOUND_SRC,
  playOrderConfirmationSound,
  prepareOrderConfirmationSound,
} from "./order-confirmation-sound";

const ORDER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORDER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

type FakeNode = {
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

function createFakeFetch(
  options: {
    ok?: boolean;
    fail?: boolean;
    delay?: Promise<void>;
  } = {},
) {
  return vi.fn(async (input: string) => {
    if (options.delay) {
      await options.delay;
    }
    if (options.fail) {
      throw new Error("network failed");
    }
    expect(input).toBe(ORDER_CONFIRMATION_SOUND_SRC);
    return {
      ok: options.ok ?? true,
      arrayBuffer: async () => new ArrayBuffer(8),
    };
  });
}

function createFakeAudioContext(
  initialState: AudioContextState = "suspended",
  options: { decodeError?: Error; playError?: boolean } = {},
) {
  const bufferSources: Array<{
    buffer: AudioBuffer | null;
    start: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }> = [];
  const playbackGains: Array<{
    setValueAtTime: ReturnType<typeof vi.fn>;
  }> = [];
  const fakeBuffer = {
    duration: 0.8,
    length: 35280,
    numberOfChannels: 1,
    sampleRate: 44100,
  } as AudioBuffer;
  const instances: Array<{
    state: AudioContextState;
    resume: ReturnType<typeof vi.fn>;
    decodeAudioData: ReturnType<typeof vi.fn>;
  }> = [];

  class FakeAudioContext {
    state: AudioContextState = initialState;
    currentTime = 0;
    destination = {};
    resume = vi.fn(async () => {
      this.state = "running";
    });
    decodeAudioData = vi.fn(async () => {
      if (options.decodeError) {
        throw options.decodeError;
      }
      return fakeBuffer;
    });

    constructor() {
      instances.push(this);
    }

    createOscillator() {
      return {
        type: "sine" as OscillatorType,
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null as (() => void) | null,
      };
    }
    createGain() {
      const gain: FakeNode & {
        gain: {
          setValueAtTime: ReturnType<typeof vi.fn>;
        };
      } = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        gain: {
          setValueAtTime: vi.fn((value: number) => {
            if (value > 0) {
              playbackGains.push(gain.gain);
            }
          }),
        },
      };
      return gain;
    }
    createBufferSource() {
      if (options.playError) {
        throw new Error("playback failed");
      }
      const source = {
        buffer: null as AudioBuffer | null,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        onended: null as (() => void) | null,
      };
      bufferSources.push(source);
      return source;
    }
  }

  return {
    FakeAudioContext,
    bufferSources,
    playbackGains,
    fakeBuffer,
    instances,
  };
}

async function runConfirmFlow(
  confirm: () => Promise<{ ok: boolean; orderId?: string }>,
): Promise<void> {
  await prepareOrderConfirmationSound();
  const result = await confirm();
  if (!result.ok || !result.orderId) {
    return;
  }
  await playOrderConfirmationSound(result.orderId);
}

afterEach(() => {
  configureOrderConfirmationSoundHostForTests(null);
  configureOrderNotificationSoundHostForTests(null);
});

describe("customer order confirmation sound", () => {
  it("unlocks the customer AudioContext during prepare without playing", async () => {
    const { FakeAudioContext, bufferSources, instances } =
      createFakeAudioContext("suspended");
    const fetch = createFakeFetch();
    configureOrderConfirmationSoundHostForTests({
      fetch,
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    await prepareOrderConfirmationSound();

    expect(instances).toHaveLength(1);
    expect(instances[0]?.resume).toHaveBeenCalled();
    expect(getOrderConfirmationAudioDebug().createdCount).toBe(1);
    expect(getOrderConfirmationAudioDebug().state).toBe("running");
    expect(bufferSources).toHaveLength(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(ORDER_CONFIRMATION_SOUND_SRC);
  });

  it("creates and unlocks the context before awaiting confirmation", async () => {
    const { FakeAudioContext } = createFakeAudioContext("suspended");
    configureOrderConfirmationSoundHostForTests({
      fetch: createFakeFetch(),
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    const confirm = vi.fn(async () => {
      expect(getOrderConfirmationAudioDebug().createdCount).toBe(1);
      expect(getOrderConfirmationAudioDebug().state).toBe("running");
      return { ok: true as const, orderId: ORDER_A };
    });

    await runConfirmFlow(confirm);
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it("does not create an AudioContext from play alone", async () => {
    const { FakeAudioContext, instances, bufferSources } =
      createFakeAudioContext("running");
    const fetch = createFakeFetch();
    configureOrderConfirmationSoundHostForTests({
      fetch,
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    await expect(playOrderConfirmationSound(ORDER_A)).resolves.toBe("blocked");
    expect(instances).toHaveLength(0);
    expect(getOrderConfirmationAudioDebug().createdCount).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
    expect(bufferSources).toHaveLength(0);
  });

  it("loads and decodes the asset once, then reuses the buffer", async () => {
    const { FakeAudioContext, instances, bufferSources, fakeBuffer } =
      createFakeAudioContext("running");
    const fetch = createFakeFetch();
    configureOrderConfirmationSoundHostForTests({
      fetch,
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    await prepareOrderConfirmationSound();
    await expect(playOrderConfirmationSound(ORDER_A)).resolves.toBe("played");
    await expect(playOrderConfirmationSound(ORDER_B)).resolves.toBe("played");

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(instances[0]?.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(instances).toHaveLength(1);
    expect(getOrderConfirmationAudioDebug().createdCount).toBe(1);
    expect(bufferSources).toHaveLength(2);
    expect(bufferSources[0]?.buffer).toBe(fakeBuffer);
    expect(bufferSources[1]?.buffer).toBe(fakeBuffer);
  });

  it("plays the confirmation asset once on success", async () => {
    const { FakeAudioContext, bufferSources, playbackGains } =
      createFakeAudioContext("running");
    configureOrderConfirmationSoundHostForTests({
      fetch: createFakeFetch(),
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    await runConfirmFlow(async () => ({ ok: true, orderId: ORDER_A }));

    expect(bufferSources).toHaveLength(1);
    expect(bufferSources[0]?.start).toHaveBeenCalledWith(0);
    expect(playbackGains[0]?.setValueAtTime).toHaveBeenCalledWith(
      ORDER_CONFIRMATION_PLAYBACK_GAIN,
      0,
    );
    expect(getOrderConfirmationAudioDebug().playedCount).toBe(1);
  });

  it("does not play again on a success rerender of the same orderId", async () => {
    const { FakeAudioContext, bufferSources } =
      createFakeAudioContext("running");
    configureOrderConfirmationSoundHostForTests({
      fetch: createFakeFetch(),
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    await prepareOrderConfirmationSound();
    await playOrderConfirmationSound(ORDER_A);
    await playOrderConfirmationSound(ORDER_A);
    await playOrderConfirmationSound(ORDER_A);

    expect(bufferSources).toHaveLength(1);
    expect(getOrderConfirmationAudioDebug().playedCount).toBe(1);
  });

  it("does not play when checkout fails", async () => {
    const { FakeAudioContext, bufferSources } =
      createFakeAudioContext("running");
    const fetch = createFakeFetch();
    configureOrderConfirmationSoundHostForTests({
      fetch,
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    await runConfirmFlow(async () => ({ ok: false }));

    expect(bufferSources).toHaveLength(0);
    expect(getOrderConfirmationAudioDebug().playedCount).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("plays once when an idempotent retry finally returns success", async () => {
    const { FakeAudioContext, bufferSources } =
      createFakeAudioContext("running");
    configureOrderConfirmationSoundHostForTests({
      fetch: createFakeFetch(),
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    await runConfirmFlow(async () => ({ ok: false }));
    await runConfirmFlow(async () => ({ ok: true, orderId: ORDER_A }));
    await runConfirmFlow(async () => ({ ok: true, orderId: ORDER_A }));

    expect(bufferSources).toHaveLength(1);
    expect(getOrderConfirmationAudioDebug().playedCount).toBe(1);
    expect(getOrderConfirmationAudioDebug().createdCount).toBe(1);
  });

  it("returns from prepare without waiting for fetch or decode", async () => {
    const { FakeAudioContext, instances } = createFakeAudioContext("running");
    let releaseFetch: () => void = () => {};
    const delay = new Promise<void>((resolve) => {
      releaseFetch = resolve;
    });
    const fetch = createFakeFetch({ delay });
    configureOrderConfirmationSoundHostForTests({
      fetch,
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    const preparePromise = prepareOrderConfirmationSound();
    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });
    await expect(preparePromise).resolves.toBeUndefined();
    expect(getOrderConfirmationAudioDebug().state).toBe("running");
    expect(getOrderConfirmationAudioDebug().bufferCached).toBe(false);
    expect(instances[0]?.decodeAudioData).not.toHaveBeenCalled();

    releaseFetch();
    await vi.waitFor(() => {
      expect(getOrderConfirmationAudioDebug().bufferCached).toBe(true);
    });
    expect(instances[0]?.decodeAudioData).toHaveBeenCalledTimes(1);
  });

  it("waits on the in-flight load instead of fetching again", async () => {
    const { FakeAudioContext, instances, bufferSources } =
      createFakeAudioContext("running");
    let releaseFetch: () => void = () => {};
    const delay = new Promise<void>((resolve) => {
      releaseFetch = resolve;
    });
    const fetch = createFakeFetch({ delay });
    configureOrderConfirmationSoundHostForTests({
      fetch,
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    const preparePromise = prepareOrderConfirmationSound();
    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });
    const playPromise = playOrderConfirmationSound(ORDER_A);
    releaseFetch();

    await preparePromise;
    await expect(playPromise).resolves.toBe("played");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(instances[0]?.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(bufferSources).toHaveLength(1);
  });

  it("does not throw when fetch fails", async () => {
    const { FakeAudioContext, bufferSources } =
      createFakeAudioContext("running");
    configureOrderConfirmationSoundHostForTests({
      fetch: createFakeFetch({ fail: true }),
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    await expect(prepareOrderConfirmationSound()).resolves.toBeUndefined();
    await expect(playOrderConfirmationSound(ORDER_A)).resolves.toBe("failed");
    expect(bufferSources).toHaveLength(0);
  });

  it("does not throw when decodeAudioData fails", async () => {
    const { FakeAudioContext, bufferSources } = createFakeAudioContext(
      "running",
      { decodeError: new Error("decode") },
    );
    configureOrderConfirmationSoundHostForTests({
      fetch: createFakeFetch(),
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    await expect(prepareOrderConfirmationSound()).resolves.toBeUndefined();
    await expect(playOrderConfirmationSound(ORDER_A)).resolves.toBe("failed");
    expect(bufferSources).toHaveLength(0);
  });

  it("does not throw when playback fails", async () => {
    const { FakeAudioContext } = createFakeAudioContext("running", {
      playError: true,
    });
    configureOrderConfirmationSoundHostForTests({
      fetch: createFakeFetch(),
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    await prepareOrderConfirmationSound();
    await expect(playOrderConfirmationSound(ORDER_A)).resolves.toBe("failed");
  });

  it("skips invalid order ids without using a generated identity", async () => {
    const { FakeAudioContext, bufferSources } =
      createFakeAudioContext("running");
    configureOrderConfirmationSoundHostForTests({
      fetch: createFakeFetch(),
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    await prepareOrderConfirmationSound();
    await expect(playOrderConfirmationSound("not-an-order")).resolves.toBe(
      "skipped",
    );
    expect(bufferSources).toHaveLength(0);
    expect(getOrderConfirmationAudioDebug().playedCount).toBe(0);
  });

  it("does not create or use the merchant AudioContext", async () => {
    const merchant = createFakeAudioContext("running");
    const customer = createFakeAudioContext("running");
    configureOrderNotificationSoundHostForTests({
      localStorage: {
        getItem: () => null,
        setItem: () => {},
      },
      fetch: createFakeFetch(),
      AudioContext:
        merchant.FakeAudioContext as unknown as new () => AudioContext,
    });
    configureOrderConfirmationSoundHostForTests({
      fetch: createFakeFetch(),
      AudioContext:
        customer.FakeAudioContext as unknown as new () => AudioContext,
    });

    await runConfirmFlow(async () => ({ ok: true, orderId: ORDER_A }));

    expect(merchant.instances).toHaveLength(0);
    expect(getMerchantOrderAudioContextDebug().createdCount).toBe(0);
    expect(customer.instances).toHaveLength(1);
    expect(customer.bufferSources).toHaveLength(1);
  });
});
