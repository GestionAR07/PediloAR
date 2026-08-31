import Link from "next/link";
import { notFound } from "next/navigation";
import { normalizeSlug } from "@/lib/slug";
import { loadAdminContext } from "../../_lib/load-admin";
import { findMerchantApplicationById } from "@/infrastructure/db/repositories/merchant-application-repository";
import { ApplicationApproveForm } from "../application-approve-form";
import { ApplicationRejectForm } from "../application-reject-form";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ applicationId: string }>;
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatApplicationStatus(status: string): string {
  switch (status) {
    case "PENDING":
      return "Pendiente";
    case "APPROVED":
      return "Aprobada";
    case "REJECTED":
      return "Rechazada";
    default:
      return status;
  }
}

export default async function AdminMerchantApplicationDetailPage({
  params,
}: PageProps) {
  const { applicationId } = await params;
  await loadAdminContext(`/admin/merchant-applications/${applicationId}`);

  const application = await findMerchantApplicationById(applicationId);
  if (!application) {
    notFound();
  }

  const isPending = application.status === "PENDING";
  const isApproved = application.status === "APPROVED";
  const isRejected = application.status === "REJECTED";

  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm">
          <Link
            href="/admin/merchant-applications"
            className="text-accent underline-offset-4 hover:underline"
          >
            ← Solicitudes
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {application.businessName}
        </h1>
        <p className="text-sm text-muted">Detalle de solicitud de comercio</p>
      </header>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">Comercio</dt>
          <dd>{application.businessName}</dd>
        </div>
        <div>
          <dt className="text-muted">Estado</dt>
          <dd>{formatApplicationStatus(application.status)}</dd>
        </div>
        <div>
          <dt className="text-muted">Contacto</dt>
          <dd>{application.contactName}</dd>
        </div>
        <div>
          <dt className="text-muted">Email</dt>
          <dd>{application.contactEmail}</dd>
        </div>
        <div>
          <dt className="text-muted">Teléfono</dt>
          <dd>{application.contactPhone}</dd>
        </div>
        <div>
          <dt className="text-muted">Ciudad</dt>
          <dd>{application.cityName}</dd>
        </div>
        <div>
          <dt className="text-muted">Zona</dt>
          <dd>{application.zoneName}</dd>
        </div>
        <div>
          <dt className="text-muted">Fecha</dt>
          <dd>{formatDate(application.createdAt)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted">Descripción</dt>
          <dd>{application.description || "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted">Mensaje</dt>
          <dd>{application.message || "—"}</dd>
        </div>
      </dl>

      {isApproved ? (
        <section className="space-y-2 border-t border-border pt-6">
          <p className="text-sm">
            Estado: <span className="font-medium">Aprobada</span>
          </p>
          {application.merchantId ? (
            <p className="text-sm">
              <Link
                href={`/admin/merchants/${application.merchantId}`}
                className="text-accent underline-offset-4 hover:underline"
              >
                Ver comercio
              </Link>
            </p>
          ) : null}
        </section>
      ) : null}

      {isRejected ? (
        <section className="space-y-2 border-t border-border pt-6">
          <p className="text-sm">
            Estado: <span className="font-medium">Rechazada</span>
          </p>
          <div className="text-sm">
            <p className="text-muted">Motivo de rechazo</p>
            <p>{application.rejectionReason || "—"}</p>
          </div>
        </section>
      ) : null}

      {isPending ? (
        <>
          <section className="space-y-3 border-t border-border pt-6">
            <h2 className="text-lg font-semibold">Aprobar solicitud</h2>
            <p className="text-sm text-muted">
              Se creará un comercio en DRAFT y se vinculará a esta solicitud.
            </p>
            <ApplicationApproveForm
              applicationId={application.id}
              defaultSlug={normalizeSlug(application.businessName)}
            />
          </section>

          <section className="space-y-3 border-t border-border pt-6">
            <h2 className="text-lg font-semibold">Rechazar solicitud</h2>
            <ApplicationRejectForm applicationId={application.id} />
          </section>
        </>
      ) : null}
    </main>
  );
}
