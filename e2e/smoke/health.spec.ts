import { expect, test } from "@playwright/test";
import {
  attachPageCrashGuard,
  expectNoNextCrashOverlay,
  expectSafeLocalUrl,
} from "../lib/no-page-crash";

const allowRemote = process.env.E2E_ALLOW_REMOTE_DEV === "I_ACCEPT_REMOTE_DEV";

test.describe("A/D — app starts without crashing", () => {
  test("home responds 200 and Chromium does not crash", async ({ page }) => {
    const { errors } = attachPageCrashGuard(page);

    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response, "home must return a response").not.toBeNull();
    expect(response!.status(), "home must not be a server error").toBeLessThan(
      500,
    );
    expect(response!.ok(), "home should be an OK response").toBeTruthy();

    await expect(
      page.getByRole("heading", { name: /Todo lo de tu zona/i }),
    ).toBeVisible();

    await expectSafeLocalUrl(page, allowRemote);
    await expectNoNextCrashOverlay(page);
    expect(errors, `uncaught page errors: ${errors.join("; ")}`).toEqual([]);
  });
});
