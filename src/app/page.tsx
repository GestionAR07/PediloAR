import type { Metadata } from "next";
import {
  getPublicDiscoveryApp,
  getPublicNavContextApp,
} from "@/application/storefront/wiring";
import { MerchantCard } from "@/components/storefront/merchant-card";
import { PublicBrandWordmark } from "@/components/storefront/public-brand-wordmark";
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

      <section className="relative overflow-hidden bg-[var(--ps-night-900)] text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full bg-fuchsia-600/30 blur-[130px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/3 -right-32 h-[460px] w-[460px] rounded-full bg-violet-600/30 blur-[130px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 left-1/3 h-[420px] w-[420px] rounded-full bg-orange-500/20 blur-[130px]"
        />

        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pt-10 pb-10 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:px-8 lg:pt-14 lg:pb-14">
          <div>
            <p className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold tracking-wide">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              Operando en {APP_SERVICE_AREA}
            </p>
            <h1 className="mt-6 max-w-3xl">
              <PublicBrandWordmark size="hero" tone="gradient" />
              <span className="font-display mt-3 block text-2xl leading-[1.06] font-extrabold tracking-tight sm:text-3xl lg:text-4xl">
                <span className="grad-text">{APP_TAGLINE}</span>
              </span>
            </h1>
            <p className="mt-6 max-w-lg text-base text-slate-300/90 sm:text-lg">
              Los comercios de tu zona, en un solo lugar. Primero elegí dónde
              estás; después mirá qué comercios pueden atenderte.
            </p>
            <a
              href={heroHref}
              className="grad-btn mt-8 inline-flex min-h-12 items-center rounded-full px-7 py-3 text-sm font-extrabold text-white shadow-glow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {heroCta}
            </a>
          </div>

          <div
            aria-hidden
            className="relative mx-auto hidden h-[280px] w-[280px] lg:block xl:h-[320px] xl:w-[320px]"
          >
            <div className="absolute inset-6 rounded-full bg-fuchsia-500/25 blur-[70px]" />
            <div className="absolute inset-0 overflow-hidden rounded-full ring-8 ring-white/10 shadow-[0_0_120px_rgba(217,70,239,.4)]" />
            <div className="absolute top-1/2 left-1/2 h-[42%] w-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-violet-500/50 to-fuchsia-500/40" />
            <div className="glass absolute top-8 left-2 h-14 w-14 rounded-2xl shadow-xl" />
            <div className="glass absolute right-4 bottom-12 h-10 w-20 rounded-2xl shadow-xl" />
            <div className="absolute top-10 right-10 h-2 w-2 rounded-full bg-fuchsia-400" />
            <div className="absolute bottom-16 left-10 h-3 w-3 rounded-full bg-violet-300/80" />
          </div>
        </div>
        <svg
          className="relative block h-10 w-full text-[var(--ps-cream)] lg:h-14"
          viewBox="0 0 1440 90"
          fill="currentColor"
          aria-hidden
          preserveAspectRatio="none"
        >
          <path d="M0 90h1440V30c-120 30-300 45-480 45S600 30 420 30 120 60 0 90z" />
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
          </section>
        ) : null}
      </div>
    </main>
  );
}
