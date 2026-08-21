"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { PublicProductCard } from "@/application/storefront/types";
import { CloseIcon } from "@/components/ui/public-icons";
import {
  buildCartConfigurationFromDraft,
  isConfiguratorSelectionValid,
  type ConfiguratorDraftSelection,
} from "@/domain/cart/validate-configuration";
import { calculateConfiguredUnitPriceCents } from "@/domain/cart/pricing";
import { formatMoneyCentsArs } from "@/lib/format-money";

type Props = {
  product: PublicProductCard | null;
  open: boolean;
  onClose: () => void;
  onAddConfigured: (
    configuration: ReturnType<typeof buildCartConfigurationFromDraft>,
  ) => void;
  feedback?: string | null;
};

function emptyDraft(
  product: PublicProductCard | null,
): ConfiguratorDraftSelection[] {
  if (!product) return [];
  return product.optionGroups.map((group) => ({
    groupId: group.id,
    selections: [],
  }));
}

function getQuantity(
  draft: ConfiguratorDraftSelection[],
  choiceId: string,
): number {
  for (const group of draft) {
    const found = group.selections.find((s) => s.choiceId === choiceId);
    if (found) return found.quantity;
  }
  return 0;
}

function setSingleSelection(
  draft: ConfiguratorDraftSelection[],
  groupId: string,
  choiceId: string | null,
): ConfiguratorDraftSelection[] {
  return draft.map((group) => {
    if (group.groupId !== groupId) return group;
    if (!choiceId) {
      return { ...group, selections: [] };
    }
    return {
      ...group,
      selections: [{ choiceId, quantity: 1 }],
    };
  });
}

function toggleMultipleSelection(
  draft: ConfiguratorDraftSelection[],
  groupId: string,
  choiceId: string,
  maxSelections: number,
): ConfiguratorDraftSelection[] {
  return draft.map((group) => {
    if (group.groupId !== groupId) return group;
    const exists = group.selections.some((s) => s.choiceId === choiceId);
    if (exists) {
      return {
        ...group,
        selections: group.selections.filter((s) => s.choiceId !== choiceId),
      };
    }
    if (group.selections.length >= maxSelections) {
      return group;
    }
    return {
      ...group,
      selections: [...group.selections, { choiceId, quantity: 1 }],
    };
  });
}

function setQuantitySelection(
  draft: ConfiguratorDraftSelection[],
  groupId: string,
  choiceId: string,
  quantity: number,
  maxTotal: number,
): ConfiguratorDraftSelection[] {
  return draft.map((group) => {
    if (group.groupId !== groupId) return group;
    const others = group.selections.filter((s) => s.choiceId !== choiceId);
    const othersTotal = others.reduce((sum, s) => sum + s.quantity, 0);
    const capped = Math.max(0, Math.min(quantity, maxTotal - othersTotal));
    if (capped < 1) {
      return { ...group, selections: others };
    }
    return {
      ...group,
      selections: [...others, { choiceId, quantity: capped }],
    };
  });
}

function choiceSurface(selected: boolean): string {
  return selected
    ? "border-violet-200 bg-violet-50"
    : "border-transparent bg-slate-50 hover:border-violet-100 hover:bg-violet-50";
}

export function ProductOptionsSheet({
  product,
  open,
  onClose,
  onAddConfigured,
  feedback,
}: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState<ConfiguratorDraftSelection[]>(() =>
    emptyDraft(product),
  );

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  const groups = useMemo(
    () =>
      (product?.optionGroups ?? []).map((group) => ({
        id: group.id,
        name: group.name,
        selectionMode: group.selectionMode,
        minSelections: group.minSelections,
        maxSelections: group.maxSelections,
        choices: group.choices.map((choice) => ({
          id: choice.id,
          name: choice.name,
          priceDeltaCents: choice.priceDeltaCents,
        })),
      })),
    [product],
  );

  const valid = useMemo(
    () => (product ? isConfiguratorSelectionValid(groups, draft) : false),
    [product, groups, draft],
  );

  const estimatedUnit = useMemo(() => {
    if (!product) return null;
    const configuration = buildCartConfigurationFromDraft(groups, draft);
    return calculateConfiguredUnitPriceCents(product.priceCents, configuration);
  }, [product, groups, draft]);

  if (!open || !product) {
    return null;
  }

  const canSubmit = product.canAddToCart && (groups.length === 0 || valid);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-[var(--ps-night)]/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="product-options-sheet relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-2xl sm:max-w-xl sm:rounded-[2rem]"
      >
        <div className="shrink-0 border-b border-violet-100/70 px-5 pt-3 pb-4 sm:px-6 sm:pt-5">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200 sm:hidden" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2
                id={titleId}
                className="font-display text-xl font-extrabold tracking-tight text-[var(--ps-night-900)]"
              >
                {product.name}
              </h2>
              <p className="grad-text mt-1 text-sm font-extrabold">
                {estimatedUnit != null
                  ? formatMoneyCentsArs(estimatedUnit)
                  : product.priceLabel}
              </p>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-violet)]"
            >
              <CloseIcon className="h-5 w-5" />
              <span className="sr-only">Cerrar</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {!product.canAddToCart && product.statusLabel ? (
            <p className="mb-3 rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {product.statusLabel}
            </p>
          ) : null}

          {feedback ? (
            <p className="mb-3 rounded-2xl bg-violet-50 px-3 py-2 text-sm font-medium text-violet-800">
              {feedback}
            </p>
          ) : null}

          {product.description ? (
            <p className="mb-4 text-sm text-muted">{product.description}</p>
          ) : null}

          <div className="space-y-5">
            {product.optionGroups.map((group) => {
              const totalSelected =
                draft
                  .find((entry) => entry.groupId === group.id)
                  ?.selections.reduce((sum, s) => sum + s.quantity, 0) ?? 0;

              return (
                <section key={group.id} className="space-y-2">
                  <div>
                    <h3 className="font-display text-sm font-extrabold text-[var(--ps-night-900)]">
                      {group.name}
                    </h3>
                    <p className="text-xs text-muted">
                      {group.modeLabel}. {group.hint}
                    </p>
                    {group.selectionMode === "QUANTITY" ? (
                      <p className="mt-1 text-xs font-medium text-foreground">
                        Total: {totalSelected} de {group.maxSelections}
                      </p>
                    ) : null}
                  </div>

                  {group.selectionMode === "SINGLE" ? (
                    <div
                      role="radiogroup"
                      aria-label={group.name}
                      className="space-y-1.5"
                    >
                      {group.minSelections === 0 ? (
                        <label
                          className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2 text-sm ${choiceSurface(
                            (draft.find((d) => d.groupId === group.id)
                              ?.selections.length ?? 0) === 0,
                          )}`}
                        >
                          <input
                            type="radio"
                            name={`group-${group.id}`}
                            className="accent-violet-600"
                            checked={
                              (draft.find((d) => d.groupId === group.id)
                                ?.selections.length ?? 0) === 0
                            }
                            onChange={() =>
                              setDraft((current) =>
                                setSingleSelection(current, group.id, null),
                              )
                            }
                          />
                          <span>Ninguna</span>
                        </label>
                      ) : null}
                      {group.choices.map((choice) => {
                        const selected =
                          draft
                            .find((d) => d.groupId === group.id)
                            ?.selections.some(
                              (s) => s.choiceId === choice.id,
                            ) ?? false;
                        return (
                          <label
                            key={choice.id}
                            className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-sm ${choiceSurface(selected)}`}
                          >
                            <span className="flex items-center gap-3">
                              <input
                                type="radio"
                                name={`group-${group.id}`}
                                className="accent-violet-600"
                                checked={selected}
                                onChange={() =>
                                  setDraft((current) =>
                                    setSingleSelection(
                                      current,
                                      group.id,
                                      choice.id,
                                    ),
                                  )
                                }
                              />
                              <span>{choice.name}</span>
                            </span>
                            {choice.priceDeltaLabel ? (
                              <span className="text-muted">
                                +{choice.priceDeltaLabel}
                              </span>
                            ) : null}
                          </label>
                        );
                      })}
                    </div>
                  ) : null}

                  {group.selectionMode === "MULTIPLE" ? (
                    <ul className="space-y-1.5">
                      {group.choices.map((choice) => {
                        const selected =
                          draft
                            .find((d) => d.groupId === group.id)
                            ?.selections.some(
                              (s) => s.choiceId === choice.id,
                            ) ?? false;
                        return (
                          <li key={choice.id}>
                            <label
                              className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-sm ${choiceSurface(selected)}`}
                            >
                              <span className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  className="accent-violet-600"
                                  checked={selected}
                                  onChange={() =>
                                    setDraft((current) =>
                                      toggleMultipleSelection(
                                        current,
                                        group.id,
                                        choice.id,
                                        group.maxSelections,
                                      ),
                                    )
                                  }
                                />
                                <span>{choice.name}</span>
                              </span>
                              {choice.priceDeltaLabel ? (
                                <span className="text-muted">
                                  +{choice.priceDeltaLabel}
                                </span>
                              ) : null}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}

                  {group.selectionMode === "QUANTITY" ? (
                    <ul className="space-y-2">
                      {group.choices.map((choice) => {
                        const qty = getQuantity(draft, choice.id);
                        return (
                          <li
                            key={choice.id}
                            className={`flex min-h-12 items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-sm ${choiceSurface(qty > 0)}`}
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {choice.name}
                              </p>
                              {choice.priceDeltaLabel ? (
                                <p className="text-xs text-muted">
                                  +{choice.priceDeltaLabel} c/u
                                </p>
                              ) : null}
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <button
                                type="button"
                                aria-label={`Disminuir ${choice.name}`}
                                disabled={qty <= 0}
                                onClick={() =>
                                  setDraft((current) =>
                                    setQuantitySelection(
                                      current,
                                      group.id,
                                      choice.id,
                                      qty - 1,
                                      group.maxSelections,
                                    ),
                                  )
                                }
                                className="flex h-10 w-10 items-center justify-center rounded-full border border-violet-200 bg-white font-bold disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-violet)]"
                              >
                                −
                              </button>
                              <span
                                className="w-8 text-center tabular-nums"
                                aria-live="polite"
                              >
                                {qty}
                              </span>
                              <button
                                type="button"
                                aria-label={`Aumentar ${choice.name}`}
                                disabled={totalSelected >= group.maxSelections}
                                onClick={() =>
                                  setDraft((current) =>
                                    setQuantitySelection(
                                      current,
                                      group.id,
                                      choice.id,
                                      qty + 1,
                                      group.maxSelections,
                                    ),
                                  )
                                }
                                className="flex h-10 w-10 items-center justify-center rounded-full border border-violet-200 bg-white font-bold disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-violet)]"
                              >
                                +
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </section>
              );
            })}
          </div>
        </div>

        <div className="pb-safe sticky bottom-0 shrink-0 border-t border-violet-100/70 bg-white px-5 pt-4 pb-5">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              const configuration = buildCartConfigurationFromDraft(
                groups,
                draft,
              );
              onAddConfigured(configuration);
            }}
            className="grad-btn min-h-12 w-full rounded-full px-4 py-4 text-sm font-extrabold text-white shadow-glow disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-violet)]"
          >
            Agregar al carrito
            {estimatedUnit != null
              ? ` · ${formatMoneyCentsArs(estimatedUnit)}`
              : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
