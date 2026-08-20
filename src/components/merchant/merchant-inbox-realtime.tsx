"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  dismissMerchantNewOrderToast,
  recordSessionMerchantNewOrderInsert,
} from "@/application/merchant/new-order-alert";
import {
  merchantRealtimeDevLog,
  subscribeMerchantOrderInserts,
} from "@/application/merchant/order-inbox-realtime";
import { MerchantOrderSoundToggle } from "@/components/merchant/merchant-order-sound-toggle";
import { OrderNotificationToast } from "@/components/merchant/order-notification-toast";
import { createSupabaseBrowserClient } from "@/infrastructure/supabase/browser";
import { isValidUuid } from "@/lib/uuid";
import {
  isMerchantOrderSoundPreferenceEnabled,
  logMerchantOrderSoundSkipped,
  playMerchantOrderChime,
} from "@/lib/order-notification-sound";

type Props = {
  merchantId: string;
};

export function MerchantInboxRealtime({ merchantId }: Props) {
  const router = useRouter();
  const visibleRef = useRef<string[]>([]);
  const [visibleOrderIds, setVisibleOrderIds] = useState<string[]>([]);

  useEffect(() => {
    merchantRealtimeDevLog("[merchant-realtime] mount", { merchantId });
    const client = createSupabaseBrowserClient();
    const { unsubscribe } = subscribeMerchantOrderInserts({
      client,
      merchantId,
      onInsert: (event) => {
        router.refresh();
        if (!event.orderId || !isValidUuid(event.orderId)) {
          return;
        }
        const result = recordSessionMerchantNewOrderInsert({
          visibleOrderIds: visibleRef.current,
          soundEnabled: isMerchantOrderSoundPreferenceEnabled(),
          orderId: event.orderId,
          nowMs: Date.now(),
        });
        visibleRef.current = result.visibleOrderIds;
        setVisibleOrderIds(result.visibleOrderIds);
        if (result.chime === "full" || result.chime === "soft") {
          void playMerchantOrderChime(result.chime, "order");
        } else if (!result.isDuplicate) {
          logMerchantOrderSoundSkipped("blocked");
        }
      },
    });

    return () => {
      merchantRealtimeDevLog("[merchant-realtime] cleanup", { merchantId });
      unsubscribe();
    };
  }, [merchantId, router]);

  function dismiss(orderId: string): void {
    const next = dismissMerchantNewOrderToast(visibleRef.current, orderId);
    visibleRef.current = next;
    setVisibleOrderIds(next);
  }

  return (
    <div className="pointer-events-none fixed inset-x-4 top-4 z-50 flex flex-col items-end gap-3 sm:inset-x-auto sm:right-4 sm:w-[22rem]">
      <div className="pointer-events-auto">
        <MerchantOrderSoundToggle />
      </div>
      {visibleOrderIds.map((orderId) => (
        <OrderNotificationToast
          key={orderId}
          merchantId={merchantId}
          orderId={orderId}
          onDismiss={dismiss}
        />
      ))}
    </div>
  );
}
