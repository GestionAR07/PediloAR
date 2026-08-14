import { moneyCents } from "@/domain/money/money-cents";
import { formatMoneyCentsArs } from "@/lib/format-money";
import { formatMerchantOrderWhen } from "@/lib/format-local-time";
import type { MerchantOrderView } from "@/application/merchant/order-inbox";
import { MerchantPendingOrderActions } from "./merchant-pending-order-actions";

type Props = {
  merchantId: string;
  order: MerchantOrderView;
  now: Date;
  timeZone: string;
};

export function MerchantOrderDetail({
  merchantId,
  order,
  now,
  timeZone,
}: Props) {
  const when = formatMerchantOrderWhen(order.createdAt, now, timeZone);
  const total = formatMoneyCentsArs(moneyCents(order.money.totalCents));
  const subtotal = formatMoneyCentsArs(
    moneyCents(order.money.orderSubtotalCents),
  );
  const deliveryFee = formatMoneyCentsArs(
    moneyCents(order.money.deliveryFeeCents),
  );
  const ageText =
    when.ageLabel === when.clockLabel
      ? when.clockLabel
      : `${when.ageLabel} · ${when.clockLabel}`;

  return (
    <article className="flex min-w-0 flex-col gap-6 break-words">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Pedido #{order.shortRef}
        </h1>
        <p className="text-sm text-muted">
          {ageText} · {order.statusLabel}
        </p>
        {order.status === "PENDING" ? (
          <MerchantPendingOrderActions
            merchantId={merchantId}
            orderId={order.orderId}
          />
        ) : null}
      </header>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Cliente</h2>
        <p className="text-sm">{order.customer.name}</p>
        <p className="text-sm">{order.customer.phone}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Productos</h2>
        <ul className="space-y-3">
          {order.items.map((item, index) => (
            <li key={`${item.productName}-${index}`} className="text-sm">
              <p className="font-medium">
                {item.quantity} × {item.productName}
              </p>
              {item.options.length > 0 ? (
                <ul className="mt-1 space-y-0.5 text-muted">
                  {item.options.map((option) => (
                    <li key={`${option.groupName}-${option.choiceName}`}>
                      {option.groupName}: {option.choiceName}
                    </li>
                  ))}
                </ul>
              ) : null}
              {item.notes ? (
                <p className="mt-1 text-muted">Nota: {item.notes}</p>
              ) : null}
              <p className="mt-1">
                {formatMoneyCentsArs(moneyCents(item.lineTotalCents))}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Pago</h2>
        <p className="text-sm">{order.payment.label}</p>
        {order.payment.instructions.trim() ? (
          <p className="text-sm text-muted">{order.payment.instructions}</p>
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Entrega</h2>
        {order.fulfillmentMethod === "PICKUP" || !order.delivery ? (
          <p className="text-sm">Retiro en el comercio</p>
        ) : (
          <div className="space-y-1 text-sm">
            <p>Envío a domicilio</p>
            <p>Estado del envío: {order.delivery.statusLabel}</p>
            {order.delivery.zoneName || order.delivery.cityName ? (
              <p>
                {[order.delivery.zoneName, order.delivery.cityName]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            ) : null}
            <p>
              {order.delivery.street} {order.delivery.number}
              {order.delivery.floorApartment
                ? `, ${order.delivery.floorApartment}`
                : ""}
            </p>
            {order.delivery.reference ? (
              <p>Referencia: {order.delivery.reference}</p>
            ) : null}
            {order.delivery.estimatedMinutes != null &&
            order.delivery.estimatedMinutes > 0 ? (
              <p>Tiempo estimado: {order.delivery.estimatedMinutes} min</p>
            ) : null}
          </div>
        )}
      </section>

      <section className="space-y-1 text-sm">
        <h2 className="text-lg font-semibold">Totales</h2>
        <p>Subtotal {subtotal}</p>
        {order.money.deliveryFeeCents > 0 ? <p>Envío {deliveryFee}</p> : null}
        <p className="font-medium">Total {total}</p>
      </section>

      {order.cancellation ? (
        <section className="space-y-1 text-sm">
          <h2 className="text-lg font-semibold">Cancelación</h2>
          <p>{order.cancellation.headline}</p>
          {order.cancellation.detail ? (
            <p className="text-muted">{order.cancellation.detail}</p>
          ) : null}
        </section>
      ) : null}
    </article>
  );
}
