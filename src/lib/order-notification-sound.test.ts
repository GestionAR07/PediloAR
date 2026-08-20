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
  MERCHANT_ORDER_FULL_CHIME,
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

function toneOscillators(
  oscillators: Array<{
    frequency: { setValueAtTime: ReturnType<typeof vi.fn> };
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }>,
) {
  const frequencies = new Set<number>(
    MERCHANT_ORDER_FULL_CHIME.tones.map((tone) => tone.frequency),
  );
  return oscillators.filter((oscillator) => {
    const freq = oscillator.frequency.setValueAtTime.mock.calls[0]?.[0];
    return typeof freq === "number" && frequencies.has(freq);
  });
}

function createFakeAudioContext(initialState: AudioContextState = "suspended") {
  const oscillators: Array<{
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    frequency: { setValueAtTime: ReturnType<typeof vi.fn> };
    onended: (() => void) | null;
  }> = [];
  const instances: Array<{
    state: AudioContextState;
    resume: ReturnType<typeof vi.fn>;
  }> = [];

  class FakeAudioContext {
    state: AudioContextState = initialState;
    currentTime = 0;
    destination = {};
    resume = vi.fn(async () => {
      this.state = "running";
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
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
      };
      return gain;
    }
  }

  return { FakeAudioContext, oscillators, instances };
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
    const localStorage = createMemoryStorage();
    configureOrderNotificationSoundHostForTests({
      localStorage,
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    await playMerchantOrderChime("full");
    expect(isMerchantOrderSoundPreferenceEnabled()).toBe(false);
    expect(getMerchantOrderAudioContextDebug().createdCount).toBe(0);
  });

  it("does not create a new AudioContext from an automatic order play", async () => {
    const { FakeAudioContext, instances } = createFakeAudioContext();
    configureOrderNotificationSoundHostForTests({
      localStorage: createMemoryStorage({
        [MERCHANT_ORDER_SOUND_STORAGE_KEY]: "true",
      }),
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    await expect(playMerchantOrderChime("full", "order")).resolves.toBe(
      "blocked",
    );
    expect(instances).toHaveLength(0);
    expect(getMerchantOrderAudioContextDebug().createdCount).toBe(0);
  });

  it("plays a two-tone full chime with staggered timings", async () => {
    const { FakeAudioContext, oscillators } = createFakeAudioContext("running");
    configureOrderNotificationSoundHostForTests({
      localStorage: createMemoryStorage(),
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    await enableMerchantOrderSound();

    const tones = toneOscillators(oscillators);
    const [first, second] = MERCHANT_ORDER_FULL_CHIME.tones;
    expect(tones).toHaveLength(2);
    expect(tones[0]?.frequency.setValueAtTime).toHaveBeenCalledWith(
      first.frequency,
      first.startOffsetSec,
    );
    expect(tones[0]?.start).toHaveBeenCalledWith(first.startOffsetSec);
    expect(tones[0]?.stop).toHaveBeenCalledWith(
      first.startOffsetSec + first.durationSec,
    );
    expect(tones[1]?.frequency.setValueAtTime).toHaveBeenCalledWith(
      second.frequency,
      second.startOffsetSec,
    );
    expect(tones[1]?.start).toHaveBeenCalledWith(second.startOffsetSec);
    expect(tones[1]?.stop).toHaveBeenCalledWith(
      second.startOffsetSec + second.durationSec,
    );
    expect(second.startOffsetSec + second.durationSec).toBeCloseTo(0.53);
  });

  it("reuses the unlocked AudioContext for a later order chime", async () => {
    const { FakeAudioContext, oscillators, instances } =
      createFakeAudioContext("suspended");
    configureOrderNotificationSoundHostForTests({
      localStorage: createMemoryStorage(),
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    await enableMerchantOrderSound();
    const afterEnable = toneOscillators(oscillators).length;
    await playMerchantOrderChime("full", "order");

    expect(instances).toHaveLength(1);
    expect(getMerchantOrderAudioContextDebug().createdCount).toBe(1);
    expect(getMerchantOrderAudioContextDebug().state).toBe("running");
    expect(toneOscillators(oscillators).length).toBe(afterEnable + 2);
  });

  it("uses the same full chime for Activar sonido as for a new order", async () => {
    const { FakeAudioContext, oscillators } = createFakeAudioContext("running");
    configureOrderNotificationSoundHostForTests({
      localStorage: createMemoryStorage(),
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });
    await enableMerchantOrderSound();
    await playMerchantOrderChime("full");

    const tones = toneOscillators(oscillators);
    expect(tones).toHaveLength(4);
    expect(tones[0]?.start.mock.calls).toEqual(tones[2]?.start.mock.calls);
    expect(tones[1]?.start.mock.calls).toEqual(tones[3]?.start.mock.calls);
    expect(tones[0]?.stop.mock.calls).toEqual(tones[2]?.stop.mock.calls);
    expect(tones[1]?.stop.mock.calls).toEqual(tones[3]?.stop.mock.calls);
  });

  it("resumes a suspended AudioContext on enable and plays a test chime", async () => {
    const { FakeAudioContext, oscillators, instances } =
      createFakeAudioContext("suspended");
    configureOrderNotificationSoundHostForTests({
      localStorage: createMemoryStorage(),
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    const result = await enableMerchantOrderSound();

    expect(result).toBe("playing");
    expect(isMerchantOrderSoundPreferenceEnabled()).toBe(true);
    expect(instances[0]?.resume).toHaveBeenCalled();
    expect(toneOscillators(oscillators).length).toBeGreaterThan(0);
    expect(toneOscillators(oscillators)[0]?.start).toHaveBeenCalled();
    expect(toneOscillators(oscillators)[0]?.stop).toHaveBeenCalled();
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
    }

    configureOrderNotificationSoundHostForTests({
      localStorage: createMemoryStorage(),
      AudioContext: StuckContext as unknown as new () => AudioContext,
    });

    await expect(enableMerchantOrderSound()).resolves.toBe("blocked");
    expect(isMerchantOrderSoundPreferenceEnabled()).toBe(true);
  });

  it("resumes a suspended context before playing a toast chime", async () => {
    const { FakeAudioContext, instances } = createFakeAudioContext("running");
    configureOrderNotificationSoundHostForTests({
      localStorage: createMemoryStorage(),
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    await enableMerchantOrderSound();
    const ctx = instances[0];
    if (ctx) {
      ctx.state = "suspended";
    }
    const running = await resumeMerchantOrderAudioContext();
    expect(running).toBe(true);
    await expect(playMerchantOrderChime("soft", "order")).resolves.toBe(
      "cooldown",
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
    }

    configureOrderNotificationSoundHostForTests({
      localStorage: createMemoryStorage({
        [MERCHANT_ORDER_SOUND_STORAGE_KEY]: "true",
      }),
      AudioContext: ExplodingContext as unknown as new () => AudioContext,
    });

    await expect(playMerchantOrderChime("full")).resolves.toBe("blocked");
  });

  it("returns unavailable when AudioContext is missing", async () => {
    configureOrderNotificationSoundHostForTests({
      localStorage: createMemoryStorage(),
    });
    await expect(enableMerchantOrderSound()).resolves.toBe("unavailable");
    expect(isMerchantOrderSoundPreferenceEnabled()).toBe(true);
  });

  it("does not start order-chime cooldown from the Activar sonido test chime", async () => {
    const { FakeAudioContext } = createFakeAudioContext("running");
    configureOrderNotificationSoundHostForTests({
      localStorage: createMemoryStorage(),
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
});
