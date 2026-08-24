"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type SiteShellProps = {
  children: ReactNode;
};

const OPERATIONAL_SHELL =
  "mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-6 py-10 sm:px-8 sm:py-14";

const MERCHANT_OPS_SHELL =
  "merchant-ops flex min-h-dvh w-full min-w-0 flex-col px-4 py-4 sm:px-6 sm:py-6 lg:px-8";

const PUBLIC_STOREFRONT_SHELL =
  "public-storefront flex min-h-dvh w-full min-w-0 max-w-full flex-col";

function isOperationalPath(pathname: string): boolean {
  return pathname.startsWith("/merchant") || pathname.startsWith("/admin");
}

function isMerchantDashboardPath(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  return segments.length === 2 && segments[0] === "merchant";
}

function isPublicStorefrontPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/carrito" ||
    pathname === "/checkout" ||
    pathname.startsWith("/comercios")
  );
}

export function SiteShell({ children }: SiteShellProps) {
  const pathname = usePathname() ?? "/";
  const className =
    isPublicStorefrontPath(pathname) && !isOperationalPath(pathname)
      ? PUBLIC_STOREFRONT_SHELL
      : isMerchantDashboardPath(pathname)
        ? MERCHANT_OPS_SHELL
        : OPERATIONAL_SHELL;

  return <div className={className}>{children}</div>;
}
