export const MERCHANT_ORDER_SOUND_STORAGE_KEY =
  "pedilo-merchant-order-sound-enabled";

export type OrderNotificationSoundHost = {
  AudioContext?: new () => AudioContext;
  webkitAudioContext?: new () => AudioContext;
  localStorage?: Pick<Storage, "getItem" | "setItem">;
};

export type MerchantOrderChimeKind = "full" | "soft";

export type EnableMerchantOrderSoundResult =
  "playing" | "blocked" | "unavailable";

let testHost: OrderNotificationSoundHost | null = null;
let audioContext: AudioContext | null = null;

export function configureOrderNotificationSoundHostForTests(
  host: OrderNotificationSoundHost | null,
): void {
  testHost = host;
  audioContext = null;
  preferenceListeners.clear();
}

function getHost(): OrderNotificationSoundHost {
  if (testHost) {
    return testHost;
  }
  if (typeof globalThis === "undefined") {
    return {};
  }
  return globalThis as OrderNotificationSoundHost;
}

function getStorage(): Pick<Storage, "getItem" | "setItem"> | undefined {
  return getHost().localStorage;
}

function getAudioContextConstructor(): (new () => AudioContext) | undefined {
  const host = getHost();
  if (typeof host.AudioContext === "function") {
    return host.AudioContext;
  }
  if (typeof host.webkitAudioContext === "function") {
    return host.webkitAudioContext;
  }
  return undefined;
}

const preferenceListeners = new Set<() => void>();

export function subscribeMerchantOrderSoundPreference(
  onChange: () => void,
): () => void {
  preferenceListeners.add(onChange);
  return () => {
    preferenceListeners.delete(onChange);
  };
}

function emitSoundPreferenceChange(): void {
  for (const listener of preferenceListeners) {
    listener();
  }
}

export function isMerchantOrderSoundPreferenceEnabled(): boolean {
  try {
    return getStorage()?.getItem(MERCHANT_ORDER_SOUND_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setMerchantOrderSoundPreferenceEnabled(enabled: boolean): void {
  try {
    getStorage()?.setItem(
      MERCHANT_ORDER_SOUND_STORAGE_KEY,
      enabled ? "true" : "false",
    );
  } catch {
    /* ignore quota / private mode */
  }
  emitSoundPreferenceChange();
}

export async function resumeMerchantOrderAudioContext(): Promise<boolean> {
  try {
    const Context = getAudioContextConstructor();
    if (!Context) {
      return false;
    }
    if (!audioContext || audioContext.state === "closed") {
      audioContext = new Context();
    }
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }
    return audioContext.state === "running";
  } catch {
    return false;
  }
}

export const MERCHANT_ORDER_FULL_CHIME = {
  attackSec: 0.028,
  tones: [
    {
      frequency: 880,
      durationSec: 0.34,
      peakGain: 0.22,
      startOffsetSec: 0,
    },
    {
      frequency: 1108.73,
      durationSec: 0.38,
      peakGain: 0.18,
      startOffsetSec: 0.15,
    },
  ],
} as const;

export const MERCHANT_ORDER_SOFT_CHIME = {
  frequency: 880,
  durationSec: 0.2,
  peakGain: 0.1,
  startOffsetSec: 0,
} as const;

function playEnvelope(
  ctx: AudioContext,
  options: {
    frequency: number;
    durationSec: number;
    peakGain: number;
    startOffsetSec: number;
    attackSec?: number;
  },
): void {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.connect(gain);
  gain.connect(ctx.destination);

  const startAt = ctx.currentTime + options.startOffsetSec;
  const attackSec = options.attackSec ?? MERCHANT_ORDER_FULL_CHIME.attackSec;
  const attackAt = startAt + attackSec;
  const endAt = startAt + options.durationSec;

  oscillator.frequency.setValueAtTime(options.frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(options.peakGain, attackAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

  oscillator.onended = () => {
    try {
      oscillator.disconnect();
      gain.disconnect();
    } catch {
      /* already disconnected */
    }
  };

  oscillator.start(startAt);
  oscillator.stop(endAt);
}

async function playChime(kind: MerchantOrderChimeKind): Promise<void> {
  const running = await resumeMerchantOrderAudioContext();
  if (!running || !audioContext) {
    return;
  }

  if (kind === "soft") {
    playEnvelope(audioContext, MERCHANT_ORDER_SOFT_CHIME);
    return;
  }

  for (const tone of MERCHANT_ORDER_FULL_CHIME.tones) {
    playEnvelope(audioContext, {
      ...tone,
      attackSec: MERCHANT_ORDER_FULL_CHIME.attackSec,
    });
  }
}

export async function playMerchantOrderChime(
  kind: MerchantOrderChimeKind,
): Promise<void> {
  if (!isMerchantOrderSoundPreferenceEnabled()) {
    return;
  }
  try {
    await playChime(kind);
  } catch {
    /* toast must still work */
  }
}

export async function enableMerchantOrderSound(): Promise<EnableMerchantOrderSoundResult> {
  setMerchantOrderSoundPreferenceEnabled(true);
  try {
    const Context = getAudioContextConstructor();
    if (!Context) {
      return "unavailable";
    }
    const running = await resumeMerchantOrderAudioContext();
    if (!running) {
      return "blocked";
    }
    await playChime("full");
    return "playing";
  } catch {
    return "blocked";
  }
}

export function disableMerchantOrderSound(): void {
  setMerchantOrderSoundPreferenceEnabled(false);
}
