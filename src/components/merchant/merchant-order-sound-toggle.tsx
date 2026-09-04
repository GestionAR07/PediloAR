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
      className="pedilo-action-secondary merchant-ops-sound inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold shadow-sm"
    >
      {enabled ? "Silenciar sonido" : "Activar sonido"}
    </button>
  );
}
