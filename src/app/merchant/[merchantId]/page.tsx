import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/login/actions";
import { listMerchantInboxApp } from "@/application/merchant/order-inbox-wiring";
import { MerchantInboxRealtime } from "@/components/merchant/merchant-inbox-realtime";
import { MerchantOrderInbox } from "@/components/merchant/merchant-order-inbox";
import { isAuthzError } from "@/server/auth/errors";
import { requireMerchantMembership } from "@/server/auth/authorization";
import { findMerchantDetailForMember } from "@/infrastructure/db/repositories/merchant-repository";
import { getMerchantOperationalStatus } from "@/domain/merchant/operational-availability";
import type { MerchantStatus } from "@/domain/merchant/enums";
import { formatInstantAsLocalTime } from "@/lib/format-local-time";
import { getMerchantOperationalPresentation } from "@/lib/merchant-operational-presentation";
import {
  pauseMerchantOrdersManualAction,
  pauseMerchantOrdersTemporaryAction,
  resumeMerchantOrdersAction,
} from "./actions";
import { MerchantOrderStatusPanel } from "./merchant-order-status-panel";

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
  const now = new Date();
  const operationalStatus = getMerchantOperationalStatus(
    {
      status: merchant.status as MerchantStatus,
      acceptingOrders: merchant.acceptingOrders,
      pausedUntil: merchant.pausedUntil,
    },
    now,
  );
  const resumesAtLabel =
    merchant.pausedUntil && operationalStatus === "TEMPORARILY_PAUSED"
      ? formatInstantAsLocalTime(merchant.pausedUntil, merchant.cityTimezone)
      : null;
  const presentation = getMerchantOperationalPresentation({
    operationalStatus,
    merchantStatus: merchant.status as MerchantStatus,
    resumesAtLabel,
  });

  let inbox = null;
  let inboxError: string | null = null;
  try {
    const listed = await listMerchantInboxApp(
      merchantId,
      merchant.cityTimezone,
    );
    if (listed.ok) {
      inbox = listed.value;
    } else {
      inboxError = listed.error.message;
    }
  } catch (error) {
    if (isAuthzError(error)) {
      redirect("/login?next=/merchant&error=forbidden");
    }
    inboxError = "No pudimos cargar los pedidos.";
  }

  const hasPending = (inbox?.attention.length ?? 0) > 0;
  const settingsNav = (
    <nav className="flex flex-col gap-2 text-sm sm:flex-row">
      <Link
        href={`/merchant/${merchantId}/profile`}
        className="inline-flex rounded-md border border-border px-4 py-3 font-medium text-accent underline-offset-4 hover:underline"
      >
        Portada del comercio →
      </Link>
      <Link
        href={`/merchant/${merchantId}/catalog`}
        className="inline-flex rounded-md border border-border px-4 py-3 font-medium text-accent underline-offset-4 hover:underline"
      >
        Gestionar catálogo →
      </Link>
      <Link
        href={`/merchant/${merchantId}/payment-methods`}
        className="inline-flex rounded-md border border-border px-4 py-3 font-medium text-accent underline-offset-4 hover:underline"
      >
        Medios de pago →
      </Link>
      <Link
        href={`/merchant/${merchantId}/delivery`}
        className="inline-flex rounded-md border border-border px-4 py-3 font-medium text-accent underline-offset-4 hover:underline"
      >
        Envíos y zonas →
      </Link>
    </nav>
  );
  const inboxBlock = inboxError ? (
    <p className="text-sm text-muted">{inboxError}</p>
  ) : inbox ? (
    <MerchantOrderInbox
      merchantId={merchantId}
      inbox={inbox}
      now={now}
      timeZone={merchant.cityTimezone}
    />
  ) : null;

  return (
    <main className="flex flex-1 flex-col gap-6 border-t border-border pt-10">
      <MerchantInboxRealtime merchantId={merchantId} />
      <header className="space-y-2">
        <p className="text-sm">
          <Link
            href="/"
            className="text-accent underline-offset-4 hover:underline"
          >
            ← Marketplace
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {merchant.name}
        </h1>
        <p className="text-sm text-muted">Panel operativo del comercio.</p>
      </header>

      <MerchantOrderStatusPanel
        merchantId={merchantId}
        operationalStatus={operationalStatus}
        presentation={presentation}
        pauseTemporaryAction={pauseMerchantOrdersTemporaryAction}
        pauseManualAction={pauseMerchantOrdersManualAction}
        resumeAction={resumeMerchantOrdersAction}
      />

      {hasPending ? (
        <>
          {inboxBlock}
          {settingsNav}
        </>
      ) : (
        <>
          {settingsNav}
          {inboxBlock}
        </>
      )}

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
