import {
  test as base,
  expect,
  type Browser,
  type BrowserContext,
} from "@playwright/test";
import { assertSafeNavigatedUrl } from "./lib/assert-safe-e2e-target";

const navigationGuardErrors = new WeakMap<BrowserContext, Error>();

export function lastNavigationGuardError(
  context: BrowserContext,
): Error | undefined {
  return navigationGuardErrors.get(context);
}

async function installContextNavigationGuard(
  context: BrowserContext,
): Promise<void> {
  await context.route("**/*", async (route) => {
    const request = route.request();
    if (request.isNavigationRequest()) {
      try {
        assertSafeNavigatedUrl(request.url(), process.env);
      } catch (error) {
        const guardError =
          error instanceof Error ? error : new Error(String(error));
        navigationGuardErrors.set(context, guardError);
        await route.abort("blockedbyclient");
        return;
      }
    }
    await route.continue();
  });
}

/**
 * Secondary contexts created manually do not inherit Playwright's context
 * fixture. This helper keeps the same navigation guard in multi-user E2E flows.
 */
export async function createGuardedBrowserContext(input: {
  browser: Browser;
  baseURL: string;
}): Promise<BrowserContext> {
  const context = await input.browser.newContext({ baseURL: input.baseURL });
  await installContextNavigationGuard(context);
  return context;
}

/**
 * All browser specs must import `test` from this module so the
 * navigation guard is inherited automatically.
 */
export const test = base.extend({
  context: async ({ context }, provide) => {
    await installContextNavigationGuard(context);
    await provide(context);
  },
});

export { expect };
