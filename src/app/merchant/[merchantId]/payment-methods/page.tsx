import { redirect } from "next/navigation";
import { listMerchantPaymentMethodSettingsApp } from "@/application/merchant/payment-method-wiring";
import { presentPaymentMethodSettings } from "@/application/merchant/payment-methods";
import { MerchantSettingsNav } from "@/components/merchant/merchant-settings-nav";
import { MerchantWorkspacePage } from "@/components/merchant/merchant-workspace-page";
import { findMerchantDetailForMember } from "@/infrastructure/db/repositories/merchant-repository";
import { isAuthzError } from "@/server/auth/errors";
import { requireMerchantMembership } from "@/server/auth/authorization";
import { PaymentMethodsForm } from "./payment-methods-form";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ merchantId: string }>;
};

async function loadPage(merchantId: string) {
  try {
    const context = await requireMerchantMembership(merchantId);
    const merchant = await findMerchantDetailForMember(
      merchantId,
      context.user.id,
    );
    if (!merchant) {
      redirect("/login?next=/merchant&error=forbidden");
    }
    return { ...context, merchant };
  } catch (error) {
    if (isAuthzError(error)) {
      if (error.code === "UNAUTHENTICATED" || error.code === "CONFIG_MISSING") {
        redirect(`/login?next=/merchant/${merchantId}/payment-methods`);
      }
      redirect("/login?next=/merchant&error=forbidden");
    }
    throw error;
  }
}

export default async function MerchantPaymentMethodsPage({
  params,
}: PageProps) {
  const { merchantId } = await params;
  const { merchant } = await loadPage(merchantId);

  const listed = await listMerchantPaymentMethodSettingsApp(merchantId);
  const methods = listed.ok ? listed.value : presentPaymentMethodSettings([]);

  return (
    <MerchantWorkspacePage
      merchantId={merchantId}
      merchantName={merchant.name}
      activeSection="settings"
      title="Configuración"
      description="Administrá cómo se presenta y funciona tu comercio."
    >
      <div className="merchant-workspace-settings-stack">
        <MerchantSettingsNav merchantId={merchantId} activeTab="payments" />
        <header className="merchant-workspace-settings-pane">
          <h3 className="merchant-workspace-settings-pane-title">
            Medios de pago
          </h3>
          <p className="merchant-workspace-settings-pane-copy">
            Elegí cómo pueden pagarte tus clientes.
          </p>
        </header>
        <PaymentMethodsForm merchantId={merchantId} methods={methods} />
      </div>
    </MerchantWorkspacePage>
  );
}
