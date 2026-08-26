import {
  clearCheckoutAttempt,
  clearCheckoutFormSessionDraft,
  clearCheckoutSuccess,
  clearFrozenCheckoutDraft,
  readCheckoutAttempt,
  readCheckoutFormSessionDraft,
  readCheckoutSuccess,
  readFrozenCheckoutDraft,
  writeCheckoutAttempt,
  writeCheckoutFormSessionDraft,
  writeCheckoutSuccess,
  writeFrozenCheckoutDraft,
  type CheckoutAttemptState,
  type CheckoutFormSessionDraft,
  type CheckoutSuccessState,
  type FrozenCheckoutDraft,
} from "./session";

const attemptListeners = new Set<() => void>();
const successListeners = new Set<() => void>();
const frozenListeners = new Set<() => void>();

let attemptMemory: CheckoutAttemptState | null | undefined;
let successMemory: CheckoutSuccessState | null | undefined;
let frozenMemory: FrozenCheckoutDraft | null | undefined;

function emit(listeners: Set<() => void>): void {
  for (const listener of listeners) {
    listener();
  }
}

function clientStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function getCheckoutFormSessionDraft(): CheckoutFormSessionDraft | null {
  return readCheckoutFormSessionDraft(clientStorage());
}

export function setCheckoutFormSessionDraft(
  next: CheckoutFormSessionDraft | null,
): void {
  const storage = clientStorage();
  if (next) {
    writeCheckoutFormSessionDraft(storage, next);
  } else {
    clearCheckoutFormSessionDraft(storage);
  }
}

export function subscribeCheckoutAttempt(listener: () => void): () => void {
  attemptListeners.add(listener);
  return () => {
    attemptListeners.delete(listener);
  };
}

export function getCheckoutAttemptSnapshot(): CheckoutAttemptState | null {
  const storage = clientStorage();
  if (attemptMemory === undefined) {
    attemptMemory = readCheckoutAttempt(storage);
  }
  return attemptMemory ?? null;
}

export function getServerCheckoutAttemptSnapshot(): CheckoutAttemptState | null {
  return null;
}

export function setCheckoutAttempt(next: CheckoutAttemptState | null): void {
  attemptMemory = next;
  const storage = clientStorage();
  if (next) {
    writeCheckoutAttempt(storage, next);
  } else {
    clearCheckoutAttempt(storage);
  }
  emit(attemptListeners);
}

export function subscribeCheckoutSuccess(listener: () => void): () => void {
  successListeners.add(listener);
  return () => {
    successListeners.delete(listener);
  };
}

export function getCheckoutSuccessSnapshot(): CheckoutSuccessState | null {
  const storage = clientStorage();
  if (successMemory === undefined) {
    successMemory = readCheckoutSuccess(storage);
  }
  return successMemory ?? null;
}

export function getServerCheckoutSuccessSnapshot(): CheckoutSuccessState | null {
  return null;
}

export function setCheckoutSuccess(next: CheckoutSuccessState | null): void {
  successMemory = next;
  const storage = clientStorage();
  if (next) {
    writeCheckoutSuccess(storage, next);
  } else {
    clearCheckoutSuccess(storage);
  }
  emit(successListeners);
}

export function subscribeFrozenCheckoutDraft(listener: () => void): () => void {
  frozenListeners.add(listener);
  return () => {
    frozenListeners.delete(listener);
  };
}

export function getFrozenCheckoutDraftSnapshot(): FrozenCheckoutDraft | null {
  const storage = clientStorage();
  if (frozenMemory === undefined) {
    frozenMemory = readFrozenCheckoutDraft(storage);
  }
  return frozenMemory ?? null;
}

export function getServerFrozenCheckoutDraftSnapshot(): FrozenCheckoutDraft | null {
  return null;
}

export function setFrozenCheckoutDraft(next: FrozenCheckoutDraft | null): void {
  frozenMemory = next;
  const storage = clientStorage();
  if (next) {
    writeFrozenCheckoutDraft(storage, next);
  } else {
    clearFrozenCheckoutDraft(storage);
  }
  emit(frozenListeners);
}

export function resetCheckoutSessionStoresForTests(): void {
  attemptMemory = undefined;
  successMemory = undefined;
  frozenMemory = undefined;
}
