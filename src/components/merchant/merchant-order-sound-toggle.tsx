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
      className="merchant-ops-sound inline-flex min-h-11 items-center rounded-full border border-sky-200 bg-white px-4 text-sm font-semibold text-[#083F66] shadow-sm hover:bg-sky-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#083F66]"
    >
      {enabled ? "Silenciar sonido" : "Activar sonido"}
    </button>
  );
}
