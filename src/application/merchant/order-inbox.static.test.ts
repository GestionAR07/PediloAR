import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("merchant order inbox static checks", () => {
  it("uses requireMerchantRole OWNER|STAFF and stays read-only", () => {
    const wiring = read("src/application/merchant/order-inbox-wiring.ts");
    const useCase = read("src/application/merchant/order-inbox.ts");
    const repo = read(
      "src/infrastructure/db/repositories/merchant-order-repository.ts",
    );
    expect(wiring).toContain('import "server-only"');
    expect(wiring).toContain("requireMerchantRole");
    expect(wiring).toContain("MERCHANT_ORDER_ALLOWED_ROLES");
    expect(useCase).toContain('["OWNER", "STAFF"]');
    expect(wiring).not.toContain("createSupabaseAdminClient");
    expect(wiring).not.toContain("requirePlatformAdmin");
    expect(useCase).not.toContain("acceptOrder");
    expect(useCase).not.toContain("cancelOrder");
    expect(repo).not.toContain(".insert(");
    expect(repo).not.toContain(".update(");
    expect(repo).not.toContain(".delete(");
    expect(repo).not.toContain("db.transaction");
  });

  it("scopes SQL to merchant_id and does not select secrets", () => {
    const repo = read(
      "src/infrastructure/db/repositories/merchant-order-repository.ts",
    );
    expect(repo).toContain("eq(orders.merchantId, merchantId)");
    expect(repo).toContain("listOrdersForMerchant");
    expect(repo).toContain("ORDER_NON_TERMINAL_STATUSES");
    expect(repo).toContain("orders_merchant_id_idx");
    expect(repo).not.toContain("idempotencyKey");
    expect(repo).not.toContain("customerUserId");
    expect(repo).not.toContain("orders.idempotency");
  });

  it("does not add a merchant-order migration", () => {
    const drizzleDir = path.join(root, "drizzle");
    const sqlFiles = fs
      .readdirSync(drizzleDir)
      .filter((file) => file.endsWith(".sql"));
    for (const file of sqlFiles) {
      expect(file.toLowerCase()).not.toContain("merchant_order_inbox");
    }
  });

  it("inbox UI has semantic structure, real links, and no transition CTAs", () => {
    const page = read("src/app/merchant/[merchantId]/page.tsx");
    const card = read("src/components/merchant/merchant-order-card.tsx");
    const inbox = read("src/components/merchant/merchant-order-inbox.tsx");
    const detail = read("src/components/merchant/merchant-order-detail.tsx");
    const detailPage = read(
      "src/app/merchant/[merchantId]/orders/[orderId]/page.tsx",
    );
    expect(page).toContain("MerchantOrderInbox");
    expect(inbox).toContain("Pedidos nuevos");
    expect(page).toContain("Catálogo");
    expect(page).toContain("logoutAction");
    expect(inbox).toContain("<h2");
    expect(inbox).toContain("Nuevos");
    expect(inbox).toContain("En preparación");
    expect(inbox).toContain("Listos");
    expect(inbox).toContain("Finalizados hoy");
    expect(inbox).toContain("merchant-ops-board");
    expect(inbox).toContain("merchant-ops-today");
    expect(inbox).toContain("No hay pedidos nuevos.");
    expect(inbox).toContain("No tenés pedidos en curso.");
    expect(card).toContain("<article");
    expect(card).toContain("<dl");
    expect(card).toContain("grid-cols-[auto_minmax(0,1fr)]");
    expect(card).toContain("gap-x-4");
    expect(card).not.toContain("flex flex-wrap gap-x-2");
    expect(card).toContain("<Link");
    expect(card).toContain("Ver pedido");
    expect(card).toContain("focus-visible:outline");
    expect(card).toContain("break-words");
    expect(card).not.toContain("<table");
    expect(detail).not.toContain("<table");
    expect(detail).toContain("Retiro en el comercio");
    expect(detail).toContain("Envío a domicilio");
    expect(detail).toContain("order.customer.phone");
    expect(detailPage).toContain("← Mi comercio");
    expect(detailPage).toContain('export const dynamic = "force-dynamic"');
    for (const source of [page, card, inbox, detail, detailPage]) {
      expect(source).not.toContain('"use server"');
      expect(source).not.toContain("Aceptar pedido");
      expect(source).not.toContain("Rechazar");
      expect(source).not.toContain("acceptOrder");
      expect(source).not.toContain("PLATFORM_DELIVERY");
    }
  });

  it("does not put SQL in React", () => {
    const card = read("src/components/merchant/merchant-order-card.tsx");
    const inbox = read("src/components/merchant/merchant-order-inbox.tsx");
    const detail = read("src/components/merchant/merchant-order-detail.tsx");
    const page = read("src/app/merchant/[merchantId]/page.tsx");
    for (const source of [card, inbox, detail, page]) {
      expect(source).not.toContain("from(orders)");
      expect(source).not.toContain("drizzle-orm");
      expect(source).not.toContain("getDb(");
    }
  });
});
