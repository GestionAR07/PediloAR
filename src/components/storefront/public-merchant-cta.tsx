import Link from "next/link";
import { PublicBrandMark } from "@/components/storefront/public-brand-mark";
import {
  CheckIcon,
  ShoppingBagIcon,
  StoreIcon,
} from "@/components/ui/public-icons";

const HIGHLIGHTS = [
  {
    title: "Productos",
    body: "Cargá y actualizá tu catálogo.",
    Icon: StoreIcon,
  },
  {
    title: "Pedidos",
    body: "Recibí y gestioná los pedidos.",
    Icon: ShoppingBagIcon,
  },
  {
    title: "Operación",
    body: "Pausá, coberturas y medios de pago.",
    Icon: CheckIcon,
  },
] as const;

export function PublicMerchantCta() {
  return (
    <section
      id="para-comercios"
      className="w-full min-w-0 px-4 pb-16 sm:px-6 lg:px-8 lg:pb-20"
      aria-labelledby="merchant-cta-heading"
    >
      <div className="merchant-cta-panel relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-[var(--ps-night-900)] px-5 py-10 text-white sm:px-8 sm:py-12 lg:px-12 lg:py-16">
        <div className="merchant-cta-atmosphere" aria-hidden />
        <span className="merchant-cta-orb" aria-hidden />

        <div className="relative grid min-w-0 items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-14">
          <div className="min-w-0 max-w-xl">
            <PublicBrandMark size="compact" />
            <p className="mt-5 text-xs font-extrabold tracking-[0.2em] text-orange-300">
              PARA COMERCIOS
            </p>
            <h2
              id="merchant-cta-heading"
              className="merchant-cta-title font-display mt-3 font-extrabold tracking-tight break-words"
            >
              Tu comercio también puede estar en Pedilo.
            </h2>
            <p className="mt-4 text-sm leading-relaxed break-words text-slate-300/90 sm:text-base">
              Mostrá tus productos, recibí pedidos y administrá tu operación
              desde un solo lugar.
            </p>
            <p className="mt-3 text-sm leading-relaxed break-words text-slate-400">
              ¿Querés sumar tu comercio? El alta es asistida: no hay registro
              público.
            </p>
            <Link
              href="/login"
              className="grad-btn mt-8 inline-flex min-h-12 items-center rounded-full px-7 py-3 text-sm font-extrabold text-white shadow-glow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Acceso comercios
            </Link>
          </div>

          <ul className="grid min-w-0 gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {HIGHLIGHTS.map(({ title, body, Icon }) => (
              <li key={title} className="min-w-0">
                <div className="glass merchant-cta-chip flex min-h-11 items-start gap-3 rounded-2xl px-4 py-3.5">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white">{title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed break-words text-slate-300">
                      {body}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
