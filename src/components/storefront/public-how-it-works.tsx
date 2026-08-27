import type { ComponentType } from "react";
import {
  CheckIcon,
  MapPinIcon,
  ShoppingBagIcon,
} from "@/components/ui/public-icons";

type StepIcon = ComponentType<{ className?: string }>;

const STEPS: ReadonlyArray<{
  n: string;
  title: string;
  body: string;
  Icon: StepIcon;
  tone: string;
}> = [
  {
    n: "01",
    title: "Elegí tu zona",
    body: "Encontrá los comercios disponibles cerca tuyo.",
    Icon: MapPinIcon,
    tone: "from-[var(--ps-blue)] to-[var(--ps-sky)]",
  },
  {
    n: "02",
    title: "Armá tu pedido",
    body: "Elegí productos, cantidades y opciones disponibles.",
    Icon: ShoppingBagIcon,
    tone: "from-[var(--ps-sky)] to-[var(--ps-sky-medium)]",
  },
  {
    n: "03",
    title: "Confirmá tu pedido",
    body: "Completá tus datos, elegí retiro o envío si el comercio lo ofrece, y confirmá el pedido.",
    Icon: CheckIcon,
    tone: "from-[var(--ps-yellow)] to-[var(--ps-yellow-hover)] text-[var(--ps-deep)]",
  },
];

export function PublicHowItWorks() {
  return (
    <section
      id="como-funciona"
      className="mx-auto w-full min-w-0 max-w-7xl px-4 pt-10 pb-12 sm:px-6 lg:px-8 lg:pt-14 lg:pb-16"
      aria-labelledby="how-it-works-heading"
    >
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-extrabold tracking-[0.2em] text-[var(--ps-sky)]">
          ASÍ DE SIMPLE
        </p>
        <h2
          id="how-it-works-heading"
          className="how-it-works-title font-display mt-3 font-extrabold tracking-tight break-words text-[var(--ps-deep)]"
        >
          Pedí cerca, sin vueltas.
        </h2>
      </div>

      <ol className="how-it-works-grid mt-10 grid min-w-0 grid-cols-1 gap-5 md:grid-cols-3 md:gap-6 lg:mt-12">
        {STEPS.map(({ n, title, body, Icon, tone }) => (
          <li key={n} className="min-w-0">
            <article className="how-it-works-card flex h-full min-w-0 flex-col rounded-[1.75rem] border border-sky-100/80 bg-white p-6 shadow-soft sm:p-7">
              <p
                className="font-display text-5xl font-extrabold tracking-tight text-sky-100 sm:text-6xl"
                aria-hidden
              >
                {n}
              </p>
              <span
                className={`mt-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-glow ${tone}`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="font-display mt-5 text-lg font-extrabold tracking-tight break-words text-[var(--ps-deep)] sm:text-xl">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed break-words text-muted">
                {body}
              </p>
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}
