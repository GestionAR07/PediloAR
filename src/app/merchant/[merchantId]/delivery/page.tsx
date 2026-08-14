import Link from "next/link";
import { redirect } from "next/navigation";
import { listMerchantDeliverySettingsApp } from "@/application/merchant/delivery-wiring";
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
  await loadPage(merchantId);

  const listed = await listMerchantDeliverySettingsApp(merchantId);
  if (!listed.ok) {
    return (
      <main className="flex flex-1 flex-col gap-6 border-t border-border pt-10">
        <p className="text-sm text-red-800" role="alert">
          {listed.error.message}
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-6 border-t border-border pt-10">
      <header className="space-y-2">
        <p className="text-sm">
          <Link
            href={`/merchant/${merchantId}`}
            className="text-accent underline-offset-4 hover:underline"
          >
            ← Mi comercio
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Envíos y zonas
        </h1>
        <p className="text-sm text-muted">
          Configurá dónde realizás entregas y cuánto cuesta el envío.
        </p>
      </header>

      <DeliverySettingsForm merchantId={merchantId} settings={listed.value} />
    </main>
  );
}
