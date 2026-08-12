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
import {
  parseProductSaveFeedback,
  productEditPath,
} from "@/lib/catalog-product-feedback";
import { formatMerchantCategoryLabel } from "@/lib/format-category-label";
import { formatMoneyCentsArs } from "@/lib/format-money";
import { moneyCents } from "@/domain/money/money-cents";
import { createProductImageSignedUrl } from "@/infrastructure/storage/product-images";
import {
  deleteProductImageAction,
  updateProductAction,
  upsertProductImageAction,
} from "../../actions";
import { OptionGroupsSection } from "../../option-groups-section";
import { ProductFormSubmitButton } from "../../product-form-submit-button";
import { ProductImageEditor } from "../../product-image-editor";
import { ProductSaveFeedback } from "../../product-save-feedback";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ merchantId: string; productId: string }>;
  searchParams: Promise<{ created?: string; saved?: string }>;
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

export default async function EditProductPage({
  params,
  searchParams,
}: PageProps) {
  const { merchantId, productId } = await params;
  const query = await searchParams;
  const feedback = parseProductSaveFeedback(query);
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
  const imageUrl = product.imagePath
    ? await createProductImageSignedUrl(product.imagePath)
    : null;

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
          Editar producto
        </h1>
        <p className="text-base font-medium">{product.name}</p>
        <p className="text-sm text-muted">{merchant.name}</p>
      </header>

      {feedback ? (
        <ProductSaveFeedback
          kind={feedback}
          cleanPath={productEditPath(merchantId, productId)}
        />
      ) : null}

      <ProductImageEditor
        merchantId={merchantId}
        productId={productId}
        imageUrl={imageUrl}
        upsertAction={upsertProductImageAction}
        deleteAction={deleteProductImageAction}
      />

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

          <ProductFormSubmitButton mode="edit" />
        </form>
      </section>

      <OptionGroupsSection
        merchantId={merchantId}
        productId={productId}
        groups={groups}
        choicesByGroup={choicesByGroup}
      />
    </main>
  );
}
