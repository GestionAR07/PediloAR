import { PublicHeroVisual } from "@/components/storefront/public-hero-visual";
import { APP_SERVICE_AREA } from "@/lib/app-info";

export function PublicHero() {
  return (
    <section
      id="inicio"
      className="relative overflow-x-clip bg-[var(--ps-sky-soft)] text-[var(--ps-deep)]"
    >
      <div className="public-hero-atmosphere" aria-hidden />

      <div className="relative mx-auto grid w-full min-w-0 max-w-7xl items-center gap-10 px-4 pt-12 pb-14 sm:px-6 sm:pb-16 lg:grid-cols-2 lg:gap-14 lg:px-8 lg:pt-11 lg:pb-20">
        <div className="min-w-0 max-w-full text-center lg:text-left">
          <p className="glass inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-bold tracking-wide uppercase lg:justify-start">
            <span className="h-2 w-2 shrink-0 rounded-full bg-green-400" />
            Operando en {APP_SERVICE_AREA}
          </p>
          <h1 className="public-hero-title font-display mt-6 max-w-full font-extrabold tracking-tight break-words text-[var(--ps-deep)]">
            Todo lo de tu zona,{" "}
            <span className="grad-text block">en un solo lugar.</span>
          </h1>
          <p className="mx-auto mt-6 w-full max-w-lg text-base break-words text-[var(--color-muted)] sm:text-lg lg:mx-0">
            Elegí tu zona, descubrí comercios cercanos y armá tu pedido sin
            vueltas.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
            <a
              href="#comercios"
              className="grad-btn inline-flex min-h-12 items-center rounded-full px-7 py-3 text-sm font-extrabold shadow-glow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-sky)]"
            >
              Ver comercios
            </a>
            <a
              href="#zona"
              className="inline-flex min-h-12 items-center rounded-full border border-[var(--ps-sky)]/40 bg-white/80 px-7 py-3 text-sm font-extrabold text-[var(--ps-blue)] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-sky)]"
            >
              Elegir zona
            </a>
          </div>
        </div>

        <PublicHeroVisual />
      </div>

      <div className="public-hero-wave" aria-hidden>
        <svg
          className="block h-6 w-full text-[var(--ps-surface)] lg:h-8"
          viewBox="0 0 1440 90"
          fill="currentColor"
          preserveAspectRatio="none"
        >
          <path d="M0 90h1440V30c-120 30-300 45-480 45S600 30 420 30 120 60 0 90z" />
        </svg>
      </div>
    </section>
  );
}
