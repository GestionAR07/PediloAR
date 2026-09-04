import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  hasCompleteCustomerContact,
  missingCustomerContactFields,
  sanitizeCustomerDestination,
  type CustomerContactField,
} from "@/application/customer/profile";
import { getCustomerAccountContextApp } from "@/application/customer/wiring";
import { APP_NAME } from "@/lib/app-info";
import { loadCustomerPage } from "../_lib/load-customer";
import { CustomerProfileForm } from "./profile-form";

export const metadata: Metadata = { title: `Mis datos · ${APP_NAME}` };

function profileCompletionCopy(
  required: boolean,
  missing: readonly CustomerContactField[],
): { title: string; body: string } {
  if (!required) {
    return {
      title: "Mis datos",
      body: "Mantené actualizados los datos que usamos en tus pedidos.",
    };
  }
  if (missing.length === 1 && missing[0] === "phone") {
    return {
      title: "Completá tu teléfono",
      body: "Tu cuenta ya existe. Solo falta un teléfono de contacto para coordinar pedidos.",
    };
  }
  if (missing.length === 1 && missing[0] === "name") {
    return {
      title: "Completá tu nombre",
      body: "Tu cuenta ya existe. Completá el nombre que vamos a usar en tus pedidos.",
    };
  }
  return {
    title: "Completá tus datos",
    body: "Antes de continuar necesitamos un nombre y un teléfono de contacto.",
  };
}

export default async function CustomerProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; required?: string; missing?: string }>;
}) {
  const params = await searchParams;
  const destination = sanitizeCustomerDestination(params.next);
  const context = await loadCustomerPage(getCustomerAccountContextApp);
  const required = params.required === "1";

  if (required && hasCompleteCustomerContact(context.profile)) {
    redirect(destination);
  }

  const missing = missingCustomerContactFields(context.profile);
  const collectName = !required || missing.includes("name");
  const collectPhone = !required || missing.includes("phone");
  const copy = profileCompletionCopy(required, missing);

  return (
    <section className="mx-auto max-w-xl rounded-[1.75rem] border border-sky-100/80 bg-white p-6 shadow-soft sm:p-8">
      <p className="text-xs font-bold tracking-wider text-[#083F66] uppercase">
        Mi cuenta
      </p>
      <h1 className="font-display mt-1 text-3xl font-extrabold text-[var(--ps-night-900)]">
        {copy.title}
      </h1>
      <p className="mt-2 text-sm text-muted">{copy.body}</p>
      <CustomerProfileForm
        displayName={context.profile.displayName ?? ""}
        phone={context.profile.phone ?? ""}
        nextPath={destination}
        collectName={collectName}
        collectPhone={collectPhone}
      />
    </section>
  );
}
