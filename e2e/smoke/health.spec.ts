import { expect, test } from "../fixtures";
import {
  attachPageCrashGuard,
  expectNoNextCrashOverlay,
} from "../lib/no-page-crash";

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

    await expectNoNextCrashOverlay(page);
    expect(errors, `uncaught page errors: ${errors.join("; ")}`).toEqual([]);
  });
});
