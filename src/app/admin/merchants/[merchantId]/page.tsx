import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getMerchantActivationBlockers,
  MERCHANT_ACTIVATION_BLOCKER_LABELS,
} from "@/application/merchant/activate-merchant";
import { findMerchantActivationReadiness } from "@/infrastructure/db/repositories/merchant-activation-repository";
import {
  findMerchantDetailById,
  listMerchantMembers,
} from "@/infrastructure/db/repositories/merchant-repository";
import { loadAdminContext } from "../../_lib/load-admin";
import { ActivateMerchantForm } from "../activate-merchant-form";
import { InviteOwnerForm } from "../invite-owner-form";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ merchantId: string }>;
};

export default async function AdminMerchantDetailPage({ params }: PageProps) {
  const { merchantId } = await params;
  await loadAdminContext(`/admin/merchants/${merchantId}`);

  const merchant = await findMerchantDetailById(merchantId);
  if (!merchant) {
    notFound();
  }

  const [members, readiness] = await Promise.all([
    listMerchantMembers(merchantId),
    findMerchantActivationReadiness(merchantId),
  ]);
  const blockers = readiness ? getMerchantActivationBlockers(readiness) : [];
  const activationReady = Boolean(
    readiness && merchant.status === "DRAFT" && blockers.length === 0,
  );

  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm">
          <Link
            href="/admin/merchants"
            className="text-accent underline-offset-4 hover:underline"
          >
            ← Comercios
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {merchant.name}
        </h1>
        <p className="text-sm text-muted">Detalle operativo del comercio</p>
      </header>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">Slug</dt>
          <dd>{merchant.slug}</dd>
        </div>
        <div>
          <dt className="text-muted">Estado</dt>
          <dd>{merchant.status}</dd>
        </div>
        <div>
          <dt className="text-muted">Ciudad</dt>
          <dd>{merchant.cityName}</dd>
        </div>
        <div>
          <dt className="text-muted">Zona</dt>
          <dd>{merchant.zoneName}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted">Descripción</dt>
          <dd>{merchant.description || "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Retiro</dt>
          <dd>{merchant.pickupEnabled ? "Sí" : "No"}</dd>
        </div>
        <div>
          <dt className="text-muted">Delivery propio</dt>
          <dd>{merchant.merchantDeliveryEnabled ? "Sí" : "No"}</dd>
        </div>
        <div>
          <dt className="text-muted">Delivery plataforma</dt>
          <dd>{merchant.platformDeliveryEnabled ? "Sí" : "No"}</dd>
        </div>
        <div>
          <dt className="text-muted">Preparación (min)</dt>
          <dd>{merchant.preparationMinutes}</dd>
        </div>
      </dl>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Owners / staff</h2>
        {members.length === 0 ? (
          <p className="text-sm text-muted">Sin memberships todavía.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {members.map((member) => (
              <li key={member.id} className="border-b border-border pb-2">
                <p className="font-medium">
                  {member.displayName ?? member.userId}
                </p>
                <p className="text-muted">
                  {member.role}
                  {member.active ? "" : " (inactivo)"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-lg font-semibold">Propietario</h2>
        <p className="text-sm text-muted">
          Invitá o asigná un OWNER. La autorización viene de merchant_users, no
          de metadata.
        </p>
        <InviteOwnerForm merchantId={merchant.id} />
      </section>

      <section className="space-y-4 border-t border-border pt-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Salida a Pedilo</h2>
          <p className="text-sm text-muted">
            La activación es manual. Un borrador solo puede publicarse cuando
            tiene lo mínimo necesario para recibir un pedido real.
          </p>
        </div>

        {readiness ? (
          <ul
            className="space-y-2 text-sm"
            aria-label="Requisitos de activación"
          >
            <li>
              {readiness.activeOwnerCount > 0 ? "✓" : "○"} Propietario activo
            </li>
            <li>
              {readiness.pickupEnabled || readiness.merchantDeliveryEnabled
                ? "✓"
                : "○"}{" "}
              Retiro o delivery propio habilitado
            </li>
            {readiness.merchantDeliveryEnabled ? (
              <li>
                {readiness.activeDeliveryZoneCount > 0 ? "✓" : "○"} Zona de
                delivery activa
              </li>
            ) : null}
            <li>
              {readiness.activePaymentMethodCount > 0 ? "✓" : "○"} Medio de pago
              activo
            </li>
            <li>
              {readiness.activeCatalogProductCount > 0 ? "✓" : "○"} Producto
              publicado y disponible
            </li>
          </ul>
        ) : (
          <p className="text-sm text-red-800" role="alert">
            No se pudo calcular el estado de preparación del comercio.
          </p>
        )}

        {blockers.length > 0 && merchant.status === "DRAFT" ? (
          <div className="rounded-md border border-border p-3 text-sm">
            <p className="font-medium">Pendiente antes de activar</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
              {blockers.map((blocker) => (
                <li key={blocker}>
                  {MERCHANT_ACTIVATION_BLOCKER_LABELS[blocker]}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <ActivateMerchantForm
          merchantId={merchant.id}
          status={merchant.status}
          ready={activationReady}
        />
      </section>
    </main>
  );
}
