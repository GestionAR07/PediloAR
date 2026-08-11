import Link from "next/link";
import { notFound } from "next/navigation";
import { loadAdminContext } from "../../_lib/load-admin";
import {
  findMerchantDetailById,
  listMerchantMembers,
} from "@/infrastructure/db/repositories/merchant-repository";
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

  const members = await listMerchantMembers(merchantId);

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
    </main>
  );
}
