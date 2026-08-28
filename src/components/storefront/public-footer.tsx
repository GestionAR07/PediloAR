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
      <div className="mx-auto grid w-full min-w-0 max-w-7xl gap-10 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-[minmax(0,1.5fr)_repeat(2,minmax(0,1fr))] lg:gap-12 lg:px-8 lg:py-12">
        <div className="min-w-0 max-w-sm">
          <PublicBrandWordmark
            size="compact"
            layout="lockup"
            surface="dark"
            showMark
          />
          <p className="mt-4 text-sm leading-relaxed break-words text-slate-300">
            {APP_TAGLINE}
          </p>
        </div>

        <nav className="min-w-0" aria-label="Explorar">
          <p className="text-xs font-extrabold tracking-[0.18em] text-[var(--ps-cyan)] uppercase">
            Explorar
          </p>
          <ul className="mt-4 space-y-1">
            {EXPLORE_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex min-h-11 items-center text-sm font-semibold break-words text-slate-300 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav className="min-w-0" aria-label="Comercios">
          <p className="text-xs font-extrabold tracking-[0.18em] text-[var(--ps-cyan)] uppercase">
            Comercios
          </p>
          <ul className="mt-4 space-y-1">
            <li>
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center text-sm font-semibold break-words text-slate-300 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Acceso comercios
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-white/10">
        <p className="mx-auto w-full max-w-7xl px-4 py-4 text-xs break-words text-slate-400 sm:px-6 lg:px-8">
          © {year} {APP_NAME}
        </p>
      </div>
    </footer>
  );
}
