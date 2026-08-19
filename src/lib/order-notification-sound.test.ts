import { afterEach, describe, expect, it, vi } from "vitest";
import {
  configureOrderNotificationSoundHostForTests,
  disableMerchantOrderSound,
  enableMerchantOrderSound,
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

function createFakeAudioContext(initialState: AudioContextState = "suspended") {
  const oscillators: Array<{
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    frequency: { setValueAtTime: ReturnType<typeof vi.fn> };
    onended: (() => void) | null;
  }> = [];

  class FakeAudioContext {
    state: AudioContextState = initialState;
    currentTime = 0;
    destination = {};
    resume = vi.fn(async () => {
      this.state = "running";
    });
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

  return { FakeAudioContext, oscillators };
}

afterEach(() => {
  configureOrderNotificationSoundHostForTests(null);
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
  });

  it("plays a two-tone full chime with staggered timings", async () => {
    const { FakeAudioContext, oscillators } = createFakeAudioContext("running");
    const localStorage = createMemoryStorage({
      [MERCHANT_ORDER_SOUND_STORAGE_KEY]: "true",
    });
    configureOrderNotificationSoundHostForTests({
      localStorage,
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    await playMerchantOrderChime("full");

    const [first, second] = MERCHANT_ORDER_FULL_CHIME.tones;
    expect(oscillators).toHaveLength(2);
    expect(oscillators[0]?.frequency.setValueAtTime).toHaveBeenCalledWith(
      first.frequency,
      first.startOffsetSec,
    );
    expect(oscillators[0]?.start).toHaveBeenCalledWith(first.startOffsetSec);
    expect(oscillators[0]?.stop).toHaveBeenCalledWith(
      first.startOffsetSec + first.durationSec,
    );
    expect(oscillators[1]?.frequency.setValueAtTime).toHaveBeenCalledWith(
      second.frequency,
      second.startOffsetSec,
    );
    expect(oscillators[1]?.start).toHaveBeenCalledWith(second.startOffsetSec);
    expect(oscillators[1]?.stop).toHaveBeenCalledWith(
      second.startOffsetSec + second.durationSec,
    );
    expect(second.startOffsetSec + second.durationSec).toBeCloseTo(0.53);
  });

  it("uses the same full chime for Activar sonido as for a new order", async () => {
    const firstRun = createFakeAudioContext("running");
    const localStorage = createMemoryStorage();
    configureOrderNotificationSoundHostForTests({
      localStorage,
      AudioContext:
        firstRun.FakeAudioContext as unknown as new () => AudioContext,
    });
    await enableMerchantOrderSound();

    const secondRun = createFakeAudioContext("running");
    configureOrderNotificationSoundHostForTests({
      localStorage,
      AudioContext:
        secondRun.FakeAudioContext as unknown as new () => AudioContext,
    });
    await playMerchantOrderChime("full");

    expect(firstRun.oscillators).toHaveLength(2);
    expect(secondRun.oscillators).toHaveLength(2);
    expect(firstRun.oscillators[0]?.start.mock.calls).toEqual(
      secondRun.oscillators[0]?.start.mock.calls,
    );
    expect(firstRun.oscillators[1]?.start.mock.calls).toEqual(
      secondRun.oscillators[1]?.start.mock.calls,
    );
    expect(firstRun.oscillators[0]?.stop.mock.calls).toEqual(
      secondRun.oscillators[0]?.stop.mock.calls,
    );
    expect(firstRun.oscillators[1]?.stop.mock.calls).toEqual(
      secondRun.oscillators[1]?.stop.mock.calls,
    );
  });

  it("resumes a suspended AudioContext on enable and plays a test chime", async () => {
    const { FakeAudioContext, oscillators } =
      createFakeAudioContext("suspended");
    const localStorage = createMemoryStorage();
    configureOrderNotificationSoundHostForTests({
      localStorage,
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    const result = await enableMerchantOrderSound();

    expect(result).toBe("playing");
    expect(isMerchantOrderSoundPreferenceEnabled()).toBe(true);
    expect(oscillators.length).toBeGreaterThan(0);
    expect(oscillators[0]?.start).toHaveBeenCalled();
    expect(oscillators[0]?.stop).toHaveBeenCalled();
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
    const { FakeAudioContext } = createFakeAudioContext("suspended");
    const localStorage = createMemoryStorage({
      [MERCHANT_ORDER_SOUND_STORAGE_KEY]: "true",
    });
    configureOrderNotificationSoundHostForTests({
      localStorage,
      AudioContext: FakeAudioContext as unknown as new () => AudioContext,
    });

    const running = await resumeMerchantOrderAudioContext();
    expect(running).toBe(true);
    await playMerchantOrderChime("soft");
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

    await expect(playMerchantOrderChime("full")).resolves.toBeUndefined();
  });

  it("returns unavailable when AudioContext is missing", async () => {
    configureOrderNotificationSoundHostForTests({
      localStorage: createMemoryStorage(),
    });
    await expect(enableMerchantOrderSound()).resolves.toBe("unavailable");
    expect(isMerchantOrderSoundPreferenceEnabled()).toBe(true);
  });
});
