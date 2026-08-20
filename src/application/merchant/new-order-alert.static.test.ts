import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const PII = [
  "customer_name",
  "customer_name_snapshot",
  "customer_phone",
  "total_cents",
  "idempotency_key",
];

describe("new order alert static checks", () => {
  it("keeps the approved toast copy, CTA, and a11y", () => {
    const toast = read("src/components/merchant/order-notification-toast.tsx");
    const toggle = read(
      "src/components/merchant/merchant-order-sound-toggle.tsx",
    );
    const css = read("src/styles/globals.css");
    const sound = read("src/lib/order-notification-sound.ts");
    const alert = read("src/application/merchant/new-order-alert.ts");

    expect(toast).toContain("NUEVO PEDIDO");
    expect(toast).toContain("Pedido #");
    expect(toast).toContain("Tenés un nuevo pedido para revisar.");
    expect(toast).toContain("Ver pedido");
    expect(toast).toContain("shortOrderReference");
    expect(toast).toContain("merchantOrderDetailHref");
    expect(toast).toContain('role="status"');
    expect(toast).toContain('aria-live="polite"');
    expect(toast).toContain('aria-label="Cerrar aviso de pedido nuevo"');
    expect(toast).toContain("focus-visible:outline");
    expect(toast).toContain("min-h-11");
    expect(toast).toContain("NEW_ORDER_TOAST_VISIBLE_MS");
    expect(toast).toContain("NEW_ORDER_TOAST_EXIT_MS");

    expect(toggle).toContain("Activar sonido");
    expect(toggle).toContain("Silenciar sonido");
    expect(toggle).toContain("enableMerchantOrderSound");
    expect(toggle).toContain("disableMerchantOrderSound");

    expect(sound).toContain("pedilo-merchant-order-sound-enabled");
    expect(sound).toContain("/sounds/pedilo-new-order.mp3");
    expect(sound).toContain("decodeAudioData");
    expect(sound).not.toContain("pedilo-order-confirmed");
    expect(sound).not.toContain("1108.73");
    expect(sound).not.toContain("[merchant-sound]");
    expect(sound).not.toContain("merchantSoundDevLog");
    expect(sound).not.toContain("console.info");
    expect(
      fs.existsSync(path.join(root, "public/sounds/pedilo-new-order.mp3")),
    ).toBe(true);
    expect(alert).toContain("MAX_VISIBLE_NEW_ORDER_TOASTS = 3");
    expect(alert).toContain("SEEN_NEW_ORDER_ID_CAP = 50");
    expect(alert).toContain("NEW_ORDER_CHIME_COOLDOWN_MS = 2500");

    expect(css).toContain("merchant-order-toast-in 220ms");
    expect(css).toContain("merchant-order-toast-out 180ms");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain(".merchant-order-toast");
    expect(css).not.toContain("animate-ping");
    expect(css).not.toContain("animate-bounce");
  });

  it("does not put PII on the alert layer", () => {
    const files = [
      "src/application/merchant/new-order-alert.ts",
      "src/components/merchant/order-notification-toast.tsx",
      "src/components/merchant/merchant-order-sound-toggle.tsx",
      "src/components/merchant/merchant-inbox-realtime.tsx",
      "src/lib/order-notification-sound.ts",
    ];
    const joined = files.map((file) => read(file)).join("\n");
    for (const field of PII) {
      expect(joined).not.toContain(field);
    }
    expect(joined).not.toContain("randomUUID");
  });

  it("does not subscribe outside the merchant dashboard", () => {
    const detail = read(
      "src/app/merchant/[merchantId]/orders/[orderId]/page.tsx",
    );
    const catalog = read("src/app/merchant/[merchantId]/catalog/page.tsx");
    expect(detail).not.toContain("OrderNotificationToast");
    expect(catalog).not.toContain("OrderNotificationToast");
  });
});
