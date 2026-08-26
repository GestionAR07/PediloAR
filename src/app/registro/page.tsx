import type { Metadata } from "next";
import Link from "next/link";
import { sanitizeInternalPath } from "@/lib/safe-redirect";
import { APP_NAME } from "@/lib/app-info";
import { isGoogleOAuthEnabled } from "@/config/auth-providers";
import { PublicBrandWordmark } from "@/components/storefront/public-brand-wordmark";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: `Crear cuenta · ${APP_NAME}` };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath =
    params.next && sanitizeInternalPath(params.next, "\0") !== "\0"
      ? sanitizeInternalPath(params.next)
      : undefined;
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 sm:px-6">
      <Link href="/" className="mb-8 w-fit">
        <PublicBrandWordmark size="header" tone="plain" />
      </Link>
      <section className="rounded-[1.75rem] border border-violet-100/80 bg-white p-6 shadow-soft sm:p-8">
        <p className="text-xs font-bold tracking-wider text-violet-700 uppercase">
          Cuenta de cliente
        </p>
        <h1 className="font-display mt-1 text-3xl font-extrabold text-[var(--ps-night-900)]">
          Creá tu cuenta
        </h1>
        <p className="mt-2 text-sm text-muted">
          Confirmá pedidos y seguí su estado desde tu panel.
        </p>
        <div className="mt-7">
          <RegisterForm
            nextPath={nextPath}
            googleOAuthEnabled={isGoogleOAuthEnabled()}
          />
        </div>
      </section>
    </main>
  );
}
