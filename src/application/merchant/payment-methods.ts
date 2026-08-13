import {
  PAYMENT_METHOD_CODES,
  type PaymentMethodCode,
} from "@/domain/merchant/enums";
import {
  canonicalPaymentMethodLabel,
  PAYMENT_INSTRUCTIONS_MAX_LENGTH,
  PAYMENT_METHOD_SORT_ORDER,
} from "@/domain/merchant/payment-methods";
import { err, ok, type Result } from "@/domain/shared/result";
import { isValidUuid } from "@/lib/uuid";

export type PaymentMethodApplicationError = {
  code: string;
  message: string;
};

export const PAYMENT_METHOD_ALLOWED_ROLES = ["OWNER", "STAFF"] as const;

export type MerchantPaymentMethodRow = {
  code: string;
  label: string;
  instructions: string;
  active: boolean;
  sortOrder: number;
};

export type PaymentMethodSettingView = {
  code: PaymentMethodCode;
  label: string;
  instructions: string;
  active: boolean;
  sortOrder: number;
};

export type SavePaymentMethodInput = {
  active: boolean;
  instructions: string;
};

export type SaveMerchantPaymentMethodsInput = {
  CASH: SavePaymentMethodInput;
  TRANSFER: SavePaymentMethodInput;
  MERCADO_PAGO: SavePaymentMethodInput;
};

export type PaymentMethodWriteDeps = {
  requirePaymentMethodAccess: (merchantId: string) => Promise<void>;
  listPaymentMethods: (
    merchantId: string,
  ) => Promise<MerchantPaymentMethodRow[]>;
  upsertPaymentMethods: (
    merchantId: string,
    methods: readonly MerchantPaymentMethodRow[],
  ) => Promise<MerchantPaymentMethodRow[]>;
};

/**
 * Builds the three canonical method cards. Missing DB rows appear inactive
 * with empty instructions — visiting the screen does not insert rows.
 */
export function presentPaymentMethodSettings(
  rows: readonly MerchantPaymentMethodRow[],
): PaymentMethodSettingView[] {
  const byCode = new Map(
    rows
      .filter((row) =>
        PAYMENT_METHOD_CODES.includes(row.code as PaymentMethodCode),
      )
      .map((row) => [row.code as PaymentMethodCode, row]),
  );

  return PAYMENT_METHOD_CODES.map((code) => {
    const existing = byCode.get(code);
    return {
      code,
      label: canonicalPaymentMethodLabel(code),
      instructions: existing?.instructions ?? "",
      active: existing?.active ?? false,
      sortOrder: PAYMENT_METHOD_SORT_ORDER[code],
    };
  });
}

export async function listMerchantPaymentMethodSettings(
  merchantId: string,
  deps: PaymentMethodWriteDeps,
): Promise<Result<PaymentMethodSettingView[], PaymentMethodApplicationError>> {
  await deps.requirePaymentMethodAccess(merchantId);
  if (!isValidUuid(merchantId)) {
    return err({ code: "INVALID_MERCHANT", message: "Comercio inválido." });
  }
  const rows = await deps.listPaymentMethods(merchantId);
  return ok(presentPaymentMethodSettings(rows));
}

function normalizeInstructions(
  raw: string,
): Result<string, PaymentMethodApplicationError> {
  const instructions = raw.trim();
  if (instructions.length > PAYMENT_INSTRUCTIONS_MAX_LENGTH) {
    return err({
      code: "INVALID_INSTRUCTIONS",
      message: "Las instrucciones son demasiado largas.",
    });
  }
  return ok(instructions);
}

/**
 * Upserts CASH, TRANSFER and MERCADO_PAGO with server-owned labels/codes.
 * Browser-supplied codes/labels are not accepted on this input type.
 */
export async function saveMerchantPaymentMethods(
  merchantId: string,
  input: SaveMerchantPaymentMethodsInput,
  deps: PaymentMethodWriteDeps,
): Promise<Result<PaymentMethodSettingView[], PaymentMethodApplicationError>> {
  await deps.requirePaymentMethodAccess(merchantId);

  if (!isValidUuid(merchantId)) {
    return err({ code: "INVALID_MERCHANT", message: "Comercio inválido." });
  }

  const methods: MerchantPaymentMethodRow[] = [];
  for (const code of PAYMENT_METHOD_CODES) {
    const slot = input[code];
    const instructionsResult = normalizeInstructions(slot.instructions);
    if (!instructionsResult.ok) {
      return instructionsResult;
    }
    methods.push({
      code,
      label: canonicalPaymentMethodLabel(code),
      instructions: instructionsResult.value,
      active: Boolean(slot.active),
      sortOrder: PAYMENT_METHOD_SORT_ORDER[code],
    });
  }

  try {
    const saved = await deps.upsertPaymentMethods(merchantId, methods);
    return ok(presentPaymentMethodSettings(saved));
  } catch {
    return err({
      code: "WRITE_FAILED",
      message: "No pudimos guardar los cambios.",
    });
  }
}
