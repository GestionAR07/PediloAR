"use client";

import Link from "next/link";
import { formatConfigurationSummary } from "@/domain/cart/validate-configuration";
import { calculateCartLineTotalCents } from "@/domain/cart/pricing";
import { isCartEmpty } from "@/domain/cart/types";
import { formatMoneyCentsArs } from "@/lib/format-money";
import { moneyCents } from "@/domain/money/money-cents";
import { ShoppingBagIcon, StoreIcon } from "@/components/ui/public-icons";
import { useCart } from "./cart-provider";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-violet)]";

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
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-sm text-muted" role="status">
          Cargando carrito…
        </p>
      </div>
    );
  }

  if (isCartEmpty(cart)) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-10 sm:px-6 lg:px-8">
        <div className="cart-empty mx-auto w-full max-w-md rounded-[1.75rem] border border-violet-100/70 bg-white px-6 py-12 text-center shadow-soft">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
            <ShoppingBagIcon className="h-7 w-7" />
          </span>
          <h1 className="font-display mt-5 text-2xl font-extrabold tracking-tight text-[var(--ps-night-900)]">
            Tu carrito está vacío
          </h1>
          <p className="mt-2 text-sm text-muted">
            Elegí un comercio y agregá productos para armar tu pedido.
          </p>
          <Link
            href="/"
            className={`grad-btn mt-6 inline-flex min-h-12 items-center justify-center rounded-full px-6 text-sm font-extrabold text-white shadow-glow ${focusRing}`}
          >
            Ver comercios
          </Link>
        </div>
      </div>
    );
  }

  const backHref = `/comercios/${encodeURIComponent(cart.merchantId)}`;
  const itemLabel = badgeCount === 1 ? "producto" : "productos";
  const estimatedTotal = formatMoneyCentsArs(moneyCents(totalCents));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] sm:px-6 lg:px-8 lg:pt-8 lg:pb-12">
      <header className="cart-intro max-w-2xl space-y-2">
        <p className="text-[11px] font-bold tracking-wider text-violet-700 uppercase">
          Pedido local
        </p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-[var(--ps-night-900)]">
          Tu carrito
        </h1>
        <p className="flex items-center gap-2 text-sm font-medium text-muted">
          <StoreIcon className="h-4 w-4 shrink-0 text-violet-600" />
          <span className="min-w-0 truncate">{cart.merchantNameSnapshot}</span>
        </p>
        <p className="text-xs font-semibold text-slate-400">
          {badgeCount} {itemLabel}
        </p>
      </header>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(17.5rem,0.9fr)] lg:gap-8">
        <ul className="space-y-3">
          {cart.lines.map((line, index) => {
            const summary = formatConfigurationSummary(line.configuration);
            const lineTotal = calculateCartLineTotalCents(line);
            const initial = line.productNameSnapshot.slice(0, 1).toUpperCase();
            return (
              <li
                key={line.id}
                className="cart-line-card space-y-4 rounded-[1.75rem] border border-violet-100/70 bg-white p-4 shadow-soft sm:p-5"
                style={{ ["--cart-i" as string]: String(index) }}
              >
                <div className="flex gap-3 sm:gap-4">
                  <div
                    aria-hidden
                    className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-violet-200 to-fuchsia-200 sm:h-[4.5rem] sm:w-[4.5rem]"
                  >
                    <span className="absolute inset-0 bg-gradient-to-br from-violet-800 via-violet-600 to-fuchsia-500" />
                    <span className="font-display relative text-xl font-extrabold text-white/90">
                      {initial}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="font-display text-sm font-extrabold leading-snug tracking-tight text-[var(--ps-night-900)] sm:text-base">
                        {line.productNameSnapshot}
                      </h2>
                      <p className="cart-price-value shrink-0 text-sm font-extrabold tabular-nums text-[var(--ps-night-900)]">
                        {formatMoneyCentsArs(
                          moneyCents(line.unitPriceCentsSnapshot),
                        )}
                      </p>
                    </div>
                    {summary.length > 0 ? (
                      <ul className="space-y-0.5 text-xs leading-relaxed text-muted">
                        {summary.map((row) => (
                          <li key={row}>{row}</li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="text-xs font-semibold text-slate-400">
                      Subtotal: {formatMoneyCentsArs(lineTotal)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="cart-qty-stepper inline-flex items-center rounded-full border border-violet-100 bg-violet-50/80 p-0.5">
                    <button
                      type="button"
                      aria-label={`Disminuir ${line.productNameSnapshot}`}
                      onClick={() =>
                        setLineQuantity(line.id, line.quantity - 1)
                      }
                      className={`flex h-11 w-11 items-center justify-center rounded-full text-lg font-bold text-violet-800 hover:bg-white ${focusRing}`}
                    >
                      −
                    </button>
                    <span
                      key={line.quantity}
                      className="cart-qty-value w-8 text-center text-sm font-extrabold tabular-nums text-[var(--ps-night-900)]"
                    >
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label={`Aumentar ${line.productNameSnapshot}`}
                      onClick={() =>
                        setLineQuantity(line.id, line.quantity + 1)
                      }
                      className={`flex h-11 w-11 items-center justify-center rounded-full text-lg font-bold text-violet-800 hover:bg-white ${focusRing}`}
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(line.id)}
                    className={`cart-remove-btn min-h-11 rounded-full px-3 text-xs font-bold text-slate-500 hover:bg-rose-50 hover:text-rose-700 ${focusRing}`}
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <aside className="cart-summary-panel space-y-4 rounded-[1.75rem] border border-violet-100/70 bg-white p-5 shadow-soft lg:sticky lg:top-24">
          <h2 className="font-display text-lg font-extrabold tracking-tight text-[var(--ps-night-900)]">
            Resumen del pedido
          </h2>
          <p className="text-sm text-muted">
            {badgeCount} {itemLabel}
            <span className="block truncate text-xs font-medium">
              {cart.merchantNameSnapshot}
            </span>
          </p>
          <div className="flex items-end justify-between gap-3 border-t border-violet-100 pt-4">
            <span className="text-sm font-bold text-slate-500">
              Total estimado
            </span>
            <span
              key={totalCents}
              className="cart-total-value font-display text-xl font-extrabold tabular-nums text-[var(--ps-night-900)]"
            >
              {estimatedTotal}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-muted">
            El total y la disponibilidad se validan al continuar.
          </p>
          <Link
            href="/checkout"
            className={`grad-btn hidden min-h-12 w-full items-center justify-center rounded-full px-4 text-sm font-extrabold text-white shadow-glow lg:flex ${focusRing}`}
          >
            Continuar
          </Link>
          <Link
            href={backHref}
            className={`inline-flex min-h-11 w-full items-center justify-center rounded-full border border-violet-100 px-4 text-sm font-bold text-violet-800 hover:bg-violet-50 ${focusRing}`}
          >
            Seguir comprando
          </Link>
          <button
            type="button"
            onClick={() => clear()}
            className={`min-h-11 w-full rounded-full px-4 text-sm font-medium text-slate-400 hover:text-rose-700 ${focusRing}`}
          >
            Vaciar carrito
          </button>
        </aside>
      </div>

      <div className="cart-sticky-bar pb-safe sticky bottom-3 z-20 lg:hidden">
        <Link
          href="/checkout"
          className={`grad-btn flex min-h-12 items-center justify-between gap-3 rounded-full px-5 text-sm font-extrabold whitespace-nowrap text-white shadow-glow ${focusRing}`}
        >
          <span>Continuar</span>
          <span className="shrink-0 tabular-nums">{estimatedTotal}</span>
        </Link>
      </div>
    </div>
  );
}
