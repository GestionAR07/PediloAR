import Link from "next/link";

export type MerchantWorkspaceSection =
  "orders" | "catalog" | "profile" | "delivery" | "payment-methods";

type Props = {
  merchantId: string;
  activeSection: MerchantWorkspaceSection;
};

const SECTIONS: Array<{
  section: MerchantWorkspaceSection;
  label: string;
  path: (merchantId: string) => string;
}> = [
  {
    section: "orders",
    label: "Pedidos",
    path: (merchantId) => `/merchant/${merchantId}`,
  },
  {
    section: "catalog",
    label: "Catálogo",
    path: (merchantId) => `/merchant/${merchantId}/catalog`,
  },
  {
    section: "profile",
    label: "Portada",
    path: (merchantId) => `/merchant/${merchantId}/profile`,
  },
  {
    section: "delivery",
    label: "Envíos y zonas",
    path: (merchantId) => `/merchant/${merchantId}/delivery`,
  },
  {
    section: "payment-methods",
    label: "Medios de pago",
    path: (merchantId) => `/merchant/${merchantId}/payment-methods`,
  },
];

export function MerchantWorkspaceNav({ merchantId, activeSection }: Props) {
  return (
    <nav className="merchant-ops-nav" aria-label="Secciones del comercio">
      {SECTIONS.map((item) => {
        const href = item.path(merchantId);
        const current = item.section === activeSection;
        return (
          <Link
            key={item.section}
            href={href}
            aria-current={current ? "page" : undefined}
            className={
              current
                ? "merchant-ops-nav-link merchant-ops-nav-link--active"
                : "merchant-ops-nav-link"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
