import type { Metadata } from "next";
import { listCustomerOrdersApp } from "@/application/customer/wiring";
import { CustomerOrderCard } from "@/components/customer/customer-order-card";
import { APP_NAME } from "@/lib/app-info";
import { loadCompleteCustomerPage } from "../_lib/load-customer";

export const metadata: Metadata = { title: `Mis pedidos · ${APP_NAME}` };

export default async function CustomerOrdersPage() {
  const { orders } = await loadCompleteCustomerPage(
    listCustomerOrdersApp,
    "/cuenta/pedidos",
  );
  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-bold tracking-wider text-violet-700 uppercase">
          Mi cuenta
        </p>
        <h1 className="font-display mt-1 text-3xl font-extrabold tracking-tight text-[var(--ps-night-900)]">
          Mis pedidos
        </h1>
        <p className="mt-2 text-sm text-muted">
          Pedidos en curso e historial de compras.
        </p>
      </header>
      {!orders.ok ? (
        <p
          className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
          role="alert"
        >
          {orders.error.message}
        </p>
      ) : orders.value.active.length === 0 &&
        orders.value.history.length === 0 ? (
        <p className="rounded-[1.5rem] border border-violet-100 bg-white p-6 text-sm text-muted shadow-soft">
          Todavía no realizaste pedidos con esta cuenta.
        </p>
      ) : (
        <>
          {orders.value.active.length > 0 ? (
            <section className="space-y-4">
              <h2 className="font-display text-xl font-extrabold">En curso</h2>
              <div className="grid gap-4 lg:grid-cols-2">
                {orders.value.active.map((order) => (
                  <CustomerOrderCard key={order.orderId} order={order} />
                ))}
              </div>
            </section>
          ) : null}
          {orders.value.history.length > 0 ? (
            <section className="space-y-4">
              <h2 className="font-display text-xl font-extrabold">Historial</h2>
              <div className="grid gap-4 lg:grid-cols-2">
                {orders.value.history.map((order) => (
                  <CustomerOrderCard key={order.orderId} order={order} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
