"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type SiteShellProps = {
  children: ReactNode;
};

const OPERATIONAL_SHELL =
  "mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-6 py-10 sm:px-8 sm:py-14";

const PUBLIC_STOREFRONT_SHELL =
  "public-storefront flex min-h-dvh w-full flex-col";

function isOperationalPath(pathname: string): boolean {
  return pathname.startsWith("/merchant") || pathname.startsWith("/admin");
}

function isPublicStorefrontPath(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/comercios");
}

export function SiteShell({ children }: SiteShellProps) {
  const pathname = usePathname() ?? "/";
  const className =
    isPublicStorefrontPath(pathname) && !isOperationalPath(pathname)
      ? PUBLIC_STOREFRONT_SHELL
      : OPERATIONAL_SHELL;

  return <div className={className}>{children}</div>;
}
