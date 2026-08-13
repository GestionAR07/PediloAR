import type { Metadata } from "next";
import { CartProvider } from "@/components/cart/cart-provider";
import { SiteShell } from "@/components/layout/site-shell";
import { APP_NAME } from "@/lib/app-info";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description:
    "Marketplace local para pedir en comercios de Rawson y Playa Unión.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR">
      <body className="antialiased">
        <CartProvider>
          <SiteShell>{children}</SiteShell>
        </CartProvider>
      </body>
    </html>
  );
}
