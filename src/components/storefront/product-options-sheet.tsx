"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { PublicProductCard } from "@/application/storefront/types";
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
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-[var(--color-bg)] p-5 shadow-lg sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-lg font-semibold tracking-tight">
              {product.name}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {estimatedUnit != null
                ? formatMoneyCentsArs(estimatedUnit)
                : product.priceLabel}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-md border border-border px-3 text-sm"
          >
            Cerrar
          </button>
        </div>

        {!product.canAddToCart && product.statusLabel ? (
          <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {product.statusLabel}
          </p>
        ) : null}

        {feedback ? (
          <p className="mb-3 rounded-md bg-accent/10 px-3 py-2 text-sm text-accent">
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
                  <h3 className="text-sm font-semibold">{group.name}</h3>
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
                      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border bg-white/70 px-3 py-2 text-sm">
                        <input
                          type="radio"
                          name={`group-${group.id}`}
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
                          ?.selections.some((s) => s.choiceId === choice.id) ??
                        false;
                      return (
                        <label
                          key={choice.id}
                          className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-white/70 px-3 py-2 text-sm"
                        >
                          <span className="flex items-center gap-3">
                            <input
                              type="radio"
                              name={`group-${group.id}`}
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
                          ?.selections.some((s) => s.choiceId === choice.id) ??
                        false;
                      return (
                        <li key={choice.id}>
                          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-white/70 px-3 py-2 text-sm">
                            <span className="flex items-center gap-3">
                              <input
                                type="checkbox"
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
                          className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-border bg-white/70 px-3 py-2 text-sm"
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
                              className="flex h-10 w-10 items-center justify-center rounded-md border border-border disabled:opacity-40"
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
                              className="flex h-10 w-10 items-center justify-center rounded-md border border-border disabled:opacity-40"
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

        <div className="sticky bottom-0 mt-5 border-t border-border bg-[var(--color-bg)] pt-4">
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
            className="min-h-12 w-full rounded-md bg-accent px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
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
