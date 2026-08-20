import { APP_NAME, APP_SERVICE_AREA, APP_TAGLINE } from "@/lib/app-info";

const MARQUEE_MESSAGE = `${APP_NAME} · ${APP_TAGLINE} · ${APP_SERVICE_AREA}`;

function MarqueeSegment() {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full bg-orange-200/90"
      />
      {MARQUEE_MESSAGE}
    </span>
  );
}

function MarqueeGroup() {
  return (
    <div className="flex items-center gap-8">
      <MarqueeSegment />
      <MarqueeSegment />
      <MarqueeSegment />
      <MarqueeSegment />
      <MarqueeSegment />
    </div>
  );
}

export function PublicMarquee() {
  return (
    <div
      className="public-marquee min-w-0 w-full max-w-full overflow-x-clip overflow-y-hidden bg-gradient-to-r from-violet-700 via-fuchsia-600 to-orange-500 py-2.5 text-xs font-semibold tracking-wide text-white"
      role="presentation"
    >
      <p className="sr-only">{MARQUEE_MESSAGE}</p>
      <div
        className="public-marquee-track flex items-center gap-8 whitespace-nowrap"
        aria-hidden
      >
        <MarqueeGroup />
        <MarqueeGroup />
      </div>
      <p className="public-marquee-static">{MARQUEE_MESSAGE}</p>
    </div>
  );
}
