import { expect, test } from "../fixtures";
import { E2E_VIEWPORTS } from "../lib/viewports";

test.describe("viewport foundation (non-destructive open only)", () => {
  for (const [name, size] of Object.entries(E2E_VIEWPORTS)) {
    test(`home opens at ${name} ${size.width}x${size.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(
        page.getByRole("heading", { name: /Todo lo de tu zona/i }),
      ).toBeVisible();
      expect(page.viewportSize()).toEqual(size);
    });
  }
});
