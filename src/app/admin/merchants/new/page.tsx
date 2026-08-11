import Link from "next/link";
import { loadAdminContext } from "../../_lib/load-admin";
import {
  listCities,
  listZones,
} from "@/infrastructure/db/repositories/geography-repository";
import { MerchantCreateForm } from "../merchant-create-form";

export const dynamic = "force-dynamic";

export default async function NewMerchantPage() {
  await loadAdminContext("/admin/merchants/new");
  const [cities, zones] = await Promise.all([listCities(), listZones()]);

  if (cities.length === 0 || zones.length === 0) {
    return (
      <main className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Nuevo comercio
        </h1>
        <p className="text-sm text-muted">
          No hay ciudades y zonas configuradas todavía.
        </p>
        <Link
          href="/admin/geography"
          className="text-sm text-accent underline-offset-4 hover:underline"
        >
          Configurar geografía
        </Link>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Nuevo comercio
        </h1>
        <p className="text-sm text-muted">
          Onboarding asistido — el dueño se invita después.
        </p>
      </header>
      <MerchantCreateForm
        cities={cities.map((city) => ({ id: city.id, name: city.name }))}
        zones={zones.map((zone) => ({
          id: zone.id,
          cityId: zone.cityId,
          name: zone.name,
        }))}
      />
    </main>
  );
}
