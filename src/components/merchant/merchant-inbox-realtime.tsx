"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  merchantRealtimeDevLog,
  subscribeMerchantOrderInserts,
} from "@/application/merchant/order-inbox-realtime";
import { createSupabaseBrowserClient } from "@/infrastructure/supabase/browser";

type Props = {
  merchantId: string;
};

export function MerchantInboxRealtime({ merchantId }: Props) {
  const router = useRouter();

  useEffect(() => {
    merchantRealtimeDevLog("[merchant-realtime] mount", { merchantId });
    let cancelled = false;
    let unsubscribe = () => {};
    const client = createSupabaseBrowserClient();

    void subscribeMerchantOrderInserts({
      client,
      merchantId,
      onInsert: () => {
        router.refresh();
      },
    }).then((subscription) => {
      if (cancelled) {
        merchantRealtimeDevLog(
          "[merchant-realtime] late unsubscribe after cancel",
        );
        subscription.unsubscribe();
        return;
      }
      unsubscribe = subscription.unsubscribe;
    });

    return () => {
      merchantRealtimeDevLog("[merchant-realtime] cleanup", { merchantId });
      cancelled = true;
      unsubscribe();
    };
  }, [merchantId, router]);

  return null;
}
