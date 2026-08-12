import type { Metadata } from "next";
import {
  getPublicDiscoveryApp,
  getPublicNavContextApp,
} from "@/application/storefront/wiring";
import { MerchantCard } from "@/components/storefront/merchant-card";
import { PublicHeader } from "@/components/storefront/public-header";
import { ZonePicker } from "@/components/storefront/zone-picker";
import { APP_NAME, APP_SERVICE_AREA } from "@/lib/app-info";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${APP_NAME} — Pedí cerca`,
  description: `Descubrí comercios de ${APP_SERVICE_AREA}. Elegí tu zona y mirá qué hay disponible.`,
};

type HomePageProps = {
  searchParams: Promise<{ zone?: string }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const [nav, discovery] = await Promise.all([
    getPublicNavContextApp(),
    getPublicDiscoveryApp(params.zone),
  ]);

  const zoneLabel = discovery.selectedZone
    ? `${discovery.selectedZone.name} · ${discovery.selectedZone.cityName}`
    : null;

  return (
    <main className="flex flex-1 flex-col gap-8 border-t border-border pt-8">
      <PublicHeader nav={nav} zoneLabel={zoneLabel} />

      <section className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {APP_NAME}
        </h1>
        <p className="max-w-prose text-sm text-muted sm:text-base">
          Marketplace local para {APP_SERVICE_AREA}. Primero elegí dónde estás;
          después mirá qué comercios pueden atenderte.
        </p>
      </section>

      <ZonePicker
        zones={discovery.zones}
        selectedZoneId={discovery.selectedZone?.id ?? null}
      />

      {discovery.selectedZone ? (
        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">
              Comercios en {discovery.selectedZone.name}
            </h2>
            <p className="text-sm text-muted">
              Disponibilidad y logística según la configuración de cada
              comercio.
            </p>
          </div>

          {discovery.merchants.length === 0 ? (
            <p className="rounded-md border border-border bg-white/60 px-3 py-3 text-sm text-muted">
              Todavía no hay comercios disponibles en esta zona.
            </p>
          ) : (
            <div className="grid gap-3">
              {discovery.merchants.map((merchant) => (
                <MerchantCard key={merchant.id} merchant={merchant} />
              ))}
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
