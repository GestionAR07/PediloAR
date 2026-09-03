import type { BrowserContext, Page } from "@playwright/test";
import { createGuardedBrowserContext, expect, test } from "../fixtures";
import { createDevOnboardingFixture } from "../lib/dev-onboarding-fixture";
import { E2E_WRITE_DEV_MODE } from "../lib/dev-write-guard";

type GeographyRow = {
  city_id: string;
  city_name: string;
  zone_id: string;
  zone_name: string;
};

type ApplicationRow = {
  id: string;
  status: string;
  city_id: string;
  zone_id: string;
  merchant_id: string | null;
  reviewed_by_user_id: string | null;
};

type MerchantRow = {
  id: string;
  slug: string;
  status: string;
};

type MembershipRow = {
  id: string;
  user_id: string;
  role: string;
  active: boolean;
};

type CategoryRow = {
  id: string;
  active: boolean;
};

type ProductRow = {
  id: string;
  active: boolean;
  available: boolean;
  stock_mode: string;
  stock_quantity: number | null;
};

async function login(
  page: Page,
  input: { email: string; password: string; next: string },
): Promise<void> {
  await page.goto(`/login?next=${encodeURIComponent(input.next)}`);
  await page.getByLabel("Email").fill(input.email);
  await page.getByLabel("Contraseña").fill(input.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(new RegExp(`${input.next}(?:\\?.*)?$`));
}

test.describe("WRITE_DEV merchant onboarding activation", () => {
  test("public application becomes an owner-operated ACTIVE merchant visible in Pedilo", async ({
    browser,
    page,
    baseURL,
  }) => {
    test.setTimeout(150_000);
    expect(process.env.E2E_MODE).toBe(E2E_WRITE_DEV_MODE);
    if (!baseURL) {
      throw new Error("Merchant onboarding E2E: Playwright baseURL is required.");
    }

    const fixture = await createDevOnboardingFixture();
    let ownerContext: BrowserContext | null = null;

    try {
      const geography = await fixture.sql<GeographyRow[]>`
        select
          c.id as city_id,
          c.name as city_name,
          z.id as zone_id,
          z.name as zone_name
        from zones z
        join cities c on c.id = z.city_id
        order by c.name, z.name, z.id
        limit 1
      `;
      expect(
        geography,
        "DEV onboarding requires at least one city with one zone.",
      ).toHaveLength(1);
      const geo = geography[0]!;

      await page.goto("/sumar-comercio");
      await page.getByLabel("Nombre del comercio").fill(fixture.businessName);
      await page.getByLabel("Nombre de contacto").fill(fixture.owner.displayName);
      await page.getByLabel("Email de contacto").fill(fixture.owner.email);
      await page.getByLabel("Teléfono de contacto").fill("2804000000");
      await page.getByLabel("Ciudad").selectOption(geo.city_id);
      await page.getByLabel("Zona").selectOption(geo.zone_id);
      await page
        .getByLabel("Descripción del comercio (opcional)")
        .fill(`${fixture.marker} Comercio preparado para onboarding E2E.`);
      await page
        .getByLabel("Mensaje (opcional)")
        .fill(`${fixture.marker} Validación integral de alta.`);
      await page.getByRole("button", { name: "Enviar solicitud" }).click();
      await expect(
        page.getByRole("heading", { name: "Solicitud enviada" }),
      ).toBeVisible();

      const applications = await fixture.sql<ApplicationRow[]>`
        select
          id,
          status,
          city_id,
          zone_id,
          merchant_id,
          reviewed_by_user_id
        from merchant_applications
        where business_name = ${fixture.businessName}
          and contact_email = ${fixture.owner.email}
      `;
      expect(applications).toHaveLength(1);
      const application = applications[0]!;
      fixture.registerApplication(application.id);
      expect(application.status).toBe("PENDING");
      expect(application.city_id).toBe(geo.city_id);
      expect(application.zone_id).toBe(geo.zone_id);
      expect(application.merchant_id).toBeNull();
      expect(application.reviewed_by_user_id).toBeNull();

      const applicationPath = `/admin/merchant-applications/${application.id}`;
      await login(page, {
        email: fixture.admin.email,
        password: fixture.admin.password,
        next: applicationPath,
      });
      await expect(
        page.getByRole("heading", { name: fixture.businessName }),
      ).toBeVisible();
      await expect(page.getByText("Pendiente", { exact: true })).toBeVisible();

      await page.getByLabel("Slug").fill(fixture.businessSlug);
      await page.getByLabel("Retiro habilitado").check();
      await page.getByLabel("Delivery propio habilitado").uncheck();
      await page
        .getByRole("button", { name: "Aprobar solicitud" })
        .click();
      await expect(page).toHaveURL(/\/admin\/merchants\/[0-9a-f-]{36}$/i);

      const merchantId = page.url().match(/\/admin\/merchants\/([0-9a-f-]{36})$/i)?.[1];
      expect(merchantId, "approval must navigate to the exact merchant id").toBeTruthy();
      fixture.registerMerchant(merchantId!);

      const [approved] = await fixture.sql<ApplicationRow[]>`
        select
          id,
          status,
          city_id,
          zone_id,
          merchant_id,
          reviewed_by_user_id
        from merchant_applications
        where id = ${application.id}
      `;
      expect(approved?.status).toBe("APPROVED");
      expect(approved?.merchant_id).toBe(merchantId);
      expect(approved?.reviewed_by_user_id).toBe(fixture.admin.userId);

      const [draftMerchant] = await fixture.sql<MerchantRow[]>`
        select id, slug, status
        from merchants
        where id = ${merchantId!}
      `;
      expect(draftMerchant?.slug).toBe(fixture.businessSlug);
      expect(draftMerchant?.status).toBe("DRAFT");

      const beforeActivation = await page.goto(`/comercios/${merchantId!}`);
      expect(beforeActivation?.status()).toBe(404);
      await page.goto(`/admin/merchants/${merchantId!}`);
      await expect(
        page.getByRole("button", { name: "Activar comercio" }),
      ).toBeDisabled();

      await page.getByLabel("Email del propietario").fill(fixture.owner.email);
      await page
        .getByLabel("Nombre para mostrar (opcional)")
        .fill(fixture.owner.displayName);
      await page.getByRole("button", { name: "Invitar propietario" }).click();
      await expect(page.getByRole("status")).toContainText(
        "Usuario existente asignado como propietario.",
      );

      const memberships = await fixture.sql<MembershipRow[]>`
        select id, user_id, role, active
        from merchant_users
        where merchant_id = ${merchantId!}
          and user_id = ${fixture.owner.userId}
      `;
      expect(memberships).toHaveLength(1);
      expect(memberships[0]?.role).toBe("OWNER");
      expect(memberships[0]?.active).toBe(true);

      ownerContext = await createGuardedBrowserContext({ browser, baseURL });
      const ownerPage = await ownerContext.newPage();
      const paymentPath = `/merchant/${merchantId!}/payment-methods`;
      await login(ownerPage, {
        email: fixture.owner.email,
        password: fixture.owner.password,
        next: paymentPath,
      });
      await expect(
        ownerPage.getByRole("heading", { name: "Medios de pago" }),
      ).toBeVisible();

      const cash = ownerPage.locator('input[name="active_CASH"]');
      await expect(cash).toBeVisible();
      await cash.check();
      await ownerPage
        .locator('textarea[name="instructions_CASH"]')
        .fill("Pagás al retirar tu pedido.");
      await ownerPage.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(ownerPage.getByRole("status")).toContainText(
        "Medios de pago actualizados.",
      );

      await ownerPage.goto(`/merchant/${merchantId!}/catalog/categories`);
      await ownerPage.getByPlaceholder("Empanadas").fill(fixture.categoryName);
      await ownerPage.getByRole("button", { name: "Crear" }).click();

      await expect
        .poll(async () => {
          const rows = await fixture.sql<CategoryRow[]>`
            select id, active
            from merchant_categories
            where merchant_id = ${merchantId!}
              and name = ${fixture.categoryName}
          `;
          return rows;
        })
        .toHaveLength(1);
      const [category] = await fixture.sql<CategoryRow[]>`
        select id, active
        from merchant_categories
        where merchant_id = ${merchantId!}
          and name = ${fixture.categoryName}
      `;
      expect(category?.active).toBe(true);

      await ownerPage.goto(`/merchant/${merchantId!}/catalog/products/new`);
      await ownerPage.getByLabel("Nombre").fill(fixture.productName);
      await ownerPage.getByLabel("Categoría").selectOption(category!.id);
      await ownerPage.getByLabel("Precio (ARS)").fill("2500");
      await ownerPage.getByRole("button", { name: "Crear producto" }).click();
      await expect(ownerPage).toHaveURL(
        new RegExp(
          `/merchant/${merchantId!}/catalog/products/[0-9a-f-]{36}(?:\\?.*)?$`,
          "i",
        ),
      );

      const products = await fixture.sql<ProductRow[]>`
        select id, active, available, stock_mode, stock_quantity
        from products
        where merchant_id = ${merchantId!}
          and name = ${fixture.productName}
      `;
      expect(products).toHaveLength(1);
      const product = products[0]!;
      fixture.registerProduct(product.id);
      expect(product.active).toBe(true);
      expect(product.available).toBe(true);
      expect(product.stock_mode).toBe("NOT_TRACKED");

      await page.goto(`/admin/merchants/${merchantId!}`);
      const readiness = page.getByRole("list", {
        name: "Requisitos de activación",
      });
      await expect(readiness).toContainText("✓ Propietario activo");
      await expect(readiness).toContainText(
        "✓ Retiro o delivery propio habilitado",
      );
      await expect(readiness).toContainText("✓ Medio de pago activo");
      await expect(readiness).toContainText(
        "✓ Producto publicado y disponible",
      );

      const activate = page.getByRole("button", { name: "Activar comercio" });
      await expect(activate).toBeEnabled();
      await activate.click();
      await expect
        .poll(async () => {
          const [merchant] = await fixture.sql<{ status: string }[]>`
            select status from merchants where id = ${merchantId!}
          `;
          return merchant?.status ?? null;
        })
        .toBe("ACTIVE");
      await expect(page.getByRole("status")).toContainText(
        /Comercio activado|Comercio activo/,
      );

      await ownerPage.goto(`/comercios/${merchantId!}`);
      await expect(
        ownerPage.getByRole("heading", { name: fixture.businessName }),
      ).toBeVisible();
      await expect(ownerPage.getByText(fixture.productName)).toBeVisible();
      await expect(ownerPage.getByText("Efectivo", { exact: true })).toBeVisible();
    } finally {
      await ownerContext?.close();
      await fixture.cleanup();
    }
  });
});
