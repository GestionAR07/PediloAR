import Link from "next/link";
import type { CustomerOrderSummaryView } from "@/application/customer/order-history";
import { moneyCents } from "@/domain/money/money-cents";
import { formatMoneyCentsArs } from "@/lib/format-money";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function CustomerOrderCard({
  order,
}: {
  order: CustomerOrderSummaryView;
}) {
  return (
    <article className="rounded-[1.5rem] border border-sky-100/80 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-wider text-[var(--ps-cyan,#20AEE5)] uppercase">
            Pedido {order.orderRef}
          </p>
          <h3 className="font-display mt-1 truncate text-lg font-extrabold text-[var(--ps-night-900)]">
            {order.merchantName}
          </h3>
          <p className="mt-1 text-xs text-muted">
            {formatDate(order.createdAt)}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-extrabold ${
            order.active
              ? "bg-sky-100 text-[var(--ps-navy,#083F66)]"
              : order.status === "CANCELED"
                ? "bg-rose-100 text-rose-800"
                : "bg-emerald-100 text-emerald-800"
          }`}
        >
          {order.statusLabel}
        </span>
      </div>
      <p className="mt-4 text-sm text-muted">{order.statusDetail}</p>
      <div className="mt-4 flex items-end justify-between gap-4 border-t border-sky-100 pt-4">
        <div>
          <p className="text-xs text-muted">{order.fulfillmentLabel}</p>
          <p className="font-display text-lg font-extrabold tabular-nums text-[var(--ps-night-900)]">
            {formatMoneyCentsArs(moneyCents(order.totalCents))}
          </p>
        </div>
        <Link
          href={`/cuenta/pedidos/${order.orderId}`}
          className="inline-flex min-h-11 items-center rounded-full border border-sky-200 px-4 text-sm font-extrabold text-[var(--ps-navy,#083F66)] transition hover:bg-sky-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-cyan)]"
        >
          Ver pedido
        </Link>
      </div>
    </article>
  );
}
