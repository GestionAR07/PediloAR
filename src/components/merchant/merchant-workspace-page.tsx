import Link from "next/link";
import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/app-info";
import {
  MerchantWorkspaceNav,
  type MerchantWorkspaceSection,
} from "./merchant-workspace-nav";

type Props = {
  merchantId: string;
  merchantName: string;
  activeSection: MerchantWorkspaceSection;
  title: string;
  description: ReactNode;
  children: ReactNode;
  action?: ReactNode;
};

export function MerchantWorkspacePage({
  merchantId,
  merchantName,
  activeSection,
  title,
  description,
  children,
  action,
}: Props) {
  return (
    <main className="merchant-ops-dashboard merchant-workspace-page flex min-w-0 flex-1 flex-col">
      <header className="merchant-ops-header merchant-workspace-header">
        <div className="merchant-ops-header-brand min-w-0">
          <p className="merchant-ops-mark">{APP_NAME}</p>
          <h1 className="merchant-ops-title min-w-0 truncate">
            {merchantName}
          </h1>
          <p className="merchant-ops-kicker">Panel operativo</p>
        </div>
        <div className="merchant-ops-header-tools">
          <Link
            href={`/comercios/${merchantId}`}
            className="merchant-ops-store-link"
          >
            Ver tienda
          </Link>
        </div>
      </header>

      <div className="merchant-ops-layout">
        <MerchantWorkspaceNav
          merchantId={merchantId}
          activeSection={activeSection}
        />

        <div className="merchant-ops-main min-w-0">
          <header className="merchant-workspace-module">
            <div className="merchant-workspace-module-copy min-w-0">
              <h2 className="merchant-workspace-module-title">{title}</h2>
              <div className="merchant-workspace-module-description">
                {description}
              </div>
            </div>
            {action ? (
              <div className="merchant-workspace-module-action">{action}</div>
            ) : null}
          </header>
          {children}
        </div>
      </div>
    </main>
  );
}
