"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { shortOrderReference } from "@/application/checkout/placed-order-view";
import {
  NEW_ORDER_TOAST_EXIT_MS,
  NEW_ORDER_TOAST_VISIBLE_MS,
  merchantOrderDetailHref,
} from "@/application/merchant/new-order-alert";

type Props = {
  merchantId: string;
  orderId: string;
  onDismiss: (orderId: string) => void;
};

export function OrderNotificationToast({
  merchantId,
  orderId,
  onDismiss,
}: Props) {
  const [exiting, setExiting] = useState(false);
  const shortRef = shortOrderReference(orderId);
  const href = merchantOrderDetailHref(merchantId, orderId);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setExiting(true);
    }, NEW_ORDER_TOAST_VISIBLE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [orderId]);

  useEffect(() => {
    if (!exiting) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      onDismiss(orderId);
    }, NEW_ORDER_TOAST_EXIT_MS);
    return () => window.clearTimeout(timeoutId);
  }, [exiting, onDismiss, orderId]);

  return (
    <article
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`merchant-order-toast pointer-events-auto w-full rounded-2xl border border-violet-200 bg-white p-4 shadow-[0_12px_32px_-16px_rgba(15,23,42,0.28)] ${
        exiting ? "merchant-order-toast--out" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 h-10 w-1 shrink-0 rounded-full bg-gradient-to-b from-violet-600 to-fuchsia-500"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold tracking-[0.16em] text-violet-700 uppercase">
            NUEVO PEDIDO
          </p>
          <p className="mt-1 text-base font-semibold tracking-tight text-foreground">
            Pedido #{shortRef}
          </p>
          <p className="mt-1 text-sm text-muted">
            Tenés un nuevo pedido para revisar.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              href={href}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-violet-700 px-4 text-sm font-bold text-white hover:bg-violet-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700"
            >
              Ver pedido
            </Link>
            <button
              type="button"
              aria-label="Cerrar aviso de pedido nuevo"
              onClick={() => setExiting(true)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-violet-200 px-3 text-sm font-medium text-violet-800 hover:bg-violet-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
