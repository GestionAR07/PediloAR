import Link from "next/link";
import { redirect } from "next/navigation";
import { MerchantWorkspacePage } from "@/components/merchant/merchant-workspace-page";
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
  searchParams: Promise<{
    created?: string;
    saved?: string;
    view?: string;
  }>;
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
  const showOptions = query.view === "options";
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
  const productHref = `/merchant/${merchantId}/catalog/products/${productId}`;
  const optionsHref = `${productHref}?view=options`;

  return (
    <MerchantWorkspacePage
      merchantId={merchantId}
      merchantName={merchant.name}
      activeSection="catalog"
      title="Editar producto"
      description={
        <div className="merchant-workspace-product-meta">
          <p className="merchant-workspace-product-meta-name">{product.name}</p>
          <div className="merchant-workspace-product-chips">
            {product.active ? (
              <span className="merchant-workspace-status-chip merchant-workspace-status-chip--live">
                Visible
              </span>
            ) : null}
            {product.available ? (
              <span className="merchant-workspace-status-chip merchant-workspace-status-chip--live">
                Disponible
              </span>
            ) : null}
            {product.stockMode === "TRACKED" &&
            product.stockQuantity !== null ? (
              <span className="merchant-workspace-status-chip">
                Stock: {product.stockQuantity}
              </span>
            ) : null}
          </div>
        </div>
      }
      action={
        <Link
          href={`/merchant/${merchantId}/catalog`}
          className="merchant-workspace-secondary-btn"
        >
          ← Catálogo
        </Link>
      }
    >
      <div className="merchant-workspace-edit-stack">
        <nav
          className="merchant-workspace-segmented"
          aria-label="Secciones del producto"
        >
          <Link
            href={productHref}
            className={
              showOptions
                ? "merchant-workspace-segment"
                : "merchant-workspace-segment merchant-workspace-segment--active"
            }
            aria-current={showOptions ? undefined : "page"}
          >
            Producto
          </Link>
          <Link
            href={optionsHref}
            className={
              showOptions
                ? "merchant-workspace-segment merchant-workspace-segment--active"
                : "merchant-workspace-segment"
            }
            aria-current={showOptions ? "page" : undefined}
          >
            Variantes y extras
          </Link>
        </nav>

        {feedback && !showOptions ? (
          <ProductSaveFeedback
            kind={feedback}
            cleanPath={productEditPath(merchantId, productId)}
          />
        ) : null}

        {showOptions ? (
          <OptionGroupsSection
            merchantId={merchantId}
            productId={productId}
            groups={groups}
            choicesByGroup={choicesByGroup}
          />
        ) : (
          <div className="merchant-workspace-edit-layout">
            <section className="merchant-workspace-card merchant-workspace-edit-main">
              <h2 className="merchant-workspace-card-title">
                Información del producto
              </h2>
              <form
                action={boundUpdate}
                className="merchant-workspace-product-form"
              >
                <div className="merchant-workspace-product-grid">
                  <label className="merchant-workspace-field">
                    <span>Nombre</span>
                    <input
                      name="name"
                      defaultValue={product.name}
                      required
                      className="merchant-workspace-input"
                    />
                  </label>

                  <label className="merchant-workspace-field">
                    <span>Categoría</span>
                    <select
                      name="merchantCategoryId"
                      defaultValue={product.merchantCategoryId}
                      className="merchant-workspace-input"
                    >
                      {selectableCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {formatMerchantCategoryLabel(
                            category.name,
                            category.active,
                          )}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="merchant-workspace-field">
                    <span>Precio (ARS)</span>
                    <input
                      name="priceInput"
                      defaultValue={formatMoneyCentsArs(
                        moneyCents(product.priceCents),
                      ).replace("$", "")}
                      required
                      className="merchant-workspace-input"
                    />
                  </label>

                  <div className="merchant-workspace-stock-block">
                    <label className="merchant-workspace-field">
                      <span>Stock</span>
                      <select
                        name="stockMode"
                        defaultValue={product.stockMode}
                        className="merchant-workspace-input"
                      >
                        <option value="NOT_TRACKED">No controlar stock</option>
                        <option value="TRACKED">
                          Controlar unidades disponibles
                        </option>
                      </select>
                    </label>
                    <label className="merchant-workspace-field">
                      <span>Cantidad</span>
                      <input
                        name="stockQuantity"
                        type="number"
                        min={0}
                        step={1}
                        defaultValue={product.stockQuantity ?? ""}
                        className="merchant-workspace-input"
                      />
                    </label>
                  </div>
                </div>

                <label className="merchant-workspace-field merchant-workspace-field--full">
                  <span>Descripción</span>
                  <textarea
                    name="description"
                    rows={3}
                    defaultValue={product.description}
                    className="merchant-workspace-input merchant-workspace-textarea"
                  />
                </label>

                <div className="merchant-workspace-commerce-states">
                  <label className="merchant-workspace-check-row">
                    <input
                      type="checkbox"
                      name="active"
                      defaultChecked={product.active}
                      className="merchant-workspace-checkbox"
                    />
                    <span>
                      <span className="block font-semibold">
                        Mostrar en la tienda
                      </span>
                      <span className="block text-sm font-normal text-[#5b5470]">
                        Visible para tus clientes.
                      </span>
                    </span>
                  </label>
                  <label className="merchant-workspace-check-row">
                    <input
                      type="checkbox"
                      name="available"
                      defaultChecked={product.available}
                      className="merchant-workspace-checkbox"
                    />
                    <span>
                      <span className="block font-semibold">
                        Disponible para pedir
                      </span>
                      <span className="block text-sm font-normal text-[#5b5470]">
                        Pausalo sin eliminarlo.
                      </span>
                    </span>
                  </label>
                </div>

                <ProductFormSubmitButton mode="edit" />
              </form>
            </section>

            <aside className="merchant-workspace-edit-side">
              <ProductImageEditor
                merchantId={merchantId}
                productId={productId}
                imageUrl={imageUrl}
                upsertAction={upsertProductImageAction}
                deleteAction={deleteProductImageAction}
              />
            </aside>
          </div>
        )}
      </div>
    </MerchantWorkspacePage>
  );
}
