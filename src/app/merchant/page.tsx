import { redirect } from "next/navigation";
import { logoutAction } from "@/app/login/actions";
import { isAuthzError } from "@/server/auth/errors";
import { listActiveMerchantMemberships } from "@/server/auth/authorization";
import type { MerchantMembership } from "@/server/auth/types";
import type { AuthUser } from "@/server/auth/types";

export const dynamic = "force-dynamic";

async function loadMerchantHome(): Promise<{
  user: AuthUser;
  memberships: MerchantMembership[];
}> {
  try {
    const result = await listActiveMerchantMemberships();
    if (result.memberships.length === 0) {
      redirect("/login?next=/merchant&error=forbidden");
    }
    return { user: result.user, memberships: result.memberships };
  } catch (error) {
    if (isAuthzError(error)) {
      if (error.code === "UNAUTHENTICATED" || error.code === "CONFIG_MISSING") {
        redirect("/login?next=/merchant");
      }
      redirect("/login?next=/merchant&error=forbidden");
    }
    throw error;
  }
}

export default async function MerchantPage() {
  const { memberships, user } = await loadMerchantHome();

  return (
    <main className="flex flex-1 flex-col gap-6 border-t border-border pt-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Panel de comercio
        </h1>
        <p className="text-sm text-muted">
          Membresías activas (validación de acceso — sin catálogo ni pedidos).
        </p>
      </header>

      <p className="text-sm text-muted">Usuario: {user.email ?? user.id}</p>

      <ul className="space-y-3 text-sm">
        {memberships.map((membership) => (
          <li
            key={membership.merchantId}
            className="border-b border-border pb-3"
          >
            <p className="font-medium">{membership.merchantName}</p>
            <p className="text-muted">Rol: {membership.role}</p>
          </li>
        ))}
      </ul>

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
