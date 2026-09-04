import type { Metadata } from "next";
import Link from "next/link";
import { PublicBrandWordmark } from "@/components/storefront/public-brand-wordmark";
import { APP_NAME } from "@/lib/app-info";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: `Recuperar contraseña · ${APP_NAME}`,
};

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 sm:px-6">
      <Link href="/" className="mb-8 w-fit">
        <PublicBrandWordmark size="header" tone="plain" />
      </Link>
      <section className="rounded-[1.75rem] border border-sky-100/80 bg-white p-6 shadow-soft sm:p-8">
        <p className="text-xs font-bold tracking-wider text-[var(--ps-cyan)] uppercase">
          Cuenta
        </p>
        <h1 className="font-display mt-1 text-3xl font-extrabold tracking-tight text-[var(--ps-navy)]">
          Recuperá tu contraseña
        </h1>
        <p className="mt-2 text-sm text-muted">
          Ingresá el email de tu cuenta. Si está registrado, vas a recibir un
          enlace para elegir una contraseña nueva.
        </p>
        <div className="mt-7">
          <ForgotPasswordForm />
        </div>
        <p className="mt-5 text-center text-sm text-muted">
          <Link
            href="/login"
            className="font-bold text-[var(--ps-navy)] hover:underline"
          >
            Volver a iniciar sesión
          </Link>
        </p>
      </section>
    </main>
  );
}
