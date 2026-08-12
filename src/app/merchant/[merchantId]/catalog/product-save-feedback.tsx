"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  productSaveFeedbackMessage,
  type ProductSaveFeedbackKind,
} from "@/lib/catalog-product-feedback";

type Props = {
  kind: ProductSaveFeedbackKind;
  cleanPath: string;
};

export function ProductSaveFeedback({ kind, cleanPath }: Props) {
  const router = useRouter();
  const { title, detail } = productSaveFeedbackMessage(kind);

  useEffect(() => {
    router.replace(cleanPath, { scroll: false });
  }, [router, cleanPath]);

  return (
    <div
      role="status"
      className="rounded-md border border-accent/30 bg-accent/10 px-4 py-3 text-sm"
    >
      <p className="font-medium text-accent">{title}</p>
      {detail ? <p className="mt-1 text-muted">{detail}</p> : null}
    </div>
  );
}
