import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthzError } from "@/server/auth/errors";
import { requireMerchantMembership } from "@/server/auth/authorization";
import {
  findProductById,
  listMerchantCategories,
  listOptionChoicesForGroups,
  listOptionGroupsForProduct,
} from "@/infrastructure/db/repositories/catalog-repository";
import { findMerchantDetailForMember } from "@/infrastructure/db/repositories/merchant-repository";
import { formatMerchantCategoryLabel } from "@/lib/format-category-label";
import { formatMoneyCentsArs } from "@/lib/format-money";
import { moneyCents } from "@/domain/money/money-cents";
import {
  createOptionChoiceAction,
  createOptionGroupAction,
  updateOptionChoiceAction,
  updateOptionGroupAction,
  updateProductAction,
} from "../../actions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ merchantId: string; productId: string }>;
};

async function loadPage(merchantId: string, productId: string) {
  try {
    const context = await requireMerchantMembership(merchantId);
    const merchant = await findMerchantDetailForMember(
      merchantId,
      context.user.id,
    );
    if (!merchant) {
      redirect("/login?next=/merchant&error=forbidden");
    }

    const product = await findProductById(merchantId, productId);
    if (!product) {
      redirect(`/merchant/${merchantId}/catalog`);
    }

    return { ...context, merchant, product };
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

export default async function EditProductPage({ params }: PageProps) {
  const { merchantId, productId } = await params;
  const { merchant, product } = await loadPage(merchantId, productId);
  const categories = await listMerchantCategories(merchantId);
  const selectableCategories = categories.filter(
    (category) => category.active || category.id === product.merchantCategoryId,
  );
  const groups = await listOptionGroupsForProduct(merchantId, productId);
  const choices = await listOptionChoicesForGroups(groups.map((g) => g.id));
  const choicesByGroup = new Map<string, typeof choices>();
  for (const choice of choices) {
    const list = choicesByGroup.get(choice.groupId) ?? [];
    list.push(choice);
    choicesByGroup.set(choice.groupId, list);
  }

  const boundUpdate = updateProductAction.bind(null, merchantId, productId);
  const boundCreateGroup = createOptionGroupAction.bind(
    null,
    merchantId,
    productId,
  );

  return (
    <main className="flex flex-1 flex-col gap-8 border-t border-border pt-10">
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
          {product.name}
        </h1>
        <p className="text-sm text-muted">{merchant.name}</p>
      </header>

      <section className="grid max-w-xl gap-4">
        <h2 className="text-sm font-medium">Datos del producto</h2>
        <form action={boundUpdate} className="grid gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span>Nombre</span>
            <input
              name="name"
              defaultValue={product.name}
              required
              className="rounded-md border border-border bg-white px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span>Categoría</span>
            <select
              name="merchantCategoryId"
              defaultValue={product.merchantCategoryId}
              className="rounded-md border border-border bg-white px-3 py-2"
            >
              {selectableCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {formatMerchantCategoryLabel(category.name, category.active)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span>Precio (ARS)</span>
            <input
              name="priceInput"
              defaultValue={formatMoneyCentsArs(
                moneyCents(product.priceCents),
              ).replace("$", "")}
              required
              className="rounded-md border border-border bg-white px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span>Descripción</span>
            <textarea
              name="description"
              rows={3}
              defaultValue={product.description}
              className="rounded-md border border-border bg-white px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span>Stock</span>
            <select
              name="stockMode"
              defaultValue={product.stockMode}
              className="rounded-md border border-border bg-white px-3 py-2"
            >
              <option value="NOT_TRACKED">Sin seguimiento</option>
              <option value="TRACKED">Con cantidad</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span>Cantidad</span>
            <input
              name="stockQuantity"
              type="number"
              min={0}
              step={1}
              defaultValue={product.stockQuantity ?? ""}
              className="rounded-md border border-border bg-white px-3 py-2"
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="active"
              defaultChecked={product.active}
            />
            Activo en catálogo
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="available"
              defaultChecked={product.available}
            />
            Disponible para venta
          </label>

          <button
            type="submit"
            className="w-fit rounded-md border border-border px-4 py-2 text-sm"
          >
            Guardar producto
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium">Grupos de opciones</h2>

        {groups.map((group) => {
          const groupChoices = choicesByGroup.get(group.id) ?? [];
          const boundUpdateGroup = updateOptionGroupAction.bind(
            null,
            merchantId,
            group.id,
          );

          return (
            <div
              key={group.id}
              className="rounded-lg border border-border bg-white/50 p-4"
            >
              <form action={boundUpdateGroup} className="mb-4 grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    name="name"
                    defaultValue={group.name}
                    className="rounded-md border border-border bg-white px-3 py-2 text-sm"
                  />
                  <select
                    name="selectionMode"
                    defaultValue={group.selectionMode}
                    className="rounded-md border border-border bg-white px-3 py-2 text-sm"
                  >
                    <option value="SINGLE">Una opción (SINGLE)</option>
                    <option value="MULTIPLE">Varias (MULTIPLE)</option>
                    <option value="QUANTITY">Cantidades (QUANTITY)</option>
                  </select>
                  <input
                    name="minSelections"
                    type="number"
                    min={0}
                    defaultValue={group.minSelections}
                    className="rounded-md border border-border bg-white px-3 py-2 text-sm"
                  />
                  <input
                    name="maxSelections"
                    type="number"
                    min={0}
                    defaultValue={group.maxSelections}
                    className="rounded-md border border-border bg-white px-3 py-2 text-sm"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="active"
                    defaultChecked={group.active}
                  />
                  Grupo activo
                </label>
                <button
                  type="submit"
                  className="w-fit rounded-md border border-border px-3 py-2 text-sm"
                >
                  Guardar grupo
                </button>
              </form>

              <ul className="mb-3 space-y-2">
                {groupChoices.map((choice) => {
                  const boundUpdateChoice = updateOptionChoiceAction.bind(
                    null,
                    merchantId,
                    choice.id,
                  );
                  return (
                    <li key={choice.id}>
                      <form
                        action={boundUpdateChoice}
                        className="flex flex-col gap-2 sm:flex-row sm:items-center"
                      >
                        <input
                          name="name"
                          defaultValue={choice.name}
                          className="flex-1 rounded-md border border-border bg-white px-3 py-2 text-sm"
                        />
                        <input
                          name="priceDeltaInput"
                          defaultValue={formatMoneyCentsArs(
                            moneyCents(choice.priceDeltaCents),
                          ).replace("$", "")}
                          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm sm:w-32"
                        />
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            name="active"
                            defaultChecked={choice.active}
                          />
                          Activa
                        </label>
                        <button
                          type="submit"
                          className="rounded-md border border-border px-3 py-2 text-sm"
                        >
                          Guardar
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>

              <form
                action={createOptionChoiceAction.bind(
                  null,
                  merchantId,
                  group.id,
                )}
                className="flex flex-col gap-2 sm:flex-row"
              >
                <input type="hidden" name="groupId" value={group.id} />
                <input
                  name="name"
                  placeholder="Nueva opción"
                  required
                  className="flex-1 rounded-md border border-border bg-white px-3 py-2 text-sm"
                />
                <input
                  name="priceDeltaInput"
                  placeholder="Delta $"
                  defaultValue="0"
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm sm:w-32"
                />
                <button
                  type="submit"
                  className="rounded-md border border-border px-3 py-2 text-sm"
                >
                  + Opción
                </button>
              </form>
            </div>
          );
        })}

        <form
          action={boundCreateGroup}
          className="grid max-w-xl gap-3 rounded-lg border border-border bg-white/50 p-4"
        >
          <h3 className="text-sm font-medium">Nuevo grupo</h3>
          <input
            name="name"
            placeholder="Tamaño / Extras / Sabores"
            required
            className="rounded-md border border-border bg-white px-3 py-2 text-sm"
          />
          <select
            name="selectionMode"
            defaultValue="SINGLE"
            className="rounded-md border border-border bg-white px-3 py-2 text-sm"
          >
            <option value="SINGLE">Una opción (SINGLE)</option>
            <option value="MULTIPLE">Varias (MULTIPLE)</option>
            <option value="QUANTITY">Cantidades (QUANTITY)</option>
          </select>
          <button
            type="submit"
            className="w-fit rounded-md border border-border px-3 py-2 text-sm"
          >
            Crear grupo
          </button>
        </form>
      </section>
    </main>
  );
}
