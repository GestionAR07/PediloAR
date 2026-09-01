import type { Metadata } from "next";
import Link from "next/link";
import {
  listCities,
  listZones,
} from "@/infrastructure/db/repositories/geography-repository";
import { APP_NAME } from "@/lib/app-info";
import { PublicBrandWordmark } from "@/components/storefront/public-brand-wordmark";
import { MerchantApplicationForm } from "./merchant-application-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Sumar comercio · ${APP_NAME}`,
};

export default async function SumarComercioPage() {
  const [cities, zones] = await Promise.all([listCities(), listZones()]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 sm:px-6">
      <Link href="/" className="mb-8 w-fit">
        <PublicBrandWordmark size="header" tone="plain" />
      </Link>
      <section className="rounded-[1.75rem] border border-sky-100/80 bg-white p-6 shadow-soft sm:p-8">
        <p className="text-xs font-bold tracking-wider text-[var(--ps-cyan)] uppercase">
          Para comercios
        </p>
        <h1 className="font-display mt-1 text-3xl font-extrabold text-[var(--ps-navy)]">
          Sumá tu comercio
        </h1>
        <p className="mt-2 text-sm text-muted">
          Completá los datos y revisaremos la solicitud antes de habilitar el
          alta en Pedilo.
        </p>
        <div className="mt-7">
          {cities.length === 0 || zones.length === 0 ? (
            <p className="text-sm text-muted">
              Todavía no hay ciudades y zonas configuradas para recibir
              solicitudes.
            </p>
          ) : (
            <MerchantApplicationForm
              cities={cities.map((city) => ({ id: city.id, name: city.name }))}
              zones={zones.map((zone) => ({
                id: zone.id,
                cityId: zone.cityId,
                name: zone.name,
              }))}
            />
          )}
        </div>
      </section>
    </main>
  );
}
