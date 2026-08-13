import { ok, type Result } from "@/domain/shared/result";
import { toCheckoutReview, type CheckoutReview } from "./checkout-review";
import type { CheckoutApplicationError } from "./errors";
import { prepareOrder } from "./prepare-order";
import type { PrepareOrderDeps, PrepareOrderInput } from "./types";

/**
 * Read-only authoritative checkout review. Does not persist an Order.
 */
export async function reviewCheckout(
  input: PrepareOrderInput,
  deps: PrepareOrderDeps,
): Promise<Result<CheckoutReview, CheckoutApplicationError>> {
  const prepared = await prepareOrder(input, deps);
  if (!prepared.ok) {
    return prepared;
  }
  return ok(toCheckoutReview(prepared.value));
}
