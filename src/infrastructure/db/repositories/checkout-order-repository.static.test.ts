import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("checkout order idempotent replay mapping", () => {
  it("returns the persisted customer owner used by replay authorization", () => {
    const repository = read(
      "src/infrastructure/db/repositories/checkout-order-repository.ts",
    );
    const start = repository.indexOf(
      "export async function findOrderByIdempotencyKey",
    );
    const end = repository.indexOf("function trackedDemand", start);
    const findByKey = repository.slice(start, end);

    expect(findByKey).toContain("customerUserId: orders.customerUserId");
    expect(findByKey).toContain("customerUserId: order.customerUserId");
  });
});
