import Link from "next/link";
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

  if (memberships.length === 1) {
    const only = memberships[0]!;
    redirect(`/merchant/${only.merchantId}`);
  }

  return (
    <main className="flex flex-1 flex-col gap-6 border-t border-border pt-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Mi comercio</h1>
        <p className="text-sm text-muted">
          Seleccioná el comercio al que querés ingresar.
        </p>
      </header>

      <p className="text-sm text-muted">Usuario: {user.email ?? user.id}</p>

      <ul className="space-y-3 text-sm">
        {memberships.map((membership) => (
          <li
            key={membership.merchantId}
            className="border-b border-border pb-3"
          >
            <Link
              href={`/merchant/${membership.merchantId}`}
              className="font-medium text-accent underline-offset-4 hover:underline"
            >
              {membership.merchantName}
            </Link>
            <p className="text-muted">
              Rol: {membership.role} · Estado: {membership.merchantStatus}
            </p>
            <p className="text-muted">
              {membership.cityName} / {membership.zoneName}
            </p>
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
