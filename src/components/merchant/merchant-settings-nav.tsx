import Link from "next/link";

export type MerchantSettingsTab = "store" | "delivery" | "payments";

type Props = {
  merchantId: string;
  activeTab: MerchantSettingsTab;
};

const TABS: Array<{
  tab: MerchantSettingsTab;
  label: string;
  path: (merchantId: string) => string;
}> = [
  {
    tab: "store",
    label: "Tienda",
    path: (merchantId) => `/merchant/${merchantId}/profile`,
  },
  {
    tab: "delivery",
    label: "Envíos",
    path: (merchantId) => `/merchant/${merchantId}/delivery`,
  },
  {
    tab: "payments",
    label: "Medios de pago",
    path: (merchantId) => `/merchant/${merchantId}/payment-methods`,
  },
];

export function MerchantSettingsNav({ merchantId, activeTab }: Props) {
  return (
    <nav
      className="merchant-workspace-segmented merchant-workspace-settings-nav"
      aria-label="Configuración del comercio"
    >
      {TABS.map((item) => {
        const href = item.path(merchantId);
        const current = item.tab === activeTab;
        return (
          <Link
            key={item.tab}
            href={href}
            aria-current={current ? "page" : undefined}
            className={
              current
                ? "merchant-workspace-segment merchant-workspace-segment--active"
                : "merchant-workspace-segment"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
