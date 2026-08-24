import Link from "next/link";
import { redirect } from "next/navigation";
import { MerchantWorkspacePage } from "@/components/merchant/merchant-workspace-page";
import { isAuthzError } from "@/server/auth/errors";
import { requireMerchantMembership } from "@/server/auth/authorization";
import { listMerchantCategories } from "@/infrastructure/db/repositories/catalog-repository";
import { findMerchantDetailForMember } from "@/infrastructure/db/repositories/merchant-repository";
import {
  createCategoryAction,
  deleteCategoryAction,
  reorderCategoryAction,
  updateCategoryAction,
} from "../actions";

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
        redirect(`/login?next=/merchant/${merchantId}/catalog/categories`);
      }
      redirect("/login?next=/merchant&error=forbidden");
    }
    throw error;
  }
}

export default async function CategoriesPage({ params }: PageProps) {
  const { merchantId } = await params;
  const { merchant } = await loadPage(merchantId);
  const categories = await listMerchantCategories(merchantId);

  const boundCreate = createCategoryAction.bind(null, merchantId);

  return (
    <MerchantWorkspacePage
      merchantId={merchantId}
      merchantName={merchant.name}
      activeSection="catalog"
      title="Categorías"
      description="Organizá los productos que aparecen en tu tienda."
    >
      <nav className="merchant-workspace-toolbar" aria-label="Catálogo">
        <Link
          href={`/merchant/${merchantId}/catalog`}
          className="merchant-workspace-toolbar-link"
        >
          Productos
        </Link>
        <Link
          href={`/merchant/${merchantId}/catalog/categories`}
          className="merchant-workspace-toolbar-link merchant-workspace-toolbar-link--active"
          aria-current="page"
        >
          Categorías
        </Link>
      </nav>

      <section className="merchant-workspace-card merchant-workspace-form-panel">
        <h2 className="merchant-workspace-card-title mb-3">Nueva categoría</h2>
        <form
          action={boundCreate}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <label className="merchant-workspace-field min-w-0 flex-1">
            <span className="sr-only">Nombre</span>
            <input
              name="name"
              required
              placeholder="Empanadas"
              className="merchant-workspace-input"
            />
          </label>
          <button type="submit" className="merchant-workspace-primary-btn">
            Crear
          </button>
        </form>
      </section>

      {categories.length === 0 ? (
        <p className="merchant-workspace-empty">Todavía no hay categorías.</p>
      ) : (
        <ul className="merchant-workspace-category-list">
          {categories.map((category, index) => {
            const boundUpdate = updateCategoryAction.bind(
              null,
              merchantId,
              category.id,
            );
            const boundDelete = deleteCategoryAction.bind(
              null,
              merchantId,
              category.id,
            );
            const boundUp = reorderCategoryAction.bind(
              null,
              merchantId,
              category.id,
              "up",
            );
            const boundDown = reorderCategoryAction.bind(
              null,
              merchantId,
              category.id,
              "down",
            );

            return (
              <li
                key={category.id}
                className="merchant-workspace-card merchant-workspace-category-card"
              >
                <form action={boundUpdate} className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <input
                      name="name"
                      defaultValue={category.name}
                      required
                      className="merchant-workspace-input min-w-0 flex-1"
                    />
                    <label className="merchant-workspace-active-pill">
                      <input
                        type="checkbox"
                        name="active"
                        defaultChecked={category.active}
                        className="merchant-workspace-checkbox"
                      />
                      Activa
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      className="merchant-workspace-secondary-btn"
                    >
                      Guardar
                    </button>
                    <button
                      formAction={boundUp}
                      type="submit"
                      disabled={index === 0}
                      className="merchant-workspace-secondary-btn disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      formAction={boundDown}
                      type="submit"
                      disabled={index === categories.length - 1}
                      className="merchant-workspace-secondary-btn disabled:opacity-40"
                    >
                      ↓
                    </button>
                    <button
                      formAction={boundDelete}
                      type="submit"
                      className="merchant-workspace-danger-btn"
                    >
                      Eliminar
                    </button>
                  </div>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </MerchantWorkspacePage>
  );
}
