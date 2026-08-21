/**
 * Body scroll lock with scrollbar-gap compensation.
 * Prevents the horizontal layout shift when overflow:hidden removes the
 * vertical scrollbar on desktop.
 */

export type BodyScrollLockSnapshot = {
  overflow: string;
  paddingRight: string;
};

export function measureScrollbarWidth(): number {
  return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
}

/**
 * Locks document.body scroll. Returns a snapshot to restore later.
 * Compensates padding-right only when a scrollbar was actually present.
 */
export function lockBodyScroll(): BodyScrollLockSnapshot {
  const body = document.body;
  const snapshot: BodyScrollLockSnapshot = {
    overflow: body.style.overflow,
    paddingRight: body.style.paddingRight,
  };

  const scrollbarWidth = measureScrollbarWidth();
  body.style.overflow = "hidden";
  if (scrollbarWidth > 0) {
    const currentPadding = Number.parseFloat(
      window.getComputedStyle(body).paddingRight || "0",
    );
    body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
  }

  return snapshot;
}

export function unlockBodyScroll(snapshot: BodyScrollLockSnapshot): void {
  const body = document.body;
  body.style.overflow = snapshot.overflow;
  body.style.paddingRight = snapshot.paddingRight;
}
