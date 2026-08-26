import type { Metadata } from "next";
import Link from "next/link";
import { listCustomerOrdersApp } from "@/application/customer/wiring";
import { CustomerOrderCard } from "@/components/customer/customer-order-card";
import { logoutAction } from "@/app/login/actions";
import { APP_NAME } from "@/lib/app-info";
import { loadCompleteCustomerPage } from "./_lib/load-customer";

export const metadata: Metadata = { title: `Mi cuenta · ${APP_NAME}` };

export default async function CustomerAccountPage() {
  const { context, orders } = await loadCompleteCustomerPage(
    listCustomerOrdersApp,
    "/cuenta",
  );
  const displayName = context.profile.displayName?.trim() || "tu cuenta";

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold tracking-wider text-violet-700 uppercase">
            Mi cuenta
          </p>
          <h1 className="font-display mt-1 text-3xl font-extrabold tracking-tight text-[var(--ps-night-900)]">
            Hola, {displayName}
          </h1>
          <p className="mt-2 text-sm text-muted">
            Seguí tus pedidos y consultá tu historial desde un solo lugar.
          </p>
        </div>
        <form action={logoutAction}>
          <button className="min-h-11 rounded-full border border-violet-100 bg-white px-4 text-sm font-bold text-violet-800 hover:bg-violet-50">
            Cerrar sesión
          </button>
        </form>
      </header>

      {!orders.ok ? (
        <p
          className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
          role="alert"
        >
          {orders.error.message}
        </p>
      ) : orders.value.active.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-xl font-extrabold text-[var(--ps-night-900)]">
              Pedidos en curso
            </h2>
            <Link
              href="/cuenta/pedidos"
              className="text-sm font-bold text-violet-800 hover:underline"
            >
              Ver todos
            </Link>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {orders.value.active.map((order) => (
              <CustomerOrderCard key={order.orderId} order={order} />
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-[1.75rem] border border-violet-100/80 bg-white p-7 text-center shadow-soft">
          <h2 className="font-display text-xl font-extrabold text-[var(--ps-night-900)]">
            No tenés pedidos en curso
          </h2>
          <p className="mt-2 text-sm text-muted">
            Cuando confirmes una compra, vas a poder seguirla desde acá.
          </p>
          <Link
            href="/"
            className="grad-btn mt-5 inline-flex min-h-12 items-center rounded-full px-6 text-sm font-extrabold text-white shadow-glow"
          >
            Explorar comercios
          </Link>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-[1.5rem] border border-violet-100/80 bg-white p-5 shadow-soft">
          <p className="text-xs font-bold tracking-wider text-violet-700 uppercase">
            Email
          </p>
          <p className="mt-2 break-all font-bold text-[var(--ps-night-900)]">
            {context.user.email ?? "Sin email"}
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-violet-100/80 bg-white p-5 shadow-soft">
          <p className="text-xs font-bold tracking-wider text-violet-700 uppercase">
            Teléfono
          </p>
          <p className="mt-2 font-bold text-[var(--ps-night-900)]">
            {context.profile.phone ?? "Todavía no informado"}
          </p>
        </div>
      </section>
    </div>
  );
}
