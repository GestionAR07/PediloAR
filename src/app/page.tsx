import type { Metadata } from "next";
import {
  getPublicDiscoveryApp,
  getPublicNavContextApp,
} from "@/application/storefront/wiring";
import { MerchantCard } from "@/components/storefront/merchant-card";
import { PublicHeader } from "@/components/storefront/public-header";
import { PublicHero } from "@/components/storefront/public-hero";
import { PublicMarquee } from "@/components/storefront/public-marquee";
import { ZonePicker } from "@/components/storefront/zone-picker";
import { StoreIcon } from "@/components/ui/public-icons";
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
    <main className="flex flex-1 flex-col">
      <PublicMarquee />
      <PublicHeader
        nav={nav}
        zoneLabel={zoneLabel}
        zones={discovery.zones}
        selectedZoneId={discovery.selectedZone?.id ?? null}
      />
      <PublicHero />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-14 px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <ZonePicker
          zones={discovery.zones}
          selectedZoneId={discovery.selectedZone?.id ?? null}
        />

        <section id="comercios" className="scroll-mt-24 space-y-5">
          {discovery.selectedZone ? (
            <>
              <div className="space-y-1">
                <p className="mb-2 text-xs font-extrabold tracking-[0.2em] text-orange-500">
                  CERCA TUYO
                </p>
                <h2 className="font-display text-2xl font-extrabold tracking-tight text-[var(--ps-night-900)] lg:text-4xl">
                  Comercios en {discovery.selectedZone.name}
                </h2>
                <p className="text-sm text-muted">
                  Disponibilidad y logística según la configuración de cada
                  comercio.
                </p>
              </div>

              {discovery.merchants.length === 0 ? (
                <div className="rounded-[2rem] border-2 border-dashed border-violet-200 bg-white px-6 py-16 text-center">
                  <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-500">
                    <StoreIcon className="h-8 w-8" />
                  </span>
                  <p className="font-display mt-4 text-lg font-extrabold text-[var(--ps-night-900)]">
                    Todavía no hay comercios disponibles en esta zona.
                  </p>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                    Cuando un comercio habilite esta zona, va a aparecer acá.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {discovery.merchants.map((merchant) => (
                    <MerchantCard key={merchant.id} merchant={merchant} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted">
              Elegí tu zona para ver los comercios disponibles.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
