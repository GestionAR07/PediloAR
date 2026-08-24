import Link from "next/link";
import { redirect } from "next/navigation";
import { MerchantWorkspacePage } from "@/components/merchant/merchant-workspace-page";
import { isAuthzError } from "@/server/auth/errors";
import { requireMerchantMembership } from "@/server/auth/authorization";
import {
  listMerchantCategories,
  listProductsForMerchant,
} from "@/infrastructure/db/repositories/catalog-repository";
import { findMerchantDetailForMember } from "@/infrastructure/db/repositories/merchant-repository";
import { formatMoneyCentsArs } from "@/lib/format-money";
import { formatMerchantCategoryLabel } from "@/lib/format-category-label";
import { getMerchantProductAvailabilityStatus } from "@/lib/product-availability-presentation";
import { moneyCents } from "@/domain/money/money-cents";
import { createProductImageSignedUrls } from "@/infrastructure/storage/product-images";
import { toggleProductAvailabilityAction } from "./actions";
import { ProductAvailabilityToggle } from "./product-availability-toggle";
import { ProductImageThumbnail } from "./product-image-thumbnail";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ merchantId: string }>;
  searchParams: Promise<{
    q?: string;
    category?: string;
    available?: string;
  }>;
};

async function loadCatalogPage(merchantId: string) {
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
        redirect(`/login?next=/merchant/${merchantId}/catalog`);
      }
      redirect("/login?next=/merchant&error=forbidden");
    }
    throw error;
  }
}

export default async function CatalogPage({ params, searchParams }: PageProps) {
  const { merchantId } = await params;
  const filters = await searchParams;
  const { merchant } = await loadCatalogPage(merchantId);

  const categories = await listMerchantCategories(merchantId);
  const products = await listProductsForMerchant(merchantId, {
    search: filters.q,
    categoryId: filters.category,
    available:
      filters.available === "yes"
        ? true
        : filters.available === "no"
          ? false
          : undefined,
  });
  const signedUrls = await createProductImageSignedUrls(
    products
      .map((product) => product.imagePath)
      .filter((path): path is string => Boolean(path)),
  );

  return (
    <MerchantWorkspacePage
      merchantId={merchantId}
      merchantName={merchant.name}
      activeSection="catalog"
      title="Catálogo"
      description="Gestioná productos y disponibilidad operativa."
      action={
        <Link
          href={`/merchant/${merchantId}/catalog/products/new`}
          className="merchant-workspace-primary-btn"
        >
          + Nuevo producto
        </Link>
      }
    >
      <nav className="merchant-workspace-toolbar" aria-label="Catálogo">
        <Link
          href={`/merchant/${merchantId}/catalog`}
          className="merchant-workspace-toolbar-link merchant-workspace-toolbar-link--active"
          aria-current="page"
        >
          Productos
        </Link>
        <Link
          href={`/merchant/${merchantId}/catalog/categories`}
          className="merchant-workspace-toolbar-link"
        >
          Categorías
        </Link>
      </nav>

      <form
        method="get"
        className="merchant-workspace-card merchant-workspace-filters"
      >
        <label className="merchant-workspace-field">
          <span>Buscar</span>
          <input
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Empanada carne"
            className="merchant-workspace-input"
          />
        </label>
        <label className="merchant-workspace-field">
          <span>Categoría</span>
          <select
            name="category"
            defaultValue={filters.category ?? ""}
            className="merchant-workspace-input"
          >
            <option value="">Todas</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {formatMerchantCategoryLabel(category.name, category.active)}
              </option>
            ))}
          </select>
        </label>
        <label className="merchant-workspace-field">
          <span>Disponibilidad</span>
          <select
            name="available"
            defaultValue={filters.available ?? ""}
            className="merchant-workspace-input"
          >
            <option value="">Todas</option>
            <option value="yes">Disponible</option>
            <option value="no">Pausados (no disponibles)</option>
          </select>
        </label>
        <div className="merchant-workspace-filters-action">
          <button type="submit" className="merchant-workspace-secondary-btn">
            Filtrar
          </button>
        </div>
      </form>

      {products.length === 0 ? (
        <p className="merchant-workspace-empty">
          No hay productos con estos filtros.{" "}
          <Link
            href={`/merchant/${merchantId}/catalog/products/new`}
            className="merchant-workspace-inline-link"
          >
            Crear el primero
          </Link>
        </p>
      ) : (
        <ul className="merchant-workspace-product-grid">
          {products.map((product) => {
            const status = getMerchantProductAvailabilityStatus(product);

            return (
              <li key={product.id} className="merchant-workspace-product-card">
                <div className="merchant-workspace-product-body">
                  <ProductImageThumbnail
                    name={product.name}
                    imageUrl={
                      product.imagePath
                        ? (signedUrls.get(product.imagePath) ?? null)
                        : null
                    }
                  />
                  <div className="merchant-workspace-product-copy min-w-0">
                    <p className="merchant-workspace-product-name">
                      {product.name}
                    </p>
                    <p className="merchant-workspace-product-meta">
                      {formatMerchantCategoryLabel(
                        product.categoryName,
                        product.categoryActive,
                      )}
                    </p>
                    <p className="merchant-workspace-product-price">
                      {formatMoneyCentsArs(moneyCents(product.priceCents))}
                    </p>
                    <p className="merchant-workspace-product-status">
                      <span
                        className={
                          status.operationallyAvailable
                            ? "merchant-workspace-status-live"
                            : "merchant-workspace-status-muted"
                        }
                      >
                        {status.label}
                      </span>
                      {status.detail && (
                        <span className="merchant-workspace-status-muted">
                          {" "}
                          · {status.detail}
                        </span>
                      )}
                      {product.optionGroupCount > 0 && (
                        <span className="merchant-workspace-status-muted">
                          {" "}
                          · {product.optionGroupCount} grupo
                          {product.optionGroupCount === 1 ? "" : "s"} de
                          opciones
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="merchant-workspace-product-actions">
                  {product.active && (
                    <ProductAvailabilityToggle
                      merchantId={merchantId}
                      productId={product.id}
                      available={product.available}
                      action={toggleProductAvailabilityAction}
                    />
                  )}
                  <Link
                    href={`/merchant/${merchantId}/catalog/products/${product.id}`}
                    className="merchant-workspace-secondary-btn"
                  >
                    Editar
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </MerchantWorkspacePage>
  );
}
