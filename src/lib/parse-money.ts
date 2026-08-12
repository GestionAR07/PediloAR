import { moneyCents, type MoneyCents } from "@/domain/money/money-cents";
import { DomainError } from "@/domain/shared/errors";

/**
 * Normalizes human-entered ARS amounts to integer cents.
 * Accepts: 2500 | 2500,50 | $2.500,50 | 2.500,50
 */
export function parseMoneyInputToCents(raw: string): MoneyCents {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new DomainError("MONEY_INPUT_EMPTY", "El precio es obligatorio.");
  }

  const normalized = trimmed.replace(/\s/g, "").replace(/^\$/, "");

  if (!normalized || !/^[\d.,]+$/.test(normalized)) {
    throw new DomainError(
      "MONEY_INPUT_INVALID",
      "El precio no tiene un formato válido.",
    );
  }

  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");

  let decimalSeparator: "," | "." | null = null;
  if (lastComma >= 0 && lastDot >= 0) {
    decimalSeparator = lastComma > lastDot ? "," : ".";
  } else if (lastComma >= 0) {
    const fraction = normalized.slice(lastComma + 1);
    decimalSeparator = fraction.length <= 2 ? "," : null;
  } else if (lastDot >= 0) {
    const fraction = normalized.slice(lastDot + 1);
    decimalSeparator = fraction.length <= 2 ? "." : null;
  }

  let pesosPart: string;
  let centsPart = "00";

  if (decimalSeparator === ",") {
    pesosPart = normalized.slice(0, lastComma).replace(/\./g, "");
    centsPart = normalized.slice(lastComma + 1);
  } else if (decimalSeparator === ".") {
    pesosPart = normalized.slice(0, lastDot).replace(/,/g, "");
    centsPart = normalized.slice(lastDot + 1);
  } else {
    pesosPart = normalized.replace(/[.,]/g, "");
  }

  if (!/^\d+$/.test(pesosPart) || !/^\d{1,2}$/.test(centsPart)) {
    throw new DomainError(
      "MONEY_INPUT_INVALID",
      "El precio no tiene un formato válido.",
    );
  }

  const centsFraction = centsPart.padEnd(2, "0").slice(0, 2);
  const pesos = BigInt(pesosPart);
  const fraction = BigInt(centsFraction);
  const total = pesos * BigInt(100) + fraction;

  if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new DomainError(
      "MONEY_OVERFLOW",
      "El precio supera el máximo permitido.",
    );
  }

  return moneyCents(Number(total));
}
