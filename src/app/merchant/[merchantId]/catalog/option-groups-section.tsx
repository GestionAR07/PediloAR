import { formatMoneyCentsArs } from "@/lib/format-money";
import {
  formatOptionChoiceLine,
  OPTION_SELECTION_MODE_HINT,
} from "@/lib/format-option-choice";
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

type OptionGroupsSectionProps = {
  merchantId: string;
  productId: string;
  groups: ProductOptionGroupRecord[];
  choicesByGroup: Map<string, ProductOptionChoiceRecord[]>;
};

function SelectionModeFields({ defaultMode }: { defaultMode: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm sm:col-span-2">
      <span>Modo de selección</span>
      <select
        name="selectionMode"
        defaultValue={defaultMode}
        className="rounded-md border border-border bg-white px-3 py-2"
      >
        <option value="SINGLE">Una opción (SINGLE)</option>
        <option value="MULTIPLE">Varias (MULTIPLE)</option>
        <option value="QUANTITY">Cantidades (QUANTITY)</option>
      </select>
      <span className="text-xs text-muted">{OPTION_SELECTION_MODE_HINT}</span>
    </label>
  );
}

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

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-sm font-medium">Grupos de opciones</h2>
        <p className="text-sm text-muted">
          Paso 1: creá o editá un grupo · Paso 2: guardá el grupo · Paso 3:
          agregá opciones a ese grupo
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-muted">
          Todavía no hay grupos. Creá el primero abajo (por ejemplo:
          Presentación).
        </p>
      ) : null}

      {groups.map((group) => {
        const groupChoices = choicesByGroup.get(group.id) ?? [];
        const boundUpdateGroup = updateOptionGroupAction.bind(
          null,
          merchantId,
          group.id,
        );

        return (
          <article
            key={group.id}
            className="space-y-5 rounded-lg border border-border bg-white/60 p-4"
          >
            <header className="border-b border-border pb-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Grupo de opciones
              </p>
              <h3 className="text-lg font-semibold tracking-tight">
                {group.name}
              </h3>
            </header>

            <form action={boundUpdateGroup} className="grid gap-3">
              <p className="text-sm font-medium">Configuración del grupo</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span>Nombre del grupo</span>
                  <input
                    name="name"
                    defaultValue={group.name}
                    required
                    className="rounded-md border border-border bg-white px-3 py-2"
                  />
                </label>
                <SelectionModeFields defaultMode={group.selectionMode} />
                <label className="flex flex-col gap-1 text-sm">
                  <span>Mínimo</span>
                  <input
                    name="minSelections"
                    type="number"
                    min={0}
                    defaultValue={group.minSelections}
                    className="rounded-md border border-border bg-white px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span>Máximo</span>
                  <input
                    name="maxSelections"
                    type="number"
                    min={0}
                    defaultValue={group.maxSelections}
                    className="rounded-md border border-border bg-white px-3 py-2"
                  />
                </label>
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
                className="w-fit rounded-md border border-border px-4 py-2 text-sm font-medium"
              >
                Guardar grupo
              </button>
            </form>

            <section className="space-y-4 border-t border-border pt-4">
              <h4 className="text-sm font-medium">Opciones de este grupo</h4>

              {groupChoices.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {groupChoices.map((choice) => (
                    <li
                      key={choice.id}
                      className="rounded-md border border-border/70 bg-white px-3 py-2"
                    >
                      {formatOptionChoiceLine(
                        choice.name,
                        choice.priceDeltaCents,
                        (cents) => formatMoneyCentsArs(moneyCents(cents)),
                      )}
                      {!choice.active ? (
                        <span className="ml-2 text-muted">(inactiva)</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">
                  Todavía no hay opciones en este grupo. Agregá la primera
                  abajo.
                </p>
              )}

              {groupChoices.map((choice) => {
                const boundUpdateChoice = updateOptionChoiceAction.bind(
                  null,
                  merchantId,
                  choice.id,
                );
                return (
                  <details
                    key={`edit-${choice.id}`}
                    className="rounded-md border border-border bg-white/80 p-3 text-sm"
                  >
                    <summary className="cursor-pointer font-medium">
                      Editar: {choice.name}
                    </summary>
                    <form
                      action={boundUpdateChoice}
                      className="mt-3 grid gap-3"
                    >
                      <label className="flex flex-col gap-1">
                        <span>Nombre de la opción</span>
                        <input
                          name="name"
                          defaultValue={choice.name}
                          required
                          className="rounded-md border border-border bg-white px-3 py-2"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span>Precio adicional (ARS)</span>
                        <input
                          name="priceDeltaInput"
                          defaultValue={formatMoneyCentsArs(
                            moneyCents(choice.priceDeltaCents),
                          ).replace("$", "")}
                          className="rounded-md border border-border bg-white px-3 py-2"
                        />
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="active"
                          defaultChecked={choice.active}
                        />
                        Opción activa
                      </label>
                      <button
                        type="submit"
                        className="w-fit rounded-md border border-border px-3 py-2"
                      >
                        Guardar opción
                      </button>
                    </form>
                  </details>
                );
              })}

              <form
                action={createOptionChoiceAction.bind(
                  null,
                  merchantId,
                  group.id,
                )}
                className="grid gap-3 rounded-md border border-dashed border-border bg-white/40 p-4"
              >
                <p className="text-sm font-medium">Agregar opción</p>
                <label className="flex flex-col gap-1 text-sm">
                  <span>Nombre de la opción</span>
                  <input
                    name="name"
                    placeholder="475cc, 1,5L, 2,25L"
                    required
                    className="rounded-md border border-border bg-white px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span>Precio adicional (ARS)</span>
                  <input
                    name="priceDeltaInput"
                    defaultValue="0"
                    placeholder="0 o 1500"
                    className="rounded-md border border-border bg-white px-3 py-2"
                  />
                </label>
                <button
                  type="submit"
                  className="w-fit rounded-md border border-border px-4 py-2 text-sm font-medium"
                >
                  Agregar opción
                </button>
              </form>
            </section>
          </article>
        );
      })}

      <article className="grid max-w-xl gap-4 rounded-lg border-2 border-dashed border-border bg-white/40 p-4">
        <header className="space-y-1">
          <h3 className="text-sm font-medium">Crear nuevo grupo de opciones</h3>
          <p className="text-xs text-muted">
            Definí el grupo primero. Después podrás agregar opciones como 475cc,
            1,5L o 2,25L.
          </p>
        </header>
        <form action={boundCreateGroup} className="grid gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span>Nombre del grupo</span>
            <input
              name="name"
              placeholder="Presentación, Tamaño, Extras"
              required
              className="rounded-md border border-border bg-white px-3 py-2"
            />
          </label>
          <SelectionModeFields defaultMode="SINGLE" />
          <button
            type="submit"
            className="w-fit rounded-md border border-border px-4 py-2 text-sm font-medium"
          >
            Crear grupo
          </button>
        </form>
      </article>
    </section>
  );
}
