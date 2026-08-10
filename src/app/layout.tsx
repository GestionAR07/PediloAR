import type { Metadata } from "next";
import { SiteShell } from "@/components/layout/site-shell";
import { APP_NAME } from "@/lib/app-info";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description:
    "Infraestructura digital para el comercio local de Rawson y Playa Unión.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR">
      <body className="antialiased">
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
