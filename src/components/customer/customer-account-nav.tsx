"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/cuenta", label: "Resumen", exact: true },
  { href: "/cuenta/pedidos", label: "Mis pedidos", exact: false },
  { href: "/cuenta/perfil", label: "Mis datos", exact: false },
] as const;

export function CustomerAccountNav() {
  const pathname = usePathname() ?? "/cuenta";
  return (
    <nav aria-label="Cuenta del cliente" className="flex gap-2 overflow-x-auto">
      {links.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-extrabold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-cyan)] ${
              active
                ? "bg-[#083F66] text-white shadow-glow"
                : "border border-sky-100 bg-white text-[#083F66] hover:bg-sky-50"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
