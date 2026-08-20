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

export type MerchantOrderSoundPlayResult =
  "played" | "blocked" | "failed" | "cooldown";

type KeepAliveNodes = {
  oscillator: OscillatorNode;
  gain: GainNode;
};

let testHost: OrderNotificationSoundHost | null = null;
let audioContext: AudioContext | null = null;
let keepAlive: KeepAliveNodes | null = null;
let audioContextCreatedCount = 0;

export function configureOrderNotificationSoundHostForTests(
  host: OrderNotificationSoundHost | null,
): void {
  stopKeepAlive();
  testHost = host;
  audioContext = null;
  audioContextCreatedCount = 0;
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

function isDevRuntime(): boolean {
  return process.env.NODE_ENV === "development";
}

function merchantSoundDevLog(
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

export function getMerchantOrderAudioContextDebug(): {
  exists: boolean;
  state: string;
  createdCount: number;
  keepAlive: boolean;
} {
  return {
    exists: Boolean(audioContext && audioContext.state !== "closed"),
    state: audioContext?.state ?? "none",
    createdCount: audioContextCreatedCount,
    keepAlive: Boolean(keepAlive),
  };
}

function getOrCreateMerchantOrderAudioContext(): AudioContext | null {
  const Context = getAudioContextConstructor();
  if (!Context) {
    return null;
  }
  if (!audioContext || audioContext.state === "closed") {
    audioContext = new Context();
    audioContextCreatedCount += 1;
    keepAlive = null;
  }
  return audioContext;
}

function getExistingMerchantOrderAudioContext(): AudioContext | null {
  if (!audioContext || audioContext.state === "closed") {
    return null;
  }
  return audioContext;
}

function stopKeepAlive(): void {
  if (!keepAlive) {
    return;
  }
  try {
    keepAlive.oscillator.stop();
  } catch {
    /* already stopped */
  }
  try {
    keepAlive.oscillator.disconnect();
    keepAlive.gain.disconnect();
  } catch {
    /* already disconnected */
  }
  keepAlive = null;
}

function startKeepAlive(ctx: AudioContext): void {
  if (keepAlive) {
    return;
  }
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  const now = ctx.currentTime;
  oscillator.frequency.setValueAtTime(20, now);
  gain.gain.setValueAtTime(0, now);
  oscillator.start(now);
  keepAlive = { oscillator, gain };
}

async function resumeExistingContext(
  ctx: AudioContext,
): Promise<AudioContext | null> {
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return null;
    }
  }
  if (ctx.state !== "running") {
    return null;
  }
  startKeepAlive(ctx);
  return ctx;
}

export async function resumeMerchantOrderAudioContext(): Promise<boolean> {
  try {
    const ctx = getExistingMerchantOrderAudioContext();
    if (!ctx) {
      return false;
    }
    return (await resumeExistingContext(ctx)) != null;
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

function playTones(ctx: AudioContext, kind: MerchantOrderChimeKind): void {
  if (kind === "soft") {
    playEnvelope(ctx, MERCHANT_ORDER_SOFT_CHIME);
    return;
  }
  for (const tone of MERCHANT_ORDER_FULL_CHIME.tones) {
    playEnvelope(ctx, {
      ...tone,
      attackSec: MERCHANT_ORDER_FULL_CHIME.attackSec,
    });
  }
}

async function playChimeOnExistingContext(
  kind: MerchantOrderChimeKind,
): Promise<Exclude<MerchantOrderSoundPlayResult, "cooldown">> {
  const ctx = getExistingMerchantOrderAudioContext();
  if (!ctx) {
    return "blocked";
  }
  const running = await resumeExistingContext(ctx);
  if (!running) {
    return "blocked";
  }
  try {
    playTones(running, kind);
    return "played";
  } catch {
    return "failed";
  }
}

export async function playMerchantOrderChime(
  kind: MerchantOrderChimeKind,
  source: "order" | "enable" = "order",
): Promise<MerchantOrderSoundPlayResult> {
  const enabled = isMerchantOrderSoundPreferenceEnabled();
  if (!enabled) {
    if (source === "order") {
      merchantSoundDevLog("[merchant-sound] order", {
        enabled: false,
        ...getMerchantOrderAudioContextDebug(),
        result: "blocked",
      });
    }
    return "blocked";
  }
  try {
    const result = await playChimeOnExistingContext(kind);
    if (source === "order") {
      merchantSoundDevLog("[merchant-sound] order", {
        enabled: true,
        ...getMerchantOrderAudioContextDebug(),
        result: kind === "soft" && result === "played" ? "cooldown" : result,
      });
    }
    return kind === "soft" && result === "played" ? "cooldown" : result;
  } catch {
    if (source === "order") {
      merchantSoundDevLog("[merchant-sound] order", {
        enabled: true,
        ...getMerchantOrderAudioContextDebug(),
        result: "failed",
      });
    }
    return "failed";
  }
}

export async function enableMerchantOrderSound(): Promise<EnableMerchantOrderSoundResult> {
  const beforeState = getMerchantOrderAudioContextDebug().state;
  setMerchantOrderSoundPreferenceEnabled(true);
  try {
    const ctx = getOrCreateMerchantOrderAudioContext();
    if (!ctx) {
      merchantSoundDevLog("[merchant-sound] enable", {
        beforeState,
        afterState: "none",
        testPlayed: false,
      });
      return "unavailable";
    }
    const running = await resumeExistingContext(ctx);
    if (!running) {
      merchantSoundDevLog("[merchant-sound] enable", {
        beforeState,
        afterState: ctx.state,
        testPlayed: false,
      });
      return "blocked";
    }
    playTones(running, "full");
    merchantSoundDevLog("[merchant-sound] enable", {
      beforeState,
      afterState: running.state,
      testPlayed: true,
    });
    return "playing";
  } catch {
    merchantSoundDevLog("[merchant-sound] enable", {
      beforeState,
      afterState: getMerchantOrderAudioContextDebug().state,
      testPlayed: false,
    });
    return "blocked";
  }
}

export function disableMerchantOrderSound(): void {
  stopKeepAlive();
  setMerchantOrderSoundPreferenceEnabled(false);
}

export function logMerchantOrderSoundSkipped(
  result: "blocked" | "cooldown",
): void {
  merchantSoundDevLog("[merchant-sound] order", {
    enabled: isMerchantOrderSoundPreferenceEnabled(),
    ...getMerchantOrderAudioContextDebug(),
    result,
  });
}
