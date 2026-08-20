import { isValidUuid } from "@/lib/uuid";

export const ORDER_CONFIRMATION_SOUND_SRC =
  "/sounds/pedilo-order-confirmed.mp3";

export const ORDER_CONFIRMATION_PLAYBACK_GAIN = 1;

export type OrderConfirmationSoundHost = {
  AudioContext?: new () => AudioContext;
  webkitAudioContext?: new () => AudioContext;
  fetch?: (input: string) => Promise<{
    ok: boolean;
    arrayBuffer: () => Promise<ArrayBuffer>;
  }>;
};

export type OrderConfirmationSoundPlayResult =
  "played" | "blocked" | "failed" | "skipped";

type KeepAliveNodes = {
  oscillator: OscillatorNode;
  gain: GainNode;
};

let testHost: OrderConfirmationSoundHost | null = null;
let audioContext: AudioContext | null = null;
let keepAlive: KeepAliveNodes | null = null;
let audioContextCreatedCount = 0;
let decodedConfirmationBuffer: AudioBuffer | null = null;
let loadConfirmationBufferPromise: Promise<AudioBuffer | null> | null = null;
const playedConfirmationOrderIds = new Set<string>();

export function configureOrderConfirmationSoundHostForTests(
  host: OrderConfirmationSoundHost | null,
): void {
  stopKeepAlive();
  testHost = host;
  audioContext = null;
  audioContextCreatedCount = 0;
  decodedConfirmationBuffer = null;
  loadConfirmationBufferPromise = null;
  playedConfirmationOrderIds.clear();
}

function getHost(): OrderConfirmationSoundHost {
  if (testHost) {
    return testHost;
  }
  if (typeof globalThis === "undefined") {
    return {};
  }
  return globalThis as OrderConfirmationSoundHost;
}

function getFetch(): OrderConfirmationSoundHost["fetch"] {
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

export function getOrderConfirmationAudioDebug(): {
  exists: boolean;
  state: string;
  createdCount: number;
  keepAlive: boolean;
  bufferCached: boolean;
  playedCount: number;
} {
  return {
    exists: Boolean(audioContext && audioContext.state !== "closed"),
    state: audioContext?.state ?? "none",
    createdCount: audioContextCreatedCount,
    keepAlive: Boolean(keepAlive),
    bufferCached: decodedConfirmationBuffer != null,
    playedCount: playedConfirmationOrderIds.size,
  };
}

function getOrCreateCustomerCheckoutAudioContext(): AudioContext | null {
  const Context = getAudioContextConstructor();
  if (!Context) {
    return null;
  }
  if (!audioContext || audioContext.state === "closed") {
    audioContext = new Context();
    audioContextCreatedCount += 1;
    keepAlive = null;
    decodedConfirmationBuffer = null;
    loadConfirmationBufferPromise = null;
  }
  return audioContext;
}

function getExistingCustomerCheckoutAudioContext(): AudioContext | null {
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

async function fetchAndDecodeConfirmationBuffer(
  ctx: AudioContext,
): Promise<AudioBuffer | null> {
  const fetchFn = getFetch();
  if (!fetchFn) {
    return null;
  }
  try {
    const response = await fetchFn(ORDER_CONFIRMATION_SOUND_SRC);
    if (!response.ok) {
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    decodedConfirmationBuffer = audioBuffer;
    return audioBuffer;
  } catch {
    return null;
  }
}

function loadConfirmationBuffer(
  ctx: AudioContext,
): Promise<AudioBuffer | null> {
  if (decodedConfirmationBuffer) {
    return Promise.resolve(decodedConfirmationBuffer);
  }
  if (!loadConfirmationBufferPromise) {
    loadConfirmationBufferPromise = fetchAndDecodeConfirmationBuffer(ctx).then(
      (buffer) => {
        if (!buffer) {
          loadConfirmationBufferPromise = null;
        }
        return buffer;
      },
    );
  }
  return loadConfirmationBufferPromise;
}

async function resolveCachedOrInFlightBuffer(): Promise<AudioBuffer | null> {
  if (decodedConfirmationBuffer) {
    return decodedConfirmationBuffer;
  }
  if (!loadConfirmationBufferPromise) {
    return null;
  }
  try {
    return await loadConfirmationBufferPromise;
  } catch {
    return null;
  }
}

function playDecodedBuffer(ctx: AudioContext, buffer: AudioBuffer): void {
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = buffer;
  source.connect(gain);
  gain.connect(ctx.destination);
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(ORDER_CONFIRMATION_PLAYBACK_GAIN, now);
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

export async function prepareOrderConfirmationSound(): Promise<void> {
  try {
    const ctx = getOrCreateCustomerCheckoutAudioContext();
    if (!ctx) {
      return;
    }
    void loadConfirmationBuffer(ctx);
    await resumeExistingContext(ctx);
  } catch {
    /* ornamental: checkout must continue */
  }
}

export async function playOrderConfirmationSound(
  orderId: string,
): Promise<OrderConfirmationSoundPlayResult> {
  if (!isValidUuid(orderId)) {
    return "skipped";
  }
  if (playedConfirmationOrderIds.has(orderId)) {
    return "skipped";
  }
  playedConfirmationOrderIds.add(orderId);
  try {
    const ctx = getExistingCustomerCheckoutAudioContext();
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
    playDecodedBuffer(running, buffer);
    return "played";
  } catch {
    return "failed";
  }
}
