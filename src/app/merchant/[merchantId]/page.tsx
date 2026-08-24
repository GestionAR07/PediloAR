import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/login/actions";
import { listMerchantInboxApp } from "@/application/merchant/order-inbox-wiring";
import { MerchantInboxRealtime } from "@/components/merchant/merchant-inbox-realtime";
import { MerchantOrderInbox } from "@/components/merchant/merchant-order-inbox";
import { MerchantOrderSoundToggle } from "@/components/merchant/merchant-order-sound-toggle";
import { isAuthzError } from "@/server/auth/errors";
import { requireMerchantMembership } from "@/server/auth/authorization";
import { findMerchantDetailForMember } from "@/infrastructure/db/repositories/merchant-repository";
import { getMerchantOperationalStatus } from "@/domain/merchant/operational-availability";
import type { MerchantStatus } from "@/domain/merchant/enums";
import { formatInstantAsLocalTime } from "@/lib/format-local-time";
import { APP_NAME } from "@/lib/app-info";
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

function MerchantOpsNav({ merchantId }: { merchantId: string }) {
  const items = [
    { href: `/merchant/${merchantId}`, label: "Pedidos", current: true },
    { href: `/merchant/${merchantId}/catalog`, label: "Catálogo" },
    { href: `/merchant/${merchantId}/profile`, label: "Portada" },
    { href: `/merchant/${merchantId}/delivery`, label: "Envíos y zonas" },
    {
      href: `/merchant/${merchantId}/payment-methods`,
      label: "Medios de pago",
    },
  ];

  return (
    <nav className="merchant-ops-nav" aria-label="Secciones del comercio">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.current ? "page" : undefined}
          className={
            item.current
              ? "merchant-ops-nav-link merchant-ops-nav-link--active"
              : "merchant-ops-nav-link"
          }
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
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

  const accepting = operationalStatus === "ACCEPTING";

  return (
    <main className="merchant-ops-dashboard flex min-w-0 flex-1 flex-col">
      <MerchantInboxRealtime merchantId={merchantId} />

      <header className="merchant-ops-header">
        <div className="merchant-ops-header-brand min-w-0">
          <p className="merchant-ops-mark">{APP_NAME}</p>
          <h1 className="merchant-ops-title min-w-0 truncate">
            {merchant.name}
          </h1>
          <p className="merchant-ops-kicker">Panel operativo</p>
        </div>
        <div className="merchant-ops-header-tools">
          <span
            className={
              accepting
                ? "merchant-ops-badge merchant-ops-badge--live"
                : "merchant-ops-badge merchant-ops-badge--paused"
            }
          >
            {presentation.headline}
          </span>
          <Link
            href={`/comercios/${merchantId}`}
            className="merchant-ops-store-link"
          >
            Ver tienda
          </Link>
          <MerchantOrderSoundToggle />
        </div>
        <form action={logoutAction} className="merchant-ops-header-secondary">
          <button type="submit" className="merchant-ops-logout">
            Cerrar sesión
          </button>
        </form>
      </header>

      <div className="merchant-ops-layout">
        <MerchantOpsNav merchantId={merchantId} />

        <div className="merchant-ops-main min-w-0">
          {inbox ? (
            <section
              className="merchant-ops-summary"
              aria-label="Resumen de pedidos"
            >
              <article className="merchant-ops-stat">
                <p className="merchant-ops-stat-label">Nuevos</p>
                <p className="merchant-ops-stat-value">
                  {inbox.attention.length}
                </p>
              </article>
              <article className="merchant-ops-stat">
                <p className="merchant-ops-stat-label">En preparación</p>
                <p className="merchant-ops-stat-value">
                  {inbox.preparing.length}
                </p>
              </article>
              <article className="merchant-ops-stat">
                <p className="merchant-ops-stat-label">Listos</p>
                <p className="merchant-ops-stat-value">{inbox.ready.length}</p>
              </article>
              <article className="merchant-ops-stat">
                <p className="merchant-ops-stat-label">Finalizados hoy</p>
                <p className="merchant-ops-stat-value">{inbox.today.length}</p>
              </article>
            </section>
          ) : null}

          <div className="merchant-ops-workspace">
            <div className="merchant-ops-board-wrap min-w-0">{inboxBlock}</div>
            <div className="merchant-ops-side min-w-0">
              <MerchantOrderStatusPanel
                merchantId={merchantId}
                operationalStatus={operationalStatus}
                presentation={presentation}
                pauseTemporaryAction={pauseMerchantOrdersTemporaryAction}
                pauseManualAction={pauseMerchantOrdersManualAction}
                resumeAction={resumeMerchantOrdersAction}
              />
              <section className="merchant-ops-account">
                <h2>Cuenta y comercio</h2>
                <dl>
                  <div>
                    <dt>Rol</dt>
                    <dd>{membership.role}</dd>
                  </div>
                  <div>
                    <dt>Estado del comercio</dt>
                    <dd>{merchant.status}</dd>
                  </div>
                  <div>
                    <dt>Ubicación</dt>
                    <dd>
                      {merchant.cityName} / {merchant.zoneName}
                    </dd>
                  </div>
                  <div>
                    <dt>Usuario</dt>
                    <dd>{user.email ?? user.id}</dd>
                  </div>
                </dl>
              </section>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
