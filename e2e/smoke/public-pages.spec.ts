import { expect, test } from "../fixtures";
import {
  attachPageCrashGuard,
  expectNoNextCrashOverlay,
} from "../lib/no-page-crash";

test.describe("B — deterministic public routes (GET only, no mutations)", () => {
  test("public home renders Pedilo storefront chrome", async ({ page }) => {
    const { errors } = attachPageCrashGuard(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: /Todo lo de tu zona/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Pedí cerca, sin vueltas." }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "¿Dónde querés comprar?" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Ver comercios" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Carrito" })).toBeVisible();

    await expectNoNextCrashOverlay(page);
    expect(errors).toEqual([]);
  });

  test("login page renders without submitting credentials", async ({
    page,
  }) => {
    const { errors } = attachPageCrashGuard(page);
    await page.goto("/login", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: "Ingresá a Pedilo" }),
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Contraseña")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ingresar" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Olvidé mi contraseña" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Crear cuenta" }),
    ).toBeVisible();

    await expectNoNextCrashOverlay(page);
    expect(errors).toEqual([]);
  });

  test("password recovery page renders without sending email", async ({
    page,
  }) => {
    const { errors } = attachPageCrashGuard(page);
    await page.goto("/forgot-password", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: "Recuperá tu contraseña" }),
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Enviar enlace" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Volver a ingresar" }),
    ).toBeVisible();

    await expectNoNextCrashOverlay(page);
    expect(errors).toEqual([]);
  });

  test("empty cart page renders from local state only", async ({ page }) => {
    const { errors } = attachPageCrashGuard(page);
    await page.goto("/carrito", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: "Tu carrito está vacío" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Ver comercios" }),
    ).toBeVisible();

    await expectNoNextCrashOverlay(page);
    expect(errors).toEqual([]);
  });
});
