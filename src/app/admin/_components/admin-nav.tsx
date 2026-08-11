import Link from "next/link";
import { logoutAction } from "@/app/login/actions";

const links = [
  { href: "/admin", label: "Inicio" },
  { href: "/admin/merchants", label: "Comercios" },
  { href: "/admin/geography", label: "Geografía" },
] as const;

export function AdminNav() {
  return (
    <header className="space-y-3 border-b border-border pb-4">
      <p className="text-sm font-medium text-foreground">
        Administración Marketplace Rawson
      </p>
      <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-accent underline-offset-4 hover:underline"
          >
            {link.label}
          </Link>
        ))}
        <form action={logoutAction} className="inline">
          <button
            type="submit"
            className="text-muted underline-offset-4 hover:underline"
          >
            Cerrar sesión
          </button>
        </form>
      </nav>
    </header>
  );
}
