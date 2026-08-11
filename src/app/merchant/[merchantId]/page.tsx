import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/login/actions";
import { isAuthzError } from "@/server/auth/errors";
import { requireMerchantMembership } from "@/server/auth/authorization";
import { findMerchantDetailForMember } from "@/infrastructure/db/repositories/merchant-repository";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ merchantId: string }>;
};

async function loadMerchant(merchantId: string) {
  try {
    const context = await requireMerchantMembership(merchantId);
    const merchant = await findMerchantDetailForMember(
      merchantId,
      context.user.id,
    );
    if (!merchant) {
      redirect("/login?next=/merchant&error=forbidden");
    }
    return { ...context, merchant };
  } catch (error) {
    if (isAuthzError(error)) {
      if (error.code === "UNAUTHENTICATED" || error.code === "CONFIG_MISSING") {
        redirect(`/login?next=/merchant/${merchantId}`);
      }
      redirect("/login?next=/merchant&error=forbidden");
    }
    throw error;
  }
}

export default async function MerchantDetailPage({ params }: PageProps) {
  const { merchantId } = await params;
  const { user, membership, merchant } = await loadMerchant(merchantId);

  return (
    <main className="flex flex-1 flex-col gap-6 border-t border-border pt-10">
      <header className="space-y-2">
        <p className="text-sm">
          <Link
            href="/merchant"
            className="text-accent underline-offset-4 hover:underline"
          >
            ← Mi comercio
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {merchant.name}
        </h1>
        <p className="text-sm text-muted">
          Panel operativo mínimo (sin catálogo ni pedidos).
        </p>
      </header>

      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-muted">Rol</dt>
          <dd>{membership.role}</dd>
        </div>
        <div>
          <dt className="text-muted">Estado del comercio</dt>
          <dd>{merchant.status}</dd>
        </div>
        <div>
          <dt className="text-muted">Ubicación</dt>
          <dd>
            {merchant.cityName} / {merchant.zoneName}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Usuario</dt>
          <dd>{user.email ?? user.id}</dd>
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
