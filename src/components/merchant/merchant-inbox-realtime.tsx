"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { subscribeMerchantOrderInserts } from "@/application/merchant/order-inbox-realtime";
import { createSupabaseBrowserClient } from "@/infrastructure/supabase/browser";

type Props = {
  merchantId: string;
};

export function MerchantInboxRealtime({ merchantId }: Props) {
  const router = useRouter();

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    const { unsubscribe } = subscribeMerchantOrderInserts({
      client,
      merchantId,
      onInsert: () => {
        router.refresh();
      },
    });
    return unsubscribe;
  }, [merchantId, router]);

  return null;
}
