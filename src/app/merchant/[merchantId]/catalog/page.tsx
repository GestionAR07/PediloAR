import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthzError } from "@/server/auth/errors";
import { requireMerchantMembership } from "@/server/auth/authorization";
import {
  listMerchantCategories,
  listProductsForMerchant,
} from "@/infrastructure/db/repositories/catalog-repository";
import { findMerchantDetailForMember } from "@/infrastructure/db/repositories/merchant-repository";
import { formatMoneyCentsArs } from "@/lib/format-money";
import { moneyCents } from "@/domain/money/money-cents";
import { toggleProductAvailabilityAction } from "./actions";
import { ProductAvailabilityToggle } from "./product-availability-toggle";

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

  return (
    <main className="flex flex-1 flex-col gap-6 border-t border-border pt-10">
      <header className="space-y-2">
        <p className="text-sm">
          <Link
            href={`/merchant/${merchantId}`}
            className="text-accent underline-offset-4 hover:underline"
          >
            ← {merchant.name}
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Catálogo</h1>
        <p className="text-sm text-muted">
          Gestioná productos y disponibilidad operativa.
        </p>
      </header>

      <nav className="flex flex-wrap gap-3 text-sm">
        <Link
          href={`/merchant/${merchantId}/catalog`}
          className="font-medium text-accent underline-offset-4 hover:underline"
        >
          Productos
        </Link>
        <Link
          href={`/merchant/${merchantId}/catalog/categories`}
          className="text-muted underline-offset-4 hover:underline"
        >
          Categorías
        </Link>
        <Link
          href={`/merchant/${merchantId}/catalog/products/new`}
          className="rounded-md border border-border px-3 py-2 hover:bg-white/40"
        >
          + Nuevo producto
        </Link>
      </nav>

      <form method="get" className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Buscar</span>
          <input
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Empanada carne"
            className="rounded-md border border-border bg-white px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Categoría</span>
          <select
            name="category"
            defaultValue={filters.category ?? ""}
            className="rounded-md border border-border bg-white px-3 py-2"
          >
            <option value="">Todas</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Disponibilidad</span>
          <select
            name="available"
            defaultValue={filters.available ?? ""}
            className="rounded-md border border-border bg-white px-3 py-2"
          >
            <option value="">Todas</option>
            <option value="yes">Disponible</option>
            <option value="no">Sin stock / no disponible</option>
          </select>
        </label>
        <div className="sm:col-span-3">
          <button
            type="submit"
            className="rounded-md border border-border px-3 py-2 text-sm"
          >
            Filtrar
          </button>
        </div>
      </form>

      {products.length === 0 ? (
        <p className="text-sm text-muted">
          No hay productos con estos filtros.{" "}
          <Link
            href={`/merchant/${merchantId}/catalog/products/new`}
            className="text-accent underline-offset-4 hover:underline"
          >
            Crear el primero
          </Link>
        </p>
      ) : (
        <ul className="space-y-3">
          {products.map((product) => {
            const trackedOut =
              product.stockMode === "TRACKED" &&
              (product.stockQuantity ?? 0) === 0;
            const statusLabel = !product.active
              ? "Inactivo"
              : product.available && !trackedOut
                ? "Disponible"
                : "Sin stock";

            return (
              <li
                key={product.id}
                className="rounded-lg border border-border bg-white/50 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-muted">
                      {product.categoryName} ·{" "}
                      {formatMoneyCentsArs(moneyCents(product.priceCents))}
                    </p>
                    <p className="text-sm">
                      <span
                        className={
                          statusLabel === "Disponible"
                            ? "text-accent"
                            : "text-muted"
                        }
                      >
                        {statusLabel}
                      </span>
                      {product.stockMode === "TRACKED" && (
                        <span className="text-muted">
                          {" "}
                          · Stock: {product.stockQuantity ?? 0}
                        </span>
                      )}
                      {product.optionGroupCount > 0 && (
                        <span className="text-muted">
                          {" "}
                          · {product.optionGroupCount} grupo
                          {product.optionGroupCount === 1 ? "" : "s"} de
                          opciones
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
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
                      className="rounded-md border border-border px-3 py-2 text-sm"
                    >
                      Editar
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
