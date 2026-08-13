"use client";

import Link from "next/link";
import { formatConfigurationSummary } from "@/domain/cart/validate-configuration";
import { calculateCartLineTotalCents } from "@/domain/cart/pricing";
import { isCartEmpty } from "@/domain/cart/types";
import { formatMoneyCentsArs } from "@/lib/format-money";
import { moneyCents } from "@/domain/money/money-cents";
import { useCart } from "./cart-provider";

export function CartPageClient() {
  const {
    cart,
    hydrated,
    badgeCount,
    totalCents,
    setLineQuantity,
    removeLine,
    clear,
  } = useCart();

  if (!hydrated) {
    return (
      <p className="text-sm text-muted" role="status">
        Cargando carrito…
      </p>
    );
  }

  if (isCartEmpty(cart)) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">Tu carrito está vacío.</p>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-white"
        >
          Ver comercios
        </Link>
      </div>
    );
  }

  const backHref = `/comercios/${encodeURIComponent(cart.merchantId)}`;

  return (
    <div className="space-y-6">
      <p className="text-sm">
        <Link
          href={backHref}
          className="text-accent underline-offset-4 hover:underline"
        >
          ← Seguir comprando
        </Link>
      </p>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Carrito</h1>
        <p className="text-sm text-muted">{cart.merchantNameSnapshot}</p>
        <p className="text-xs text-muted">
          {badgeCount} {badgeCount === 1 ? "producto" : "productos"}
        </p>
      </header>

      <ul className="space-y-3">
        {cart.lines.map((line) => {
          const summary = formatConfigurationSummary(line.configuration);
          const lineTotal = calculateCartLineTotalCents(line);
          return (
            <li
              key={line.id}
              className="space-y-3 rounded-xl border border-border bg-white/70 p-4"
            >
              <div className="flex gap-3">
                <div
                  aria-hidden
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(145deg,#efece6,#f7f6f3)] text-[10px] text-muted"
                >
                  Sin foto
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-sm font-semibold leading-snug">
                      {line.productNameSnapshot}
                    </h2>
                    <p className="shrink-0 text-sm font-medium">
                      {formatMoneyCentsArs(
                        moneyCents(line.unitPriceCentsSnapshot),
                      )}
                    </p>
                  </div>
                  {summary.length > 0 ? (
                    <ul className="space-y-0.5 text-xs text-muted">
                      {summary.map((row) => (
                        <li key={row}>{row}</li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="text-xs text-muted">
                    Subtotal: {formatMoneyCentsArs(lineTotal)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={`Disminuir ${line.productNameSnapshot}`}
                    onClick={() => setLineQuantity(line.id, line.quantity - 1)}
                    className="flex h-10 w-10 items-center justify-center rounded-md border border-border"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm tabular-nums">
                    {line.quantity}
                  </span>
                  <button
                    type="button"
                    aria-label={`Aumentar ${line.productNameSnapshot}`}
                    onClick={() => setLineQuantity(line.id, line.quantity + 1)}
                    className="flex h-10 w-10 items-center justify-center rounded-md border border-border"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(line.id)}
                  className="min-h-10 rounded-md border border-border px-3 text-xs"
                >
                  Eliminar
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="space-y-3 border-t border-border pt-4">
        <div className="flex items-center justify-between text-base font-semibold">
          <span>Total</span>
          <span>{formatMoneyCentsArs(moneyCents(totalCents))}</span>
        </div>
        <p className="text-xs text-muted">
          Total estimado según el catálogo actual. El checkout recalculará
          precios y disponibilidad.
        </p>
        <Link
          href="/checkout"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-white"
        >
          Continuar
        </Link>
        <button
          type="button"
          onClick={() => clear()}
          className="min-h-11 w-full rounded-md border border-border px-4 text-sm"
        >
          Vaciar carrito
        </button>
      </div>
    </div>
  );
}
