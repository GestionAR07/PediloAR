export const MERCHANT_ORDER_SOUND_STORAGE_KEY =
  "pedilo-merchant-order-sound-enabled";

export const MERCHANT_NEW_ORDER_SOUND_SRC = "/sounds/pedilo-new-order.mp3";

export const MERCHANT_ORDER_FULL_PLAYBACK_GAIN = 1;
export const MERCHANT_ORDER_SOFT_PLAYBACK_GAIN = 0.35;

export type OrderNotificationSoundHost = {
  AudioContext?: new () => AudioContext;
  webkitAudioContext?: new () => AudioContext;
  localStorage?: Pick<Storage, "getItem" | "setItem">;
  fetch?: (input: string) => Promise<{
    ok: boolean;
    arrayBuffer: () => Promise<ArrayBuffer>;
  }>;
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
let decodedNewOrderBuffer: AudioBuffer | null = null;
let loadNewOrderBufferPromise: Promise<AudioBuffer | null> | null = null;

export function configureOrderNotificationSoundHostForTests(
  host: OrderNotificationSoundHost | null,
): void {
  stopKeepAlive();
  testHost = host;
  audioContext = null;
  audioContextCreatedCount = 0;
  decodedNewOrderBuffer = null;
  loadNewOrderBufferPromise = null;
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

function getFetch(): OrderNotificationSoundHost["fetch"] {
  const host = getHost();
  if (typeof host.fetch === "function") {
    return host.fetch.bind(host);
  }
  return undefined;
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

export function getMerchantOrderAudioContextDebug(): {
  exists: boolean;
  state: string;
  createdCount: number;
  keepAlive: boolean;
  bufferCached: boolean;
} {
  return {
    exists: Boolean(audioContext && audioContext.state !== "closed"),
    state: audioContext?.state ?? "none",
    createdCount: audioContextCreatedCount,
    keepAlive: Boolean(keepAlive),
    bufferCached: decodedNewOrderBuffer != null,
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
    decodedNewOrderBuffer = null;
    loadNewOrderBufferPromise = null;
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

async function fetchAndDecodeNewOrderBuffer(
  ctx: AudioContext,
): Promise<AudioBuffer | null> {
  const fetchFn = getFetch();
  if (!fetchFn) {
    return null;
  }
  try {
    const response = await fetchFn(MERCHANT_NEW_ORDER_SOUND_SRC);
    if (!response.ok) {
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    decodedNewOrderBuffer = audioBuffer;
    return audioBuffer;
  } catch {
    return null;
  }
}

function loadNewOrderBuffer(ctx: AudioContext): Promise<AudioBuffer | null> {
  if (decodedNewOrderBuffer) {
    return Promise.resolve(decodedNewOrderBuffer);
  }
  if (!loadNewOrderBufferPromise) {
    loadNewOrderBufferPromise = fetchAndDecodeNewOrderBuffer(ctx).then(
      (buffer) => {
        if (!buffer) {
          loadNewOrderBufferPromise = null;
        }
        return buffer;
      },
    );
  }
  return loadNewOrderBufferPromise;
}

function playbackGainFor(kind: MerchantOrderChimeKind): number {
  return kind === "soft"
    ? MERCHANT_ORDER_SOFT_PLAYBACK_GAIN
    : MERCHANT_ORDER_FULL_PLAYBACK_GAIN;
}

function playDecodedBuffer(
  ctx: AudioContext,
  buffer: AudioBuffer,
  kind: MerchantOrderChimeKind,
): void {
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = buffer;
  source.connect(gain);
  gain.connect(ctx.destination);
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(playbackGainFor(kind), now);
  source.onended = () => {
    try {
      source.disconnect();
      gain.disconnect();
    } catch {
      /* already disconnected */
    }
  };
  source.start(now);
}

async function resolveCachedOrInFlightBuffer(): Promise<AudioBuffer | null> {
  if (decodedNewOrderBuffer) {
    return decodedNewOrderBuffer;
  }
  if (!loadNewOrderBufferPromise) {
    return null;
  }
  try {
    return await loadNewOrderBufferPromise;
  } catch {
    return null;
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
  const buffer = await resolveCachedOrInFlightBuffer();
  if (!buffer) {
    return "failed";
  }
  try {
    playDecodedBuffer(running, buffer, kind);
    return "played";
  } catch {
    return "failed";
  }
}

export async function playMerchantOrderChime(
  kind: MerchantOrderChimeKind,
): Promise<MerchantOrderSoundPlayResult> {
  const enabled = isMerchantOrderSoundPreferenceEnabled();
  if (!enabled) {
    return "blocked";
  }
  try {
    const result = await playChimeOnExistingContext(kind);
    return kind === "soft" && result === "played" ? "cooldown" : result;
  } catch {
    return "failed";
  }
}

export async function enableMerchantOrderSound(): Promise<EnableMerchantOrderSoundResult> {
  setMerchantOrderSoundPreferenceEnabled(true);
  try {
    const ctx = getOrCreateMerchantOrderAudioContext();
    if (!ctx) {
      return "unavailable";
    }
    const running = await resumeExistingContext(ctx);
    if (!running) {
      return "blocked";
    }
    const buffer = await loadNewOrderBuffer(running);
    if (!buffer) {
      return "blocked";
    }
    playDecodedBuffer(running, buffer, "full");
    return "playing";
  } catch {
    return "blocked";
  }
}

export function disableMerchantOrderSound(): void {
  stopKeepAlive();
  setMerchantOrderSoundPreferenceEnabled(false);
}
