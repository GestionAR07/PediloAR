import { afterEach, describe, expect, it, vi } from "vitest";
import {
  recordSessionMerchantNewOrderInsert,
  resetMerchantNewOrderAlertForTests,
} from "@/application/merchant/new-order-alert";
import {
  configureOrderNotificationSoundHostForTests,
  disableMerchantOrderSound,
  enableMerchantOrderSound,
  getMerchantOrderAudioContextDebug,
  isMerchantOrderSoundPreferenceEnabled,
  MERCHANT_NEW_ORDER_SOUND_SRC,
  MERCHANT_ORDER_FULL_PLAYBACK_GAIN,
  MERCHANT_ORDER_SOFT_PLAYBACK_GAIN,
  MERCHANT_ORDER_SOUND_STORAGE_KEY,
  playMerchantOrderChime,
  resumeMerchantOrderAudioContext,
  setMerchantOrderSoundPreferenceEnabled,
  subscribeMerchantOrderSoundPreference,
} from "./order-notification-sound";

type FakeNode = {
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

function createMemoryStorage(initial?: Record<string, string>) {
  const data = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
    data,
  };
}

function createFakeFetch(
  options: {
    ok?: boolean;
    fail?: boolean;
    arrayBuffer?: ArrayBuffer;
    delay?: Promise<void>;
  } = {},
) {
  const arrayBuffer = options.arrayBuffer ?? new ArrayBuffer(8);
  return vi.fn(async (input: string) => {
    if (options.delay) {
      await options.delay;
    }
    if (options.fail) {
      throw new Error("network failed");
    }
    expect(input).toBe(MERCHANT_NEW_ORDER_SOUND_SRC);
    return {
      ok: options.ok ?? true,
      arrayBuffer: async () => arrayBuffer,
    };
  });
}

function createFakeAudioContext(
  initialState: AudioContextState = "suspended",
  options: { decodeError?: Error } = {},
) {
  const oscillators: Array<{
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    frequency: { setValueAtTime: ReturnType<typeof vi.fn> };
    onended: (() => void) | null;
  }> = [];
  const bufferSources: Array<{
    buffer: AudioBuffer | null;
    start: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
    onended: (() => void) | null;
  }> = [];
  const playbackGains: Array<{
    setValueAtTime: ReturnType<typeof vi.fn>;
  }> = [];
  const fakeBuffer = {
    duration: 1.2,
    length: 52920,
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
      const oscillator = {
        type: "sine" as OscillatorType,
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null as (() => void) | null,
      };
      oscillators.push(oscillator);
      return oscillator;
    }
    createGain() {
      const gain: FakeNode & {
        gain: {
          setValueAtTime: ReturnType<typeof vi.fn>;
          exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
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
          exponentialRampToValueAtTime: vi.fn(),
        },
      };
      return gain;
    }
    createBufferSource() {
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
    oscillators,
    bufferSources,
    playbackGains,
    fakeBuffer,
    instances,
  };
}

afterEach(() => {
  configureOrderNotificationSoundHostForTests(null);
  resetMerchantNewOrderAlertForTests();
});

describe("merchant order notification sound", () => {
  it("persists the namespaced localStorage preference", () => {
    const localStorage = createMemoryStorage();
    configureOrderNotificationSoundHostForTests({ localStorage });

    expect(isMerchantOrderSoundPreferenceEnabled()).toBe(false);
    setMerchantOrderSoundPreferenceEnabled(true);
    expect(localStorage.getItem(MERCHANT_ORDER_SOUND_STORAGE_KEY)).toBe("true");
    expect(isMerchantOrderSoundPreferenceEnabled()).toBe(true);
    const onChange = vi.fn();
    const unsubscribe = subscribeMerchantOrderSoundPreference(onChange);
    disableMerchantOrderSound();
    expect(onChange).toHaveBeenCalledTimes(1);
    unsubscribe();
    expect(isMerchantOrderSoundPreferenceEnabled()).toBe(false);
  });

  it("does not create an AudioContext when sound is off", async () => {
    const { FakeAudioContext } = createFakeAudioContext();
    const fetch = createFakeFetch();
    const localStorage = createMemoryStorage();
    configureOrderNotificationSoundHostForTests({
      localStorage,
      fetch,
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    await playMerchantOrderChime("full");
    expect(isMerchantOrderSoundPreferenceEnabled()).toBe(false);
    expect(getMerchantOrderAudioContextDebug().createdCount).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not create a new AudioContext from an automatic order play", async () => {
    const { FakeAudioContext, instances } = createFakeAudioContext();
    const fetch = createFakeFetch();
    configureOrderNotificationSoundHostForTests({
      localStorage: createMemoryStorage({
        [MERCHANT_ORDER_SOUND_STORAGE_KEY]: "true",
      }),
      fetch,
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    await expect(playMerchantOrderChime("full")).resolves.toBe("blocked");
    expect(instances).toHaveLength(0);
    expect(getMerchantOrderAudioContextDebug().createdCount).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("plays the real new-order asset from Activar sonido", async () => {
    const { FakeAudioContext, bufferSources, playbackGains, fakeBuffer } =
      createFakeAudioContext("running");
    const fetch = createFakeFetch();
    configureOrderNotificationSoundHostForTests({
      localStorage: createMemoryStorage(),
      fetch,
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    await expect(enableMerchantOrderSound()).resolves.toBe("playing");

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(MERCHANT_NEW_ORDER_SOUND_SRC);
    expect(bufferSources).toHaveLength(1);
    expect(bufferSources[0]?.buffer).toBe(fakeBuffer);
    expect(bufferSources[0]?.start).toHaveBeenCalledWith(0);
    expect(playbackGains[0]?.setValueAtTime).toHaveBeenCalledWith(
      MERCHANT_ORDER_FULL_PLAYBACK_GAIN,
      0,
    );
    expect(getMerchantOrderAudioContextDebug().bufferCached).toBe(true);
  });

  it("reuses the unlocked AudioContext and cached buffer for a later order", async () => {
    const { FakeAudioContext, bufferSources, fakeBuffer, instances } =
      createFakeAudioContext("suspended");
    const fetch = createFakeFetch();
    configureOrderNotificationSoundHostForTests({
      localStorage: createMemoryStorage(),
      fetch,
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    await enableMerchantOrderSound();
    expect(instances).toHaveLength(1);
    const decodeCalls = instances[0]?.decodeAudioData.mock.calls.length ?? 0;
    await expect(playMerchantOrderChime("full")).resolves.toBe("played");

    expect(instances).toHaveLength(1);
    expect(getMerchantOrderAudioContextDebug().createdCount).toBe(1);
    expect(getMerchantOrderAudioContextDebug().state).toBe("running");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(instances[0]?.decodeAudioData).toHaveBeenCalledTimes(decodeCalls);
    expect(instances[0]?.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(bufferSources).toHaveLength(2);
    expect(bufferSources[0]?.buffer).toBe(fakeBuffer);
    expect(bufferSources[1]?.buffer).toBe(fakeBuffer);
    expect(bufferSources[1]?.buffer).toBe(bufferSources[0]?.buffer);
  });

  it("uses the same full asset for Activar sonido as for a new order", async () => {
    const { FakeAudioContext, bufferSources, playbackGains } =
      createFakeAudioContext("running");
    configureOrderNotificationSoundHostForTests({
      localStorage: createMemoryStorage(),
      fetch: createFakeFetch(),
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });
    await enableMerchantOrderSound();
    await playMerchantOrderChime("full");

    expect(bufferSources).toHaveLength(2);
    expect(bufferSources[0]?.buffer).toBe(bufferSources[1]?.buffer);
    expect(bufferSources[0]?.start.mock.calls).toEqual(
      bufferSources[1]?.start.mock.calls,
    );
    expect(playbackGains[0]?.setValueAtTime.mock.calls).toEqual(
      playbackGains[1]?.setValueAtTime.mock.calls,
    );
  });

  it("loads and decodes the asset only once per helper lifetime", async () => {
    const { FakeAudioContext, instances } = createFakeAudioContext("running");
    const fetch = createFakeFetch();
    configureOrderNotificationSoundHostForTests({
      localStorage: createMemoryStorage(),
      fetch,
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    await enableMerchantOrderSound();
    await playMerchantOrderChime("full");
    await playMerchantOrderChime("soft");

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(instances[0]?.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(getMerchantOrderAudioContextDebug().createdCount).toBe(1);
    expect(getMerchantOrderAudioContextDebug().bufferCached).toBe(true);
  });

  it("resumes a suspended AudioContext on enable and plays a test asset", async () => {
    const { FakeAudioContext, bufferSources, instances } =
      createFakeAudioContext("suspended");
    configureOrderNotificationSoundHostForTests({
      localStorage: createMemoryStorage(),
      fetch: createFakeFetch(),
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    const result = await enableMerchantOrderSound();

    expect(result).toBe("playing");
    expect(isMerchantOrderSoundPreferenceEnabled()).toBe(true);
    expect(instances[0]?.resume).toHaveBeenCalled();
    expect(bufferSources).toHaveLength(1);
    expect(bufferSources[0]?.start).toHaveBeenCalled();
  });

  it("reports blocked when resume does not reach running", async () => {
    class StuckContext {
      state: AudioContextState = "suspended";
      currentTime = 0;
      destination = {};
      resume = vi.fn(async () => {
        this.state = "suspended";
      });
      createOscillator() {
        throw new Error("should not play");
      }
      createGain() {
        throw new Error("should not play");
      }
      createBufferSource() {
        throw new Error("should not play");
      }
      decodeAudioData() {
        throw new Error("should not decode");
      }
    }
    const fetch = createFakeFetch();

    configureOrderNotificationSoundHostForTests({
      localStorage: createMemoryStorage(),
      fetch,
      AudioContext: StuckContext as unknown as new () => AudioContext,
    });

    await expect(enableMerchantOrderSound()).resolves.toBe("blocked");
    expect(isMerchantOrderSoundPreferenceEnabled()).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("resumes a suspended context before playing a toast chime", async () => {
    const { FakeAudioContext, instances, playbackGains } =
      createFakeAudioContext("running");
    configureOrderNotificationSoundHostForTests({
      localStorage: createMemoryStorage(),
      fetch: createFakeFetch(),
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    await enableMerchantOrderSound();
    const ctx = instances[0];
    if (ctx) {
      ctx.state = "suspended";
    }
    const running = await resumeMerchantOrderAudioContext();
    expect(running).toBe(true);
    await expect(playMerchantOrderChime("soft")).resolves.toBe("cooldown");
    expect(playbackGains[1]?.setValueAtTime).toHaveBeenCalledWith(
      MERCHANT_ORDER_SOFT_PLAYBACK_GAIN,
      0,
    );
  });

  it("does not throw when Web Audio fails", async () => {
    class ExplodingContext {
      state: AudioContextState = "running";
      currentTime = 0;
      destination = {};
      resume = vi.fn(async () => {});
      createOscillator() {
        throw new Error("audio failed");
      }
      createGain() {
        throw new Error("audio failed");
      }
      createBufferSource() {
        throw new Error("audio failed");
      }
      decodeAudioData() {
        throw new Error("audio failed");
      }
    }

    configureOrderNotificationSoundHostForTests({
      localStorage: createMemoryStorage({
        [MERCHANT_ORDER_SOUND_STORAGE_KEY]: "true",
      }),
      fetch: createFakeFetch(),
      AudioContext: ExplodingContext as unknown as new () => AudioContext,
    });

    await expect(playMerchantOrderChime("full")).resolves.toBe("blocked");
  });

  it("returns unavailable when AudioContext is missing", async () => {
    configureOrderNotificationSoundHostForTests({
      localStorage: createMemoryStorage(),
      fetch: createFakeFetch(),
    });
    await expect(enableMerchantOrderSound()).resolves.toBe("unavailable");
    expect(isMerchantOrderSoundPreferenceEnabled()).toBe(true);
  });

  it("does not start order-chime cooldown from the Activar sonido test sound", async () => {
    const { FakeAudioContext } = createFakeAudioContext("running");
    configureOrderNotificationSoundHostForTests({
      localStorage: createMemoryStorage(),
      fetch: createFakeFetch(),
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    await enableMerchantOrderSound();
    const result = recordSessionMerchantNewOrderInsert({
      visibleOrderIds: [],
      soundEnabled: true,
      orderId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      nowMs: 1,
    });
    expect(result.chime).toBe("full");
  });

  it("keeps a single keep-alive oscillator and stops it on silence", async () => {
    const { FakeAudioContext, oscillators } = createFakeAudioContext("running");
    configureOrderNotificationSoundHostForTests({
      localStorage: createMemoryStorage(),
      fetch: createFakeFetch(),
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    await enableMerchantOrderSound();
    expect(oscillators).toHaveLength(1);
    expect(getMerchantOrderAudioContextDebug().keepAlive).toBe(true);

    await enableMerchantOrderSound();
    await playMerchantOrderChime("full");
    expect(oscillators).toHaveLength(1);
    expect(getMerchantOrderAudioContextDebug().createdCount).toBe(1);

    disableMerchantOrderSound();
    expect(oscillators[0]?.stop).toHaveBeenCalled();
    expect(getMerchantOrderAudioContextDebug().keepAlive).toBe(false);
    expect(getMerchantOrderAudioContextDebug().createdCount).toBe(1);

    await enableMerchantOrderSound();
    expect(oscillators).toHaveLength(2);
    expect(oscillators[1]?.start).toHaveBeenCalled();
    expect(getMerchantOrderAudioContextDebug().keepAlive).toBe(true);
    expect(getMerchantOrderAudioContextDebug().createdCount).toBe(1);
  });

  it("does not fetch or decode on later orders after the buffer is cached", async () => {
    const { FakeAudioContext, instances, bufferSources } =
      createFakeAudioContext("running");
    const fetch = createFakeFetch();
    configureOrderNotificationSoundHostForTests({
      localStorage: createMemoryStorage(),
      fetch,
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    await enableMerchantOrderSound();
    await playMerchantOrderChime("full");
    await playMerchantOrderChime("full");

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(instances[0]?.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(bufferSources).toHaveLength(3);
    expect(getMerchantOrderAudioContextDebug().createdCount).toBe(1);
  });

  it("reuses an in-flight asset load when an order arrives during enable", async () => {
    const { FakeAudioContext, instances, bufferSources } =
      createFakeAudioContext("running");
    let releaseFetch: () => void = () => {};
    const delay = new Promise<void>((resolve) => {
      releaseFetch = resolve;
    });
    const fetch = createFakeFetch({ delay });
    configureOrderNotificationSoundHostForTests({
      localStorage: createMemoryStorage(),
      fetch,
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    const enablePromise = enableMerchantOrderSound();
    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });
    const orderPromise = playMerchantOrderChime("full");
    releaseFetch();

    await expect(enablePromise).resolves.toBe("playing");
    await expect(orderPromise).resolves.toBe("played");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(instances[0]?.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(instances).toHaveLength(1);
    expect(bufferSources).toHaveLength(2);
  });

  it("does not break enable or order alert when fetch fails", async () => {
    const { FakeAudioContext, bufferSources } =
      createFakeAudioContext("running");
    configureOrderNotificationSoundHostForTests({
      localStorage: createMemoryStorage(),
      fetch: createFakeFetch({ fail: true }),
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    await expect(enableMerchantOrderSound()).resolves.toBe("blocked");
    expect(isMerchantOrderSoundPreferenceEnabled()).toBe(true);
    await expect(playMerchantOrderChime("full")).resolves.toBe("failed");
    expect(bufferSources).toHaveLength(0);
    expect(getMerchantOrderAudioContextDebug().createdCount).toBe(1);
  });

  it("does not break enable or order alert when decodeAudioData fails", async () => {
    const { FakeAudioContext, bufferSources, instances } =
      createFakeAudioContext("running", { decodeError: new Error("decode") });
    const fetch = createFakeFetch();
    configureOrderNotificationSoundHostForTests({
      localStorage: createMemoryStorage(),
      fetch,
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    await expect(enableMerchantOrderSound()).resolves.toBe("blocked");
    await expect(playMerchantOrderChime("full")).resolves.toBe("failed");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(instances[0]?.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(bufferSources).toHaveLength(0);
    expect(getMerchantOrderAudioContextDebug().bufferCached).toBe(false);
  });

  it("does not reload the asset after silencing and re-enabling", async () => {
    const { FakeAudioContext, instances, bufferSources } =
      createFakeAudioContext("running");
    const fetch = createFakeFetch();
    configureOrderNotificationSoundHostForTests({
      localStorage: createMemoryStorage(),
      fetch,
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    await enableMerchantOrderSound();
    disableMerchantOrderSound();
    await expect(enableMerchantOrderSound()).resolves.toBe("playing");

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(instances).toHaveLength(1);
    expect(instances[0]?.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(bufferSources).toHaveLength(2);
    expect(getMerchantOrderAudioContextDebug().createdCount).toBe(1);
  });

  it("plays a quieter copy of the same cached asset during cooldown", async () => {
    const { FakeAudioContext, bufferSources, playbackGains } =
      createFakeAudioContext("running");
    configureOrderNotificationSoundHostForTests({
      localStorage: createMemoryStorage(),
      fetch: createFakeFetch(),
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    await enableMerchantOrderSound();
    await playMerchantOrderChime("soft");

    expect(bufferSources[0]?.buffer).toBe(bufferSources[1]?.buffer);
    expect(playbackGains[1]?.setValueAtTime).toHaveBeenCalledWith(
      MERCHANT_ORDER_SOFT_PLAYBACK_GAIN,
      0,
    );
  });
});
