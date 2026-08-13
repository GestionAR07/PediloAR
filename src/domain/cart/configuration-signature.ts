import type { CartGroupConfiguration } from "./types";

/**
 * Deterministic signature for merge identity.
 * Same product + same choices/quantities → same signature regardless of input order.
 */
export function buildConfigurationSignature(
  productId: string,
  configuration: readonly CartGroupConfiguration[],
): string {
  const groups = [...configuration]
    .map((group) => {
      const selections = [...group.selections]
        .map((selection) => `${selection.choiceId}=${selection.quantity}`)
        .sort();
      return `${group.groupId}:{${selections.join(",")}}`;
    })
    .sort();

  return `${productId}|${groups.join("|")}`;
}
