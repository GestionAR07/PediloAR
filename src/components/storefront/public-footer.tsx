import Link from "next/link";
import { PublicBrandWordmark } from "@/components/storefront/public-brand-wordmark";
import { APP_NAME, APP_TAGLINE } from "@/lib/app-info";

const EXPLORE_LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/#comercios", label: "Comercios" },
  { href: "/#zona", label: "Elegir zona" },
] as const;

export function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="public-footer mt-auto w-full min-w-0 max-w-full">
      <div className="mx-auto grid w-full min-w-0 max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-[minmax(0,1.5fr)_repeat(2,minmax(0,1fr))] lg:gap-12 lg:px-8 lg:py-16">
        <div className="min-w-0 max-w-sm">
          <PublicBrandWordmark
            size="compact"
            tone="gradient"
            surface="light"
            showMark
          />
          <p className="mt-4 text-sm leading-relaxed break-words text-[var(--color-muted)]">
            {APP_TAGLINE}
          </p>
        </div>

        <nav className="min-w-0" aria-label="Explorar">
          <p className="text-xs font-extrabold tracking-[0.18em] text-[var(--ps-blue)] uppercase">
            Explorar
          </p>
          <ul className="mt-4 space-y-1">
            {EXPLORE_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex min-h-11 items-center text-sm font-semibold break-words text-[var(--color-muted)] transition hover:text-[var(--ps-sky)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-sky)]"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav className="min-w-0" aria-label="Comercios">
          <p className="text-xs font-extrabold tracking-[0.18em] text-[var(--ps-blue)] uppercase">
            Comercios
          </p>
          <ul className="mt-4 space-y-1">
            <li>
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center text-sm font-semibold break-words text-[var(--color-muted)] transition hover:text-[var(--ps-sky)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-sky)]"
              >
                Acceso comercios
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-sky-100/90">
        <p className="mx-auto w-full max-w-7xl px-4 py-5 text-xs break-words text-[var(--color-muted)] sm:px-6 lg:px-8">
          © {year} {APP_NAME}
        </p>
      </div>
    </footer>
  );
}
