import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomerOrderApp } from "@/application/customer/wiring";
import { CustomerOrderAutoRefresh } from "@/components/customer/customer-order-auto-refresh";
import { moneyCents } from "@/domain/money/money-cents";
import { formatMoneyCentsArs } from "@/lib/format-money";
import { APP_NAME } from "@/lib/app-info";
import { loadCompleteCustomerPage } from "../../_lib/load-customer";

export const metadata: Metadata = { title: `Detalle del pedido · ${APP_NAME}` };

function money(cents: number) {
  return formatMoneyCentsArs(moneyCents(cents));
}
function date(value: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function CustomerOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const { order } = await loadCompleteCustomerPage(
    () => getCustomerOrderApp(orderId),
    `/cuenta/pedidos/${encodeURIComponent(orderId)}`,
  );
  if (!order.ok) {
    if (order.error.code === "ORDER_NOT_FOUND") notFound();
    return (
      <p
        className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
        role="alert"
      >
        {order.error.message}
      </p>
    );
  }
  const view = order.value;
  return (
    <div className="space-y-6">
      <Link
        href="/cuenta/pedidos"
        className="text-sm font-bold text-[#083F66] hover:underline"
      >
        ← Volver a mis pedidos
      </Link>
      <header className="rounded-[1.75rem] border border-sky-100/80 bg-white p-6 shadow-soft">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold tracking-wider text-[#083F66] uppercase">
              Pedido {view.orderRef}
            </p>
            <h1 className="font-display mt-1 text-3xl font-extrabold text-[var(--ps-night-900)]">
              {view.merchantName}
            </h1>
            <p className="mt-2 text-sm text-muted">
              Realizado el {date(view.createdAt)}
            </p>
          </div>
          <span
            className={`w-fit rounded-full px-4 py-2 text-sm font-extrabold ${view.active ? "bg-sky-100 text-[#083F66]" : view.status === "CANCELED" ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}
          >
            {view.statusLabel}
          </span>
        </div>
        <p className="mt-5 text-sm font-medium">{view.statusDetail}</p>
        <div className="mt-2">
          <CustomerOrderAutoRefresh active={view.active} />
        </div>
      </header>

      {view.cancellation ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-950">
          <h2 className="font-bold">{view.cancellation.headline}</h2>
          {view.cancellation.detail ? (
            <p className="mt-1 text-sm">{view.cancellation.detail}</p>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.8fr)]">
        <div className="space-y-6">
          <section className="rounded-[1.75rem] border border-sky-100/80 bg-white p-6 shadow-soft">
            <h2 className="font-display text-xl font-extrabold">Tu pedido</h2>
            <ul className="mt-4 divide-y divide-sky-100">
              {view.items.map((item) => (
                <li key={item.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex justify-between gap-4">
                    <span className="font-bold">
                      {item.quantity} × {item.name}
                    </span>
                    <span className="font-bold tabular-nums">
                      {money(item.lineTotalCents)}
                    </span>
                  </div>
                  {item.options.length > 0 ? (
                    <ul className="mt-1 space-y-1 text-xs text-muted">
                      {item.options.map((option, index) => (
                        <li
                          key={`${option.groupName}-${option.choiceName}-${index}`}
                        >
                          {option.groupName}: {option.choiceName}
                          {option.quantity > 1 ? ` × ${option.quantity}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
            <dl className="mt-5 space-y-2 border-t border-sky-100 pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd>{money(view.money.orderSubtotalCents)}</dd>
              </div>
              {view.money.deliveryFeeCents > 0 ? (
                <div className="flex justify-between">
                  <dt className="text-muted">Envío</dt>
                  <dd>{money(view.money.deliveryFeeCents)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between text-lg font-extrabold">
                <dt>Total</dt>
                <dd>{money(view.money.totalCents)}</dd>
              </div>
            </dl>
          </section>
          <section className="rounded-[1.75rem] border border-sky-100/80 bg-white p-6 shadow-soft">
            <h2 className="font-display text-xl font-extrabold">Seguimiento</h2>
            <ol className="mt-5 space-y-5">
              {view.timeline.map((event, index) => (
                <li
                  key={`${event.status}-${event.createdAt.toISOString()}-${index}`}
                  className="relative pl-8 before:absolute before:top-2 before:left-1 before:h-3 before:w-3 before:rounded-full before:bg-[#20AEE5] after:absolute after:top-5 after:bottom-[-1.5rem] after:left-[0.55rem] after:w-px after:bg-sky-200 last:after:hidden"
                >
                  <p className="font-bold">{event.label}</p>
                  <p className="text-sm text-muted">{event.detail}</p>
                  <p className="mt-1 text-xs text-muted">
                    {date(event.createdAt)}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <aside className="space-y-4">
          {view.delivery ? (
            <section className="rounded-[1.5rem] border border-sky-100/80 bg-white p-5 shadow-soft">
              <h2 className="font-display text-lg font-extrabold">Entrega</h2>
              <p className="mt-3 font-bold text-[#083F66]">
                {view.delivery.statusLabel}
              </p>
              <p className="mt-2 text-sm">{view.delivery.addressLabel}</p>
              {view.delivery.reference ? (
                <p className="mt-2 text-xs text-muted">
                  Referencia: {view.delivery.reference}
                </p>
              ) : null}
            </section>
          ) : (
            <section className="rounded-[1.5rem] border border-sky-100/80 bg-white p-5 shadow-soft">
              <h2 className="font-display text-lg font-extrabold">Retiro</h2>
              <p className="mt-2 text-sm text-muted">
                Retirás el pedido en el comercio.
              </p>
            </section>
          )}
          <section className="rounded-[1.5rem] border border-sky-100/80 bg-white p-5 shadow-soft">
            <h2 className="font-display text-lg font-extrabold">Pago</h2>
            <p className="mt-3 font-bold">{view.payment.label}</p>
            {view.payment.instructions ? (
              <p className="mt-2 text-sm text-muted">
                {view.payment.instructions}
              </p>
            ) : null}
          </section>
          <section className="rounded-[1.5rem] border border-sky-100/80 bg-white p-5 shadow-soft">
            <h2 className="font-display text-lg font-extrabold">Contacto</h2>
            <p className="mt-3 text-sm font-bold">{view.contact.name}</p>
            <p className="text-sm text-muted">{view.contact.phone}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
