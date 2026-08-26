import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  hasCompleteCustomerContact,
  sanitizeCustomerDestination,
} from "@/application/customer/profile";
import { getCustomerAccountContextApp } from "@/application/customer/wiring";
import { APP_NAME } from "@/lib/app-info";
import { loadCustomerPage } from "../_lib/load-customer";
import { CustomerProfileForm } from "./profile-form";

export const metadata: Metadata = { title: `Mis datos · ${APP_NAME}` };

export default async function CustomerProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; required?: string }>;
}) {
  const params = await searchParams;
  const destination = sanitizeCustomerDestination(params.next);
  const context = await loadCustomerPage(getCustomerAccountContextApp);
  const required = params.required === "1";

  if (required && hasCompleteCustomerContact(context.profile)) {
    redirect(destination);
  }

  return (
    <section className="mx-auto max-w-xl rounded-[1.75rem] border border-violet-100/80 bg-white p-6 shadow-soft sm:p-8">
      <p className="text-xs font-bold tracking-wider text-violet-700 uppercase">
        Mi cuenta
      </p>
      <h1 className="font-display mt-1 text-3xl font-extrabold text-[var(--ps-night-900)]">
        {required ? "Completá tus datos" : "Mis datos"}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {required
          ? "Antes de continuar necesitamos un nombre y un teléfono de contacto."
          : "Mantené actualizados los datos que usamos en tus pedidos."}
      </p>
      <CustomerProfileForm
        displayName={context.profile.displayName ?? ""}
        phone={context.profile.phone ?? ""}
        nextPath={destination}
      />
    </section>
  );
}
