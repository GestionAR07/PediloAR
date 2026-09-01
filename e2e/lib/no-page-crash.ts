import { expect, type Page } from "@playwright/test";

/**
 * Collects uncaught page errors from Chromium. Attach before navigation.
 */
export function attachPageCrashGuard(page: Page): { errors: string[] } {
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  page.on("crash", () => {
    errors.push("Chromium page crashed");
  });
  return { errors };
}

export async function expectNoNextCrashOverlay(page: Page): Promise<void> {
  // nextjs-portal is always present in `next dev` (Dev Tools), not a crash.
  await expect(
    page.locator("[data-nextjs-dialog-overlay], [data-nextjs-dialog]"),
  ).toHaveCount(0);
  await expect(page.getByText(/Application error/i)).toHaveCount(0);
}
