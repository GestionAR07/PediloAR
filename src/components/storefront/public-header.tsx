import Link from "next/link";
import { APP_NAME } from "@/lib/app-info";
import type { PublicNavContext } from "@/application/storefront/types";

type Props = {
  nav: PublicNavContext;
  zoneLabel?: string | null;
};

export function PublicHeader({ nav, zoneLabel }: Props) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
      <div className="min-w-0 space-y-0.5">
        <Link
          href="/"
          className="block text-lg font-semibold tracking-tight text-foreground sm:text-xl"
        >
          {APP_NAME}
        </Link>
        {zoneLabel ? (
          <p className="truncate text-xs text-muted">Zona: {zoneLabel}</p>
        ) : (
          <p className="text-xs text-muted">Comprá cerca, sin vueltas</p>
        )}
      </div>

      <nav className="flex flex-wrap items-center gap-2 text-sm">
        {nav.isAuthenticated ? (
          <>
            {nav.merchantHomeHref ? (
              <Link
                href={nav.merchantHomeHref}
                className="rounded-md border border-border px-3 py-2 font-medium text-foreground"
              >
                Mi comercio
              </Link>
            ) : null}
            {nav.isAdmin ? (
              <Link
                href="/admin"
                className="rounded-md border border-border px-3 py-2 font-medium text-foreground"
              >
                Admin
              </Link>
            ) : null}
            <Link
              href="/login"
              className="rounded-md bg-accent px-3 py-2 font-medium text-white"
            >
              Cuenta
            </Link>
          </>
        ) : (
          <Link
            href="/login"
            className="rounded-md bg-accent px-3 py-2 font-medium text-white"
          >
            Ingresar
          </Link>
        )}
      </nav>
    </header>
  );
}
