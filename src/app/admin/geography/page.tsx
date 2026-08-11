import { loadAdminContext } from "../_lib/load-admin";
import {
  listCities,
  listProvinces,
  listZones,
} from "@/infrastructure/db/repositories/geography-repository";
import { GeographyForms } from "./geography-forms";

export const dynamic = "force-dynamic";

export default async function AdminGeographyPage() {
  await loadAdminContext("/admin/geography");
  const [provinces, cities, zones] = await Promise.all([
    listProvinces(),
    listCities(),
    listZones(),
  ]);

  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Geografía</h1>
        <p className="text-sm text-muted">
          Configuración mínima: Province → City → Zone. Sin mapas ni
          coordenadas. Piloto sugerido: Chubut (AR-U) / Rawson /
          America/Argentina/Catamarca.
        </p>
      </header>

      <section className="space-y-2 text-sm">
        <h2 className="font-semibold">Existente</h2>
        <p className="text-muted">
          Provincias: {provinces.length} · Ciudades: {cities.length} · Zonas:{" "}
          {zones.length}
        </p>
        {provinces.length > 0 ? (
          <ul className="list-inside list-disc text-muted">
            {provinces.map((province) => (
              <li key={province.id}>
                {province.name} ({province.code})
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">Aún no hay provincias cargadas.</p>
        )}
      </section>

      <GeographyForms
        provinces={provinces.map((p) => ({
          id: p.id,
          name: p.name,
          code: p.code,
        }))}
        cities={cities.map((c) => ({
          id: c.id,
          name: c.name,
          provinceId: c.provinceId,
        }))}
      />
    </main>
  );
}
