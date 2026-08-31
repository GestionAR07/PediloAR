import Link from "next/link";
import { loadAdminContext } from "../_lib/load-admin";
import { listMerchantApplicationsForAdmin } from "@/infrastructure/db/repositories/merchant-application-repository";

export const dynamic = "force-dynamic";

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

export default async function AdminMerchantApplicationsPage() {
  await loadAdminContext("/admin/merchant-applications");
  const applications = await listMerchantApplicationsForAdmin();

  return (
    <main className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Solicitudes</h1>
        <p className="text-sm text-muted">
          Solicitudes de comercios pendientes de revisión administrativa.
        </p>
      </header>

      {applications.length === 0 ? (
        <p className="text-sm text-muted">No hay solicitudes registradas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-3 font-medium">Comercio</th>
                <th className="py-2 pr-3 font-medium">Contacto</th>
                <th className="py-2 pr-3 font-medium">Ciudad / Zona</th>
                <th className="py-2 pr-3 font-medium">Estado</th>
                <th className="py-2 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => (
                <tr key={application.id} className="border-b border-border">
                  <td className="py-2 pr-3">
                    <Link
                      href={`/admin/merchant-applications/${application.id}`}
                      className="text-accent underline-offset-4 hover:underline"
                    >
                      {application.businessName}
                    </Link>
                  </td>
                  <td className="py-2 pr-3">
                    <p>{application.contactName}</p>
                    <p className="text-muted">{application.contactEmail}</p>
                  </td>
                  <td className="py-2 pr-3">
                    {application.cityName} / {application.zoneName}
                  </td>
                  <td className="py-2 pr-3">
                    {formatApplicationStatus(application.status)}
                  </td>
                  <td className="py-2">{formatDate(application.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
