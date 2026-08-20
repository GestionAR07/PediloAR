import Link from "next/link";
import { redirect } from "next/navigation";
import { getMerchantCoverPreviewApp } from "@/application/merchant/cover-image-wiring";
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
          Portada del comercio
        </h1>
        <p className="text-sm text-muted">
          Esta imagen aparece en el listado público de comercios.
        </p>
      </header>

      <MerchantCoverEditor
        merchantId={merchantId}
        merchantName={merchant.name}
        coverUrl={preview.coverUrl}
        upsertAction={upsertMerchantCoverAction}
        deleteAction={deleteMerchantCoverAction}
      />
    </main>
  );
}
