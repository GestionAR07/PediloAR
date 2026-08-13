import Link from "next/link";
import { redirect } from "next/navigation";
import { listMerchantPaymentMethodSettingsApp } from "@/application/merchant/payment-method-wiring";
import { presentPaymentMethodSettings } from "@/application/merchant/payment-methods";
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
  await loadPage(merchantId);

  const listed = await listMerchantPaymentMethodSettingsApp(merchantId);
  const methods = listed.ok ? listed.value : presentPaymentMethodSettings([]);

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
          Medios de pago
        </h1>
        <p className="text-sm text-muted">
          Configurá cómo pueden pagarte tus clientes.
        </p>
      </header>

      <PaymentMethodsForm merchantId={merchantId} methods={methods} />
    </main>
  );
}
