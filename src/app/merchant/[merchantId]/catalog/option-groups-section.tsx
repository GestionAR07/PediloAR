import { formatMoneyCentsArs } from "@/lib/format-money";
import { formatOptionChoiceLine } from "@/lib/format-option-choice";
import { getOptionModePresentation } from "@/lib/option-mode-presentation";
import { moneyCents } from "@/domain/money/money-cents";
import type {
  ProductOptionChoiceRecord,
  ProductOptionGroupRecord,
} from "@/infrastructure/db/repositories/catalog-repository";
import {
  createOptionChoiceAction,
  createOptionGroupAction,
  updateOptionChoiceAction,
  updateOptionGroupAction,
} from "./actions";
import { OptionGroupAdvancedSettings } from "./option-group-advanced-settings";
import {
  getMerchantOptionModeCopy,
  OptionModeSelector,
} from "./option-mode-selector";

type OptionGroupsSectionProps = {
  merchantId: string;
  productId: string;
  groups: ProductOptionGroupRecord[];
  choicesByGroup: Map<string, ProductOptionChoiceRecord[]>;
};

export function OptionGroupsSection({
  merchantId,
  productId,
  groups,
  choicesByGroup,
}: OptionGroupsSectionProps) {
  const boundCreateGroup = createOptionGroupAction.bind(
    null,
    merchantId,
    productId,
  );
  const totalOptions = groups.reduce(
    (count, group) => count + (choicesByGroup.get(group.id)?.length ?? 0),
    0,
  );

  return (
    <section className="merchant-workspace-options space-y-4">
      <header className="space-y-1">
        <h2 className="merchant-workspace-card-title">Variantes y extras</h2>
        <p className="merchant-workspace-card-copy">
          Configurá tamaños, sabores, agregados o combinaciones.
        </p>
        {groups.length > 0 ? (
          <p className="text-sm font-medium text-[#4a6b82]">
            {groups.length}{" "}
            {groups.length === 1 ? "configuración" : "configuraciones"}
            {" · "}
            {totalOptions} {totalOptions === 1 ? "opción" : "opciones"}
          </p>
        ) : null}
      </header>

      {groups.length === 0 ? (
        <p className="merchant-workspace-empty">
          Todavía no agregaste variantes.
        </p>
      ) : null}

      <div
        className={
          groups.length > 1
            ? "merchant-workspace-variant-grid"
            : "merchant-workspace-variant-single"
        }
      >
        {groups.map((group) => {
          const groupChoices = choicesByGroup.get(group.id) ?? [];
          const modePresentation = getOptionModePresentation(
            group.selectionMode,
          );
          const modeCopy = getMerchantOptionModeCopy(group.selectionMode);
          const boundUpdateGroup = updateOptionGroupAction.bind(
            null,
            merchantId,
            group.id,
          );

          return (
            <article
              key={group.id}
              className="merchant-workspace-card merchant-workspace-variant-card"
            >
              <details className="merchant-workspace-disclosure">
                <summary className="merchant-workspace-disclosure-summary">
                  <div className="min-w-0 flex-1 space-y-2">
                    <h3 className="text-lg font-semibold tracking-tight">
                      {group.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="merchant-workspace-mode-badge">
                        {modeCopy.label}
                      </span>
                      <span className="text-sm text-[#4a6b82]">
                        {groupChoices.length}{" "}
                        {groupChoices.length === 1 ? "opción" : "opciones"}
                      </span>
                      <span
                        className={
                          group.active
                            ? "merchant-workspace-status-chip merchant-workspace-status-chip--live"
                            : "merchant-workspace-status-chip"
                        }
                      >
                        {group.active ? "Activo" : "Pausado"}
                      </span>
                    </div>
                  </div>
                  <span className="merchant-workspace-secondary-btn shrink-0">
                    Configurar
                  </span>
                </summary>

                <div className="merchant-workspace-disclosure-body">
                  <div className="merchant-workspace-group-edit">
                    <form
                      action={boundUpdateGroup}
                      className="merchant-workspace-group-edit-main grid gap-3"
                    >
                      <p className="text-sm text-[#4a6b82]">
                        Ajustá nombre, tipo de elección y estado.
                      </p>
                      <label className="merchant-workspace-field">
                        <span>Nombre</span>
                        <input
                          name="name"
                          defaultValue={group.name}
                          required
                          className="merchant-workspace-input"
                        />
                      </label>
                      <OptionModeSelector
                        defaultMode={group.selectionMode}
                        fieldIdPrefix={`edit-${group.id}`}
                      />
                      <OptionGroupAdvancedSettings
                        mode={group.selectionMode}
                        minSelections={group.minSelections}
                        maxSelections={group.maxSelections}
                      />
                      <label className="flex items-center gap-2 text-sm font-semibold text-[#083F66]">
                        <input
                          type="checkbox"
                          name="active"
                          defaultChecked={group.active}
                          className="merchant-workspace-checkbox"
                        />
                        Activo
                      </label>
                      <button
                        type="submit"
                        className="merchant-workspace-secondary-btn w-fit"
                      >
                        Guardar grupo
                      </button>
                    </form>

                    <section className="merchant-workspace-group-edit-side space-y-3">
                      <h4 className="text-sm font-semibold text-[#083F66]">
                        Opciones
                      </h4>

                      {groupChoices.length > 0 ? (
                        <ul className="merchant-workspace-option-list">
                          {groupChoices.map((choice) => {
                            const boundUpdateChoice =
                              updateOptionChoiceAction.bind(
                                null,
                                merchantId,
                                choice.id,
                              );
                            return (
                              <li key={choice.id}>
                                <details className="merchant-workspace-option-row">
                                  <summary className="merchant-workspace-option-summary">
                                    <span className="min-w-0 flex-1">
                                      {formatOptionChoiceLine(
                                        choice.name,
                                        choice.priceDeltaCents,
                                        (cents) =>
                                          formatMoneyCentsArs(
                                            moneyCents(cents),
                                          ),
                                      )}
                                      {!choice.active ? (
                                        <span className="ml-2 text-[#4a6b82]">
                                          (pausada)
                                        </span>
                                      ) : null}
                                    </span>
                                    <span className="merchant-workspace-inline-action">
                                      Editar
                                    </span>
                                  </summary>
                                  <form
                                    action={boundUpdateChoice}
                                    className="mt-3 grid gap-3 border-t border-[#d4e8f3] pt-3"
                                  >
                                    <div className="merchant-workspace-option-fields">
                                      <label className="merchant-workspace-field">
                                        <span>Nombre</span>
                                        <input
                                          name="name"
                                          defaultValue={choice.name}
                                          required
                                          className="merchant-workspace-input"
                                        />
                                      </label>
                                      <label className="merchant-workspace-field">
                                        <span>Precio adicional (ARS)</span>
                                        <input
                                          name="priceDeltaInput"
                                          defaultValue={formatMoneyCentsArs(
                                            moneyCents(choice.priceDeltaCents),
                                          ).replace("$", "")}
                                          className="merchant-workspace-input"
                                        />
                                      </label>
                                    </div>
                                    <label className="flex items-center gap-2 font-semibold text-[#083F66]">
                                      <input
                                        type="checkbox"
                                        name="active"
                                        defaultChecked={choice.active}
                                        className="merchant-workspace-checkbox"
                                      />
                                      Opción activa
                                    </label>
                                    <button
                                      type="submit"
                                      className="merchant-workspace-secondary-btn w-fit"
                                    >
                                      Guardar opción
                                    </button>
                                  </form>
                                </details>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="merchant-workspace-empty">
                          Todavía no hay opciones.
                        </p>
                      )}

                      <details className="merchant-workspace-add-block">
                        <summary className="merchant-workspace-add-summary">
                          + Agregar opción
                        </summary>
                        <form
                          action={createOptionChoiceAction.bind(
                            null,
                            merchantId,
                            group.id,
                          )}
                          className="mt-3 grid gap-3"
                        >
                          <div className="merchant-workspace-option-fields">
                            <label className="merchant-workspace-field">
                              <span>Nombre</span>
                              <input
                                name="name"
                                placeholder={
                                  modePresentation.optionNamePlaceholder
                                }
                                required
                                className="merchant-workspace-input"
                              />
                            </label>
                            <label className="merchant-workspace-field">
                              <span>Precio adicional</span>
                              <input
                                name="priceDeltaInput"
                                defaultValue="0"
                                placeholder="0 o 1500"
                                className="merchant-workspace-input"
                              />
                            </label>
                          </div>
                          <button
                            type="submit"
                            className="merchant-workspace-secondary-btn w-fit"
                          >
                            Agregar
                          </button>
                        </form>
                      </details>
                    </section>
                  </div>
                </div>
              </details>
            </article>
          );
        })}
      </div>

      <details className="merchant-workspace-card merchant-workspace-add-variant merchant-workspace-variant-single">
        <summary className="merchant-workspace-add-summary merchant-workspace-add-summary--large">
          + Agregar variantes o extras
        </summary>
        <div className="mt-4 grid gap-4">
          <p className="text-sm text-[#4a6b82]">
            Creá una configuración para tamaños, sabores o agregados.
          </p>
          <form action={boundCreateGroup} className="grid gap-4">
            <label className="merchant-workspace-field">
              <span>Nombre</span>
              <input
                name="name"
                placeholder="Presentación, Extras, Sabores"
                required
                className="merchant-workspace-input"
              />
            </label>
            <OptionModeSelector
              defaultMode="SINGLE"
              fieldIdPrefix="create-group"
            />
            <button
              type="submit"
              className="merchant-workspace-primary-btn w-fit"
            >
              Crear grupo
            </button>
          </form>
        </div>
      </details>
    </section>
  );
}
