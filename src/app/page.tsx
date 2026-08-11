import { StatusBadge } from "@/components/ui/status-badge";
import { APP_NAME, APP_SERVICE_AREA, APP_TAGLINE } from "@/lib/app-info";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col justify-center gap-8 border-t border-border pt-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {APP_NAME}
        </h1>
        <StatusBadge label={APP_TAGLINE} />
      </header>

      <p className="max-w-prose text-sm leading-relaxed text-muted sm:text-base">
        Fundación de identidad lista. Persistencia y dominio validados. Todavía
        no hay catálogo, carrito ni checkout públicos.
      </p>

      <nav className="flex flex-wrap gap-4 text-sm">
        <Link
          className="text-accent underline-offset-4 hover:underline"
          href="/login"
        >
          Ingresar
        </Link>
        <Link
          className="text-accent underline-offset-4 hover:underline"
          href="/admin"
        >
          Admin
        </Link>
        <Link
          className="text-accent underline-offset-4 hover:underline"
          href="/merchant"
        >
          Comercio
        </Link>
      </nav>

      <footer className="mt-auto border-t border-border pt-6 text-xs text-muted sm:text-sm">
        {APP_SERVICE_AREA}
      </footer>
    </main>
  );
}
