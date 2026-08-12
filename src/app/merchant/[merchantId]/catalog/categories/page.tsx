import Link from "next/link";
import { redirect } from "next/navigation";
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
    <main className="flex flex-1 flex-col gap-6 border-t border-border pt-10">
      <header className="space-y-2">
        <p className="text-sm">
          <Link
            href={`/merchant/${merchantId}/catalog`}
            className="text-accent underline-offset-4 hover:underline"
          >
            ← Catálogo
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Categorías</h1>
        <p className="text-sm text-muted">{merchant.name}</p>
      </header>

      <section className="rounded-lg border border-border bg-white/50 p-4">
        <h2 className="mb-3 text-sm font-medium">Nueva categoría</h2>
        <form action={boundCreate} className="flex flex-col gap-3 sm:flex-row">
          <input
            name="name"
            required
            placeholder="Empanadas"
            className="flex-1 rounded-md border border-border bg-white px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md border border-border px-3 py-2 text-sm"
          >
            Crear
          </button>
        </form>
      </section>

      {categories.length === 0 ? (
        <p className="text-sm text-muted">Todavía no hay categorías.</p>
      ) : (
        <ul className="space-y-3">
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
                className="rounded-lg border border-border bg-white/50 p-4"
              >
                <form action={boundUpdate} className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <input
                      name="name"
                      defaultValue={category.name}
                      required
                      className="flex-1 rounded-md border border-border bg-white px-3 py-2 text-sm"
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="active"
                        defaultChecked={category.active}
                      />
                      Activa
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      className="rounded-md border border-border px-3 py-2 text-sm"
                    >
                      Guardar
                    </button>
                    <button
                      formAction={boundUp}
                      type="submit"
                      disabled={index === 0}
                      className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      formAction={boundDown}
                      type="submit"
                      disabled={index === categories.length - 1}
                      className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-40"
                    >
                      ↓
                    </button>
                    <button
                      formAction={boundDelete}
                      type="submit"
                      className="rounded-md border border-border px-3 py-2 text-sm text-red-800"
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
    </main>
  );
}
