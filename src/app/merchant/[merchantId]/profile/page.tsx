import { redirect } from "next/navigation";
import { getMerchantCoverPreviewApp } from "@/application/merchant/cover-image-wiring";
import { MerchantWorkspacePage } from "@/components/merchant/merchant-workspace-page";
import { findMerchantDetailForMember } from "@/infrastructure/db/repositories/merchant-repository";
import { isAuthzError } from "@/server/auth/errors";
import { requireMerchantMembership } from "@/server/auth/authorization";
import {
  deleteMerchantCoverAction,
  upsertMerchantCoverAction,
} from "./actions";
import { MerchantCoverEditor } from "./merchant-cover-editor";

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
        redirect(`/login?next=/merchant/${merchantId}/profile`);
      }
      redirect("/login?next=/merchant&error=forbidden");
    }
    throw error;
  }
}

export default async function MerchantProfilePage({ params }: PageProps) {
  const { merchantId } = await params;
  const { merchant } = await loadPage(merchantId);
  const preview = await getMerchantCoverPreviewApp(merchantId);

  return (
    <MerchantWorkspacePage
      merchantId={merchantId}
      merchantName={merchant.name}
      activeSection="profile"
      title="Portada del comercio"
      description="Esta imagen aparece en el listado público de comercios."
    >
      <MerchantCoverEditor
        merchantId={merchantId}
        merchantName={merchant.name}
        coverUrl={preview.coverUrl}
        upsertAction={upsertMerchantCoverAction}
        deleteAction={deleteMerchantCoverAction}
      />
    </MerchantWorkspacePage>
  );
}
