import Link from "next/link";
import { redirect } from "next/navigation";
import { getMerchantOrderApp } from "@/application/merchant/order-inbox-wiring";
import { MerchantOrderDetail } from "@/components/merchant/merchant-order-detail";
import { findMerchantDetailForMember } from "@/infrastructure/db/repositories/merchant-repository";
import { isAuthzError } from "@/server/auth/errors";
import { requireMerchantMembership } from "@/server/auth/authorization";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ merchantId: string; orderId: string }>;
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
        redirect(`/login?next=/merchant/${merchantId}`);
      }
      redirect("/login?next=/merchant&error=forbidden");
    }
    throw error;
  }
}

export default async function MerchantOrderDetailPage({ params }: PageProps) {
  const { merchantId, orderId } = await params;
  const { merchant } = await loadPage(merchantId);
  const now = new Date();

  let order = null;
  let errorMessage: string | null = null;
  try {
    const result = await getMerchantOrderApp(merchantId, orderId);
    if (result.ok) {
      order = result.value;
    } else {
      errorMessage = result.error.message;
    }
  } catch (error) {
    if (isAuthzError(error)) {
      redirect("/login?next=/merchant&error=forbidden");
    }
    errorMessage = "No pudimos cargar el pedido.";
  }

  return (
    <main className="flex flex-1 flex-col gap-6 border-t border-border pt-10">
      <p className="text-sm">
        <Link
          href={`/merchant/${merchantId}`}
          className="text-accent underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          ← Mi comercio
        </Link>
      </p>
      {order ? (
        <MerchantOrderDetail
          order={order}
          now={now}
          timeZone={merchant.cityTimezone}
        />
      ) : (
        <p className="text-sm text-muted">
          {errorMessage ?? "El pedido no existe."}
        </p>
      )}
    </main>
  );
}
