import { redirect } from "next/navigation";
import { logoutAction } from "@/app/login/actions";
import { isAuthzError } from "@/server/auth/errors";
import { requirePlatformAdmin } from "@/server/auth/authorization";
import type { AuthorizedContext } from "@/server/auth/authorization";

export const dynamic = "force-dynamic";

async function loadAdminContext(): Promise<AuthorizedContext> {
  try {
    return await requirePlatformAdmin();
  } catch (error) {
    if (isAuthzError(error)) {
      if (error.code === "UNAUTHENTICATED" || error.code === "CONFIG_MISSING") {
        redirect("/login?next=/admin");
      }
      redirect("/login?next=/admin&error=forbidden");
    }
    throw error;
  }
}

export default async function AdminPage() {
  const { profile, user } = await loadAdminContext();

  return (
    <main className="flex flex-1 flex-col gap-6 border-t border-border pt-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Administración Marketplace Rawson
        </h1>
        <p className="text-sm text-muted">Acceso administrativo validado</p>
      </header>

      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-muted">Usuario</dt>
          <dd>{user.email ?? user.id}</dd>
        </div>
        <div>
          <dt className="text-muted">Rol de plataforma</dt>
          <dd>{profile.platformRole}</dd>
        </div>
        <div>
          <dt className="text-muted">Estado</dt>
          <dd>{profile.status}</dd>
        </div>
      </dl>

      <form action={logoutAction}>
        <button
          type="submit"
          className="rounded-md border border-border px-3 py-2 text-sm"
        >
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}
