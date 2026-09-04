import type { Metadata } from "next";
import Link from "next/link";
import { PublicBrandWordmark } from "@/components/storefront/public-brand-wordmark";
import { hasDatabaseConfig } from "@/infrastructure/db/env";
import {
  listCities,
  listZones,
} from "@/infrastructure/db/repositories/geography-repository";
import { APP_NAME } from "@/lib/app-info";
import { MerchantApplicationForm } from "./merchant-application-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Sumar comercio · ${APP_NAME}`,
};

export default async function SumarComercioPage() {
  const databaseAvailable = hasDatabaseConfig();
  const [cities, zones] = databaseAvailable
    ? await Promise.all([listCities(), listZones()])
    : [[], []];

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 sm:px-6 md:max-w-4xl lg:max-w-5xl lg:py-14">
      <Link href="/" className="mb-8 w-fit">
        <PublicBrandWordmark size="header" tone="plain" />
      </Link>
      <section className="rounded-[1.75rem] border border-sky-100/80 bg-white p-6 shadow-soft sm:p-8 lg:p-10">
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
          {!databaseAvailable ? (
            <p
              className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-muted"
              role="status"
            >
              Las solicitudes de comercios no están disponibles en este entorno.
              Intentá nuevamente más tarde.
            </p>
          ) : cities.length === 0 || zones.length === 0 ? (
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
