import { redirect } from "next/navigation";
import { listMerchantDeliverySettingsApp } from "@/application/merchant/delivery-wiring";
import { MerchantWorkspacePage } from "@/components/merchant/merchant-workspace-page";
import { findMerchantDetailForMember } from "@/infrastructure/db/repositories/merchant-repository";
import { isAuthzError } from "@/server/auth/errors";
import { requireMerchantMembership } from "@/server/auth/authorization";
import { DeliverySettingsForm } from "./delivery-settings-form";

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
        redirect(`/login?next=/merchant/${merchantId}/delivery`);
      }
      redirect("/login?next=/merchant&error=forbidden");
    }
    throw error;
  }
}

export default async function MerchantDeliverySettingsPage({
  params,
}: PageProps) {
  const { merchantId } = await params;
  const { merchant } = await loadPage(merchantId);

  const listed = await listMerchantDeliverySettingsApp(merchantId);
  if (!listed.ok) {
    return (
      <MerchantWorkspacePage
        merchantId={merchantId}
        merchantName={merchant.name}
        activeSection="delivery"
        title="Envíos y zonas"
        description="Configurá dónde realizás entregas y cuánto cuesta el envío."
      >
        <p
          className="merchant-workspace-alert merchant-workspace-alert--error"
          role="alert"
        >
          {listed.error.message}
        </p>
      </MerchantWorkspacePage>
    );
  }

  return (
    <MerchantWorkspacePage
      merchantId={merchantId}
      merchantName={merchant.name}
      activeSection="delivery"
      title="Envíos y zonas"
      description="Configurá dónde realizás entregas y cuánto cuesta el envío."
    >
      <DeliverySettingsForm merchantId={merchantId} settings={listed.value} />
    </MerchantWorkspacePage>
  );
}
