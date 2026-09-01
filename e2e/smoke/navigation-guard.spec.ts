import { expect, lastNavigationGuardError, test } from "../fixtures";
import { attachPageCrashGuard } from "../lib/no-page-crash";

test.describe("centralized navigation guard (browser)", () => {
  test("allows valid loopback navigation", async ({ page }) => {
    const { errors } = attachPageCrashGuard(page);
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response?.ok()).toBeTruthy();
    expect(new URL(page.url()).hostname).toBe("127.0.0.1");
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    expect(page.url()).toMatch(/\/login$/);
    expect(new URL(page.url()).hostname).toBe("127.0.0.1");
    expect(lastNavigationGuardError(page.context())).toBeUndefined();
    expect(errors).toEqual([]);
  });

  test("fails immediately on redirect/navigation to a forbidden host", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(
      page.goto("https://pedilo.store/", { waitUntil: "domcontentloaded" }),
    ).rejects.toThrow();

    const guardError = lastNavigationGuardError(page.context());
    expect(guardError?.message).toMatch(/pedilo\.store/);
    expect(new URL(page.url()).hostname).not.toBe("pedilo.store");
    expect(page.url().includes("pedilo.store")).toBe(false);
  });
});
