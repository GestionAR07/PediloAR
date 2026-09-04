import Link from "next/link";
import { redirect } from "next/navigation";
import { PublicBrandWordmark } from "@/components/storefront/public-brand-wordmark";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import { hasSupabasePublicConfig } from "@/infrastructure/supabase/env";
import { SetPasswordForm } from "./set-password-form";

export const dynamic = "force-dynamic";

type SetPasswordPageProps = {
  searchParams: Promise<{ flow?: string }>;
};

export default async function SetPasswordPage({
  searchParams,
}: SetPasswordPageProps) {
  if (!hasSupabasePublicConfig()) {
    redirect("/login?error=auth_config");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/set-password");
  }

  const params = await searchParams;
  const recoveryMode = params.flow === "recovery";

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
          Establecer contraseña
        </h1>
        <p className="mt-2 text-sm text-muted">
          Elegí una contraseña nueva para seguir usando Pedilo.
        </p>
        <div className="mt-7">
          <SetPasswordForm recoveryMode={recoveryMode} />
        </div>
      </section>
    </main>
  );
}
