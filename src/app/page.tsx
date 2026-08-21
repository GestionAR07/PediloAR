import type { Metadata } from "next";
import {
  getPublicDiscoveryApp,
  getPublicNavContextApp,
} from "@/application/storefront/wiring";
import { PublicDiscoverySection } from "@/components/storefront/public-discovery-section";
import { PublicFooter } from "@/components/storefront/public-footer";
import { PublicHeader } from "@/components/storefront/public-header";
import { PublicHero } from "@/components/storefront/public-hero";
import { PublicHowItWorks } from "@/components/storefront/public-how-it-works";
import { PublicMarquee } from "@/components/storefront/public-marquee";
import { PublicMerchantCta } from "@/components/storefront/public-merchant-cta";
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
    <main className="flex min-w-0 max-w-full flex-1 flex-col">
      <PublicMarquee />
      <PublicHeader
        nav={nav}
        zoneLabel={zoneLabel}
        zones={discovery.zones}
        selectedZoneId={discovery.selectedZone?.id ?? null}
      />
      <PublicHero />

      <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-10 px-4 pt-10 pb-6 sm:px-6 lg:px-8 lg:gap-12 lg:pt-14 lg:pb-8">
        <ZonePicker
          zones={discovery.zones}
          selectedZoneId={discovery.selectedZone?.id ?? null}
          selectedZone={discovery.selectedZone}
        />
        <PublicDiscoverySection
          selectedZone={discovery.selectedZone}
          merchants={discovery.merchants}
          categories={discovery.categories}
        />
      </div>
      <PublicHowItWorks />
      <PublicMerchantCta />
      <PublicFooter />
    </main>
  );
}
