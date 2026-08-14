import Link from "next/link";
import { moneyCents } from "@/domain/money/money-cents";
import { formatMoneyCentsArs } from "@/lib/format-money";
import { formatMerchantOrderWhen } from "@/lib/format-local-time";
import type { MerchantOrderView } from "@/application/merchant/order-inbox";

type Props = {
  merchantId: string;
  order: MerchantOrderView;
  now: Date;
  timeZone: string;
};

export function MerchantOrderCard({ merchantId, order, now, timeZone }: Props) {
  const when = formatMerchantOrderWhen(order.createdAt, now, timeZone);
  const total = formatMoneyCentsArs(moneyCents(order.money.totalCents));
  const ageText =
    when.ageLabel === when.clockLabel
      ? when.clockLabel
      : `${when.ageLabel} · ${when.clockLabel}`;

  return (
    <article className="min-w-0 space-y-2 break-words rounded-lg border border-border bg-white/50 p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold tracking-tight">
          #{order.shortRef}
        </h3>
        <p className="text-sm text-muted">{ageText}</p>
      </header>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">Cliente</dt>
        <dd className="min-w-0 break-words">{order.customer.name}</dd>
        <dt className="text-muted">Total</dt>
        <dd className="min-w-0 break-words font-medium">{total}</dd>
        <dt className="text-muted">Modalidad</dt>
        <dd className="min-w-0 break-words">{order.fulfillmentLabel}</dd>
        <dt className="text-muted">Estado</dt>
        <dd className="min-w-0 break-words">{order.statusLabel}</dd>
      </dl>
      <p>
        <Link
          href={`/merchant/${merchantId}/orders/${order.orderId}`}
          className="text-sm font-medium text-accent underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Ver pedido
        </Link>
      </p>
    </article>
  );
}
