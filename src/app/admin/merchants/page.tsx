import Link from "next/link";
import { loadAdminContext } from "../_lib/load-admin";
import { listMerchantsForAdmin } from "@/infrastructure/db/repositories/merchant-repository";

export const dynamic = "force-dynamic";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export default async function AdminMerchantsPage() {
  await loadAdminContext("/admin/merchants");
  const merchants = await listMerchantsForAdmin();

  return (
    <main className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Comercios</h1>
          <p className="text-sm text-muted">
            Listado operativo. Los comercios nuevos se crean en DRAFT.
          </p>
        </div>
        <Link
          href="/admin/merchants/new"
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"
        >
          Nuevo comercio
        </Link>
      </header>

      {merchants.length === 0 ? (
        <p className="text-sm text-muted">
          Todavía no hay comercios. Creá el primero con “Nuevo comercio”.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-3 font-medium">Nombre</th>
                <th className="py-2 pr-3 font-medium">Ciudad</th>
                <th className="py-2 pr-3 font-medium">Zona</th>
                <th className="py-2 pr-3 font-medium">Estado</th>
                <th className="py-2 pr-3 font-medium">Retiro</th>
                <th className="py-2 pr-3 font-medium">Delivery propio</th>
                <th className="py-2 pr-3 font-medium">Owners</th>
                <th className="py-2 font-medium">Creado</th>
              </tr>
            </thead>
            <tbody>
              {merchants.map((merchant) => (
                <tr key={merchant.id} className="border-b border-border">
                  <td className="py-2 pr-3">
                    <Link
                      href={`/admin/merchants/${merchant.id}`}
                      className="text-accent underline-offset-4 hover:underline"
                    >
                      {merchant.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-3">{merchant.cityName}</td>
                  <td className="py-2 pr-3">{merchant.zoneName}</td>
                  <td className="py-2 pr-3">{merchant.status}</td>
                  <td className="py-2 pr-3">
                    {merchant.pickupEnabled ? "Sí" : "No"}
                  </td>
                  <td className="py-2 pr-3">
                    {merchant.merchantDeliveryEnabled ? "Sí" : "No"}
                  </td>
                  <td className="py-2 pr-3">{merchant.ownerCount}</td>
                  <td className="py-2">{formatDate(merchant.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
