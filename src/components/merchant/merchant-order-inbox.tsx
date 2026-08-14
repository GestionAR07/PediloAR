import type { ReactNode } from "react";
import type { MerchantInboxView } from "@/application/merchant/order-inbox";
import { MerchantOrderCard } from "./merchant-order-card";

type Props = {
  merchantId: string;
  inbox: MerchantInboxView;
  now: Date;
  timeZone: string;
};

function Section({
  title,
  countLabel,
  children,
}: {
  title: string;
  countLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {countLabel ? <p className="text-sm text-muted">{countLabel}</p> : null}
      </header>
      {children}
    </section>
  );
}

function OrderList({
  merchantId,
  orders,
  now,
  timeZone,
  empty,
}: {
  merchantId: string;
  orders: MerchantInboxView["attention"];
  now: Date;
  timeZone: string;
  empty: string;
}) {
  if (orders.length === 0) {
    return <p className="text-sm text-muted">{empty}</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {orders.map((order) => (
        <MerchantOrderCard
          key={order.orderId}
          merchantId={merchantId}
          order={order}
          now={now}
          timeZone={timeZone}
        />
      ))}
    </div>
  );
}

export function MerchantOrderInbox({
  merchantId,
  inbox,
  now,
  timeZone,
}: Props) {
  const openCount =
    inbox.attention.length + inbox.preparing.length + inbox.ready.length;

  return (
    <div className="flex flex-col gap-8">
      <Section
        title="ATENCIÓN"
        countLabel={`Pedidos nuevos (${inbox.attention.length})`}
      >
        <OrderList
          merchantId={merchantId}
          orders={inbox.attention}
          now={now}
          timeZone={timeZone}
          empty="No hay pedidos nuevos."
        />
      </Section>

      <Section title="EN PREPARACIÓN">
        <OrderList
          merchantId={merchantId}
          orders={inbox.preparing}
          now={now}
          timeZone={timeZone}
          empty="No hay pedidos en preparación."
        />
      </Section>

      <Section title="LISTOS">
        <OrderList
          merchantId={merchantId}
          orders={inbox.ready}
          now={now}
          timeZone={timeZone}
          empty="No hay pedidos listos."
        />
      </Section>

      <Section title="HOY">
        <OrderList
          merchantId={merchantId}
          orders={inbox.today}
          now={now}
          timeZone={timeZone}
          empty="No hay pedidos cerrados hoy."
        />
      </Section>

      {openCount === 0 ? (
        <p className="text-sm text-muted">No tenés pedidos en curso.</p>
      ) : null}
    </div>
  );
}
