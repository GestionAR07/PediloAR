import { expect, test } from "../fixtures";
import { attachPageCrashGuard } from "../lib/no-page-crash";

test.describe("C — basic public navigation (no writes)", () => {
  test("home → login → registro", async ({ page }) => {
    const { errors } = attachPageCrashGuard(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await page
      .getByRole("link", { name: "Ingresar" })
      .filter({ visible: true })
      .click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: "Ingresá a Pedilo" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Crear cuenta" }).click();
    await expect(page).toHaveURL(/\/registro/);
    await expect(
      page.getByRole("heading", { name: "Creá tu cuenta" }),
    ).toBeVisible();

    expect(errors).toEqual([]);
  });

  test("home → cart → back to home", async ({ page }) => {
    const { errors } = attachPageCrashGuard(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await page.getByRole("link", { name: "Carrito" }).click();
    await expect(page).toHaveURL(/\/carrito$/);
    await expect(
      page.getByRole("heading", { name: "Tu carrito está vacío" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Ver comercios" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("heading", { name: /Todo lo de tu zona/i }),
    ).toBeVisible();

    expect(errors).toEqual([]);
  });
});
