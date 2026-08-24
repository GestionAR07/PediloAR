import Link from "next/link";
import { redirect } from "next/navigation";
import { MerchantWorkspacePage } from "@/components/merchant/merchant-workspace-page";
import { isAuthzError } from "@/server/auth/errors";
import { requireMerchantMembership } from "@/server/auth/authorization";
import { listActiveMerchantCategories } from "@/infrastructure/db/repositories/catalog-repository";
import { findMerchantDetailForMember } from "@/infrastructure/db/repositories/merchant-repository";
import { createProductAction } from "../../actions";
import { ProductFormSubmitButton } from "../../product-form-submit-button";
import { ProductStockControl } from "../../product-stock-control";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ merchantId: string }>;
};

async function loadPage(merchantId: string) {
  try {
    const context = await requireMerchantMembership(merchantId);
    const merchant = await findMerchantDetailForMember(
      merchantId,
      context.user.id,
    );
    if (!merchant) {
      redirect("/login?next=/merchant&error=forbidden");
    }
    return { ...context, merchant };
  } catch (error) {
    if (isAuthzError(error)) {
      if (error.code === "UNAUTHENTICATED" || error.code === "CONFIG_MISSING") {
        redirect(`/login?next=/merchant/${merchantId}/catalog/products/new`);
      }
      redirect("/login?next=/merchant&error=forbidden");
    }
    throw error;
  }
}

export default async function NewProductPage({ params }: PageProps) {
  const { merchantId } = await params;
  const { merchant } = await loadPage(merchantId);
  const categories = await listActiveMerchantCategories(merchantId);

  if (categories.length === 0) {
    return (
      <MerchantWorkspacePage
        merchantId={merchantId}
        merchantName={merchant.name}
        activeSection="catalog"
        title="Nuevo producto"
        description="Agregá un producto al catálogo de tu comercio."
      >
        <p className="merchant-workspace-empty">
          No hay categorías activas. Reactivá una categoría o creá una nueva
          antes de agregar productos.{" "}
          <Link
            href={`/merchant/${merchantId}/catalog/categories`}
            className="merchant-workspace-inline-link"
          >
            Ir a categorías
          </Link>
        </p>
      </MerchantWorkspacePage>
    );
  }

  const boundCreate = createProductAction.bind(null, merchantId);

  return (
    <MerchantWorkspacePage
      merchantId={merchantId}
      merchantName={merchant.name}
      activeSection="catalog"
      title="Nuevo producto"
      description="Agregá un producto al catálogo de tu comercio."
      action={
        <Link
          href={`/merchant/${merchantId}/catalog`}
          className="merchant-workspace-secondary-btn"
        >
          ← Catálogo
        </Link>
      }
    >
      <form
        action={boundCreate}
        className="merchant-workspace-card merchant-workspace-product-form"
      >
        <h2 className="merchant-workspace-card-title">
          Información del producto
        </h2>

        <div className="merchant-workspace-product-grid">
          <label className="merchant-workspace-field">
            <span>Nombre</span>
            <input name="name" required className="merchant-workspace-input" />
          </label>

          <label className="merchant-workspace-field">
            <span>Categoría</span>
            <select
              name="merchantCategoryId"
              required
              className="merchant-workspace-input"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="merchant-workspace-field">
            <span>Precio (ARS)</span>
            <input
              name="priceInput"
              required
              placeholder="2500 o 2500,50"
              className="merchant-workspace-input"
            />
          </label>

          <ProductStockControl />
        </div>

        <label className="merchant-workspace-field merchant-workspace-field--full">
          <span>Descripción</span>
          <textarea
            name="description"
            rows={3}
            className="merchant-workspace-input merchant-workspace-textarea"
          />
        </label>

        <div className="merchant-workspace-commerce-states">
          <p className="merchant-workspace-commerce-states-title">
            Estados comerciales
          </p>
          <label className="merchant-workspace-check-row">
            <input
              type="checkbox"
              name="active"
              defaultChecked
              className="merchant-workspace-checkbox"
            />
            <span className="merchant-workspace-check-copy">
              <span className="merchant-workspace-check-title">
                Mostrar en la tienda
              </span>
              <span className="merchant-workspace-check-help">
                Visible para tus clientes.
              </span>
            </span>
          </label>
          <label className="merchant-workspace-check-row">
            <input
              type="checkbox"
              name="available"
              value="on"
              defaultChecked
              className="merchant-workspace-checkbox"
            />
            <span className="merchant-workspace-check-copy">
              <span className="merchant-workspace-check-title">
                Disponible para pedir
              </span>
              <span className="merchant-workspace-check-help">
                Podés pausarlo temporalmente sin eliminarlo.
              </span>
            </span>
          </label>
          <input type="hidden" name="available" value="off" />
        </div>

        <ProductFormSubmitButton mode="create" />
      </form>
    </MerchantWorkspacePage>
  );
}
