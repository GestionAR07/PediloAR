import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthzError } from "@/server/auth/errors";
import { requireMerchantMembership } from "@/server/auth/authorization";
import { listActiveMerchantCategories } from "@/infrastructure/db/repositories/catalog-repository";
import { findMerchantDetailForMember } from "@/infrastructure/db/repositories/merchant-repository";
import { createProductAction } from "../../actions";

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
      <main className="flex flex-1 flex-col gap-6 border-t border-border pt-10">
        <p className="text-sm text-muted">
          No hay categorías activas. Reactivá una categoría o creá una nueva
          antes de agregar productos.{" "}
          <Link
            href={`/merchant/${merchantId}/catalog/categories`}
            className="text-accent underline-offset-4 hover:underline"
          >
            Ir a categorías
          </Link>
        </p>
      </main>
    );
  }

  const boundCreate = createProductAction.bind(null, merchantId);

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
        <h1 className="text-2xl font-semibold tracking-tight">
          Nuevo producto
        </h1>
        <p className="text-sm text-muted">{merchant.name}</p>
      </header>

      <form action={boundCreate} className="grid max-w-xl gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span>Nombre</span>
          <input
            name="name"
            required
            className="rounded-md border border-border bg-white px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span>Categoría</span>
          <select
            name="merchantCategoryId"
            required
            className="rounded-md border border-border bg-white px-3 py-2"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span>Precio (ARS)</span>
          <input
            name="priceInput"
            required
            placeholder="2500 o 2500,50"
            className="rounded-md border border-border bg-white px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span>Descripción</span>
          <textarea
            name="description"
            rows={3}
            className="rounded-md border border-border bg-white px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span>Stock</span>
          <select
            name="stockMode"
            defaultValue="NOT_TRACKED"
            className="rounded-md border border-border bg-white px-3 py-2"
          >
            <option value="NOT_TRACKED">Sin seguimiento</option>
            <option value="TRACKED">Con cantidad</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span>Cantidad (si aplica)</span>
          <input
            name="stockQuantity"
            type="number"
            min={0}
            step={1}
            placeholder="10"
            className="rounded-md border border-border bg-white px-3 py-2"
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked />
          Activo en catálogo
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input type="hidden" name="available" value="on" />
          Disponible para venta (por defecto sí)
        </label>

        <button
          type="submit"
          className="w-fit rounded-md border border-border px-4 py-2 text-sm"
        >
          Crear producto
        </button>
      </form>
    </main>
  );
}
