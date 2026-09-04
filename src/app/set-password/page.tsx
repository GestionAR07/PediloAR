import { redirect } from "next/navigation";
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
    <main className="flex flex-1 flex-col gap-6 border-t border-border pt-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Establecer contraseña
        </h1>
        <p className="text-sm text-muted">
          Elegí una contraseña nueva para seguir usando Pedilo.
        </p>
      </header>
      <SetPasswordForm recoveryMode={recoveryMode} />
    </main>
  );
}
