import type { Metadata } from "next";
import {
  getPublicDiscoveryApp,
  getPublicNavContextApp,
} from "@/application/storefront/wiring";
import { MerchantCard } from "@/components/storefront/merchant-card";
import { PublicHeader } from "@/components/storefront/public-header";
import { ZonePicker } from "@/components/storefront/zone-picker";
import { StoreIcon } from "@/components/ui/public-icons";
import { APP_NAME, APP_SERVICE_AREA, APP_TAGLINE } from "@/lib/app-info";

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
  const heroHref = discovery.selectedZone ? "#comercios" : "#zona";
  const heroCta = discovery.selectedZone ? "Ver comercios" : "Elegí tu zona";

  return (
    <main className="flex flex-1 flex-col">
      <PublicHeader
        nav={nav}
        zoneLabel={zoneLabel}
        zones={discovery.zones}
        selectedZoneId={discovery.selectedZone?.id ?? null}
      />

      <section className="relative overflow-hidden bg-[var(--ps-night)] text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-28 -left-24 h-[320px] w-[320px] rounded-full bg-violet-600/28 blur-[120px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/3 -right-24 h-[340px] w-[340px] rounded-full bg-violet-500/18 blur-[120px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-16 left-1/3 h-[180px] w-[180px] rounded-full bg-fuchsia-600/12 blur-[90px]"
        />
        <div className="relative mx-auto max-w-7xl px-4 pt-10 pb-10 sm:px-6 lg:px-8 lg:pt-14 lg:pb-14">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold tracking-wide">
            <span className="h-2 w-2 rounded-full bg-green-400" />
            Operando en {APP_SERVICE_AREA}
          </p>
          <h1 className="font-display mt-4 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl lg:mt-5 lg:text-5xl">
            {APP_NAME}
            <span className="mt-1.5 block text-2xl font-extrabold sm:text-3xl lg:text-4xl">
              <span className="grad-text">{APP_TAGLINE}</span>
            </span>
          </h1>
          <p className="mt-4 max-w-lg text-base text-slate-300/90 sm:text-lg lg:mt-5">
            Marketplace local para {APP_SERVICE_AREA}. Primero elegí dónde
            estás; después mirá qué comercios pueden atenderte.
          </p>
          <a
            href={heroHref}
            className="grad-btn mt-6 inline-flex min-h-12 items-center rounded-full px-7 text-sm font-extrabold text-white shadow-glow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:mt-7"
          >
            {heroCta}
          </a>
        </div>
        <svg
          className="relative block w-full text-[var(--ps-cream)]"
          viewBox="0 0 1440 56"
          fill="currentColor"
          aria-hidden
          preserveAspectRatio="none"
        >
          <path d="M0 56h1440V18c-120 18-300 28-480 28S600 8 420 8 120 36 0 56z" />
        </svg>
      </section>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-14 px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <ZonePicker
          zones={discovery.zones}
          selectedZoneId={discovery.selectedZone?.id ?? null}
        />

        {discovery.selectedZone ? (
          <section id="comercios" className="scroll-mt-24 space-y-5">
            <div className="space-y-1">
              <p className="text-xs font-extrabold tracking-[0.2em] text-violet-700">
                CERCA TUYO
              </p>
              <h2 className="font-display text-2xl font-extrabold tracking-tight text-[var(--ps-night-900)] lg:text-3xl">
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
          </section>
        ) : null}
      </div>
    </main>
  );
}
