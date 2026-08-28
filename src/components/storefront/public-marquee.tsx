import { APP_NAME, APP_SERVICE_AREA, APP_TAGLINE } from "@/lib/app-info";

const MARQUEE_MESSAGE = `${APP_NAME} · ${APP_TAGLINE} · ${APP_SERVICE_AREA}`;

function MarqueeSegment() {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className="public-marquee-dot inline-block rounded-full"
      />
      {MARQUEE_MESSAGE}
    </span>
  );
}

function MarqueeGroup() {
  return (
    <div className="public-marquee-group flex items-center">
      <MarqueeSegment />
      <MarqueeSegment />
      <MarqueeSegment />
      <MarqueeSegment />
    </div>
  );
}

export function PublicMarquee() {
  return (
    <div className="public-marquee" role="presentation">
      <p className="sr-only">{MARQUEE_MESSAGE}</p>
      <div className="public-marquee-track" aria-hidden>
        <MarqueeGroup />
        <MarqueeGroup />
      </div>
      <p className="public-marquee-static">{MARQUEE_MESSAGE}</p>
    </div>
  );
}
