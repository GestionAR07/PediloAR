"use client";

import { useSyncExternalStore } from "react";
import {
  disableMerchantOrderSound,
  enableMerchantOrderSound,
  isMerchantOrderSoundPreferenceEnabled,
  subscribeMerchantOrderSoundPreference,
} from "@/lib/order-notification-sound";

export function MerchantOrderSoundToggle() {
  const enabled = useSyncExternalStore(
    subscribeMerchantOrderSoundPreference,
    isMerchantOrderSoundPreferenceEnabled,
    () => false,
  );

  return (
    <button
      type="button"
      onClick={() => {
        if (enabled) {
          disableMerchantOrderSound();
          return;
        }
        void enableMerchantOrderSound();
      }}
      className="inline-flex min-h-11 items-center rounded-full border border-violet-200 bg-white/95 px-4 text-sm font-semibold text-violet-800 shadow-sm hover:bg-violet-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700"
    >
      {enabled ? "Silenciar sonido" : "Activar sonido"}
    </button>
  );
}
