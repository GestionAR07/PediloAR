import { OPTION_SELECTION_MODES, STOCK_MODES } from "@/domain/catalog/enums";
import {
  assertOptionSelections,
  type OptionSelectionInput,
} from "@/domain/catalog/options";
import { isProductOperationallyAvailable } from "@/domain/catalog/product";
import type {
  ProductOptionChoice,
  ProductOptionGroup,
} from "@/domain/catalog/types";
import { moneyCents, type MoneyCents } from "@/domain/money/money-cents";
import { PAYMENT_METHOD_CODES } from "@/domain/merchant/enums";
import { resolveMerchantDeliveryForZone } from "@/domain/merchant/delivery-zone";
import { isMerchantOperationallyAcceptingOrders } from "@/domain/merchant/operational-availability";
import type { MerchantDeliveryZone } from "@/domain/merchant/types";
import {
  parseCustomerNameSnapshot,
  parseCustomerPhoneSnapshot,
  snapshotMerchantName,
} from "@/domain/order/contact";
import { FULFILLMENT_METHODS } from "@/domain/order/enums";
import { assertFulfillmentAllowedForMvp } from "@/domain/order/transitions";
import {
  calculateLineTotal,
  calculateOrderTotals,
} from "@/domain/order/totals";
import { parseIdempotencyKey } from "@/domain/order/idempotency";
import { isDomainError } from "@/domain/shared/errors";
import { err, ok, type Result } from "@/domain/shared/result";
import { isValidUuid } from "@/lib/uuid";
import {
  checkoutError,
  CHECKOUT_ERROR_CODES,
  type CheckoutApplicationError,
} from "./errors";
import { buildOrderIntentFingerprint } from "./intent-fingerprint";
import type {
  CheckoutOptionChoiceRecord,
  CheckoutOptionGroupRecord,
  CheckoutProductRecord,
  PrepareOrderDeps,
  PrepareOrderGroupInput,
  PrepareOrderInput,
  PreparedOrder,
  PreparedOrderLine,
  PreparedOptionSnapshot,
} from "./types";

function fail<T>(
  code: (typeof CHECKOUT_ERROR_CODES)[keyof typeof CHECKOUT_ERROR_CODES],
  message: string,
): Result<T, CheckoutApplicationError> {
  return err(checkoutError(code, message));
}

function mapOptionError(): Result<
  PreparedOptionSnapshot[],
  CheckoutApplicationError
> {
  return fail(
    CHECKOUT_ERROR_CODES.INVALID_OPTION_SELECTION,
    "La selección de opciones no es válida.",
  );
}

function isCheckoutProductSellable(row: CheckoutProductRecord): boolean {
  if (!STOCK_MODES.includes(row.stockMode as (typeof STOCK_MODES)[number])) {
    return false;
  }
  return isProductOperationallyAvailable({
    active: row.active,
    available: row.available,
    stockMode: row.stockMode as (typeof STOCK_MODES)[number],
    stockQuantity: row.stockQuantity,
  });
}

function toDomainGroup(row: CheckoutOptionGroupRecord): ProductOptionGroup {
  const mode = OPTION_SELECTION_MODES.includes(
    row.selectionMode as (typeof OPTION_SELECTION_MODES)[number],
  )
    ? (row.selectionMode as ProductOptionGroup["selectionMode"])
    : "SINGLE";
  return {
    id: row.id as ProductOptionGroup["id"],
    productId: row.productId as ProductOptionGroup["productId"],
    name: row.name,
    selectionMode: mode,
    minSelections: row.minSelections,
    maxSelections: row.maxSelections,
    sortOrder: row.sortOrder,
    active: row.active,
  };
}

function toDomainChoice(row: CheckoutOptionChoiceRecord): ProductOptionChoice {
  return {
    id: row.id as ProductOptionChoice["id"],
    groupId: row.groupId as ProductOptionChoice["groupId"],
    name: row.name,
    priceDeltaCents: moneyCents(row.priceDeltaCents),
    sortOrder: row.sortOrder,
    active: row.active,
  };
}

function prepareLineOptions(
  productId: string,
  groupsInput: readonly PrepareOrderGroupInput[],
  groups: CheckoutOptionGroupRecord[],
  choices: CheckoutOptionChoiceRecord[],
): Result<PreparedOptionSnapshot[], CheckoutApplicationError> {
  const productGroups = groups.filter((group) => group.productId === productId);
  const groupById = new Map(productGroups.map((group) => [group.id, group]));

  for (const submitted of groupsInput) {
    if (!groupById.has(submitted.groupId)) {
      return err(
        checkoutError(
          CHECKOUT_ERROR_CODES.INVALID_OPTION_SELECTION,
          "Un grupo de opciones no pertenece a este producto.",
        ),
      );
    }
  }

  const snapshots: PreparedOptionSnapshot[] = [];

  const groupsToValidate = productGroups.filter(
    (group) =>
      group.active ||
      groupsInput.some((submitted) => submitted.groupId === group.id),
  );

  for (const groupRow of groupsToValidate) {
    const submitted = groupsInput.find((item) => item.groupId === groupRow.id);
    const selections: OptionSelectionInput[] = (
      submitted?.selections ?? []
    ).map((selection) => ({
      choiceId: selection.choiceId,
      quantity: selection.quantity,
    }));

    const groupChoices = choices.filter(
      (choice) => choice.groupId === groupRow.id,
    );
    try {
      assertOptionSelections(
        toDomainGroup(groupRow),
        groupChoices.map(toDomainChoice),
        selections,
      );
    } catch (error) {
      if (isDomainError(error)) {
        return mapOptionError();
      }
      throw error;
    }

    for (const selection of selections) {
      const choice = groupChoices.find((row) => row.id === selection.choiceId);
      if (!choice) {
        return err(
          checkoutError(
            CHECKOUT_ERROR_CODES.INVALID_OPTION_SELECTION,
            "Una opción seleccionada no es válida.",
          ),
        );
      }
      snapshots.push({
        optionGroupId: groupRow.id,
        optionChoiceId: choice.id,
        optionGroupNameSnapshot: groupRow.name,
        optionChoiceNameSnapshot: choice.name,
        priceDeltaCents: moneyCents(choice.priceDeltaCents),
        quantity: selection.quantity,
      });
    }
  }

  return ok(snapshots);
}

/**
 * Builds an authoritative order draft from untrusted checkout input.
 * Does not persist, decrement stock, or create Delivery / OrderEvent.
 *
 * TRACKED stock here is a precheck only. Concurrent-safe decrement happens
 * in 6B.3 inside a transaction (conditional UPDATE / row lock).
 */
export async function prepareOrder(
  input: PrepareOrderInput,
  deps: PrepareOrderDeps,
): Promise<Result<PreparedOrder, CheckoutApplicationError>> {
  if (!isValidUuid(input.merchantId)) {
    return fail(
      CHECKOUT_ERROR_CODES.MERCHANT_NOT_FOUND,
      "El comercio no existe.",
    );
  }

  const nameResult = parseCustomerNameSnapshot(input.customer?.name ?? "");
  if (!nameResult.ok) {
    return fail(
      CHECKOUT_ERROR_CODES.CONTACT_INVALID,
      "El nombre del comprador no es válido.",
    );
  }
  const phoneResult = parseCustomerPhoneSnapshot(input.customer?.phone ?? "");
  if (!phoneResult.ok) {
    return fail(
      CHECKOUT_ERROR_CODES.CONTACT_INVALID,
      "El teléfono del comprador no es válido.",
    );
  }

  const keyResult = parseIdempotencyKey(input.idempotencyKey ?? "");
  if (!keyResult.ok) {
    return fail(
      CHECKOUT_ERROR_CODES.IDEMPOTENCY_KEY_INVALID,
      "La clave de idempotencia no es válida.",
    );
  }

  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    return fail(
      CHECKOUT_ERROR_CODES.EMPTY_CART,
      "El pedido no tiene productos.",
    );
  }

  for (const line of input.lines) {
    if (!isValidUuid(line.productId)) {
      return fail(
        CHECKOUT_ERROR_CODES.PRODUCT_NOT_FOUND,
        "Uno de los productos no existe.",
      );
    }
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      return fail(
        CHECKOUT_ERROR_CODES.INVALID_LINE,
        "La cantidad de un producto no es válida.",
      );
    }
  }

  const fulfillmentRaw = String(input.fulfillmentMethod ?? "");
  if (
    !FULFILLMENT_METHODS.includes(
      fulfillmentRaw as (typeof FULFILLMENT_METHODS)[number],
    )
  ) {
    return fail(
      CHECKOUT_ERROR_CODES.INVALID_FULFILLMENT,
      "La modalidad de entrega no es válida.",
    );
  }
  const fulfillmentAllowed = assertFulfillmentAllowedForMvp(
    fulfillmentRaw as "PICKUP" | "MERCHANT_DELIVERY" | "PLATFORM_DELIVERY",
  );
  if (!fulfillmentAllowed.ok) {
    return fail(
      CHECKOUT_ERROR_CODES.INVALID_FULFILLMENT,
      "El envío por plataforma todavía no está disponible.",
    );
  }
  const fulfillmentMethod = fulfillmentRaw as "PICKUP" | "MERCHANT_DELIVERY";

  const uniqueProductIds = [
    ...new Set(input.lines.map((line) => line.productId)),
  ];
  const [merchant, payments, products, zoneRows] = await Promise.all([
    deps.findMerchantById(input.merchantId),
    deps.listPaymentMethodsForMerchant(input.merchantId),
    deps.listProductsByIds(uniqueProductIds),
    fulfillmentMethod === "MERCHANT_DELIVERY"
      ? deps.listDeliveryZonesForMerchant(input.merchantId)
      : Promise.resolve([]),
  ]);

  if (!merchant) {
    return fail(
      CHECKOUT_ERROR_CODES.MERCHANT_NOT_FOUND,
      "El comercio no existe.",
    );
  }

  if (
    !isMerchantOperationallyAcceptingOrders(
      {
        status: merchant.status as "DRAFT" | "ACTIVE" | "SUSPENDED",
        acceptingOrders: merchant.acceptingOrders,
        pausedUntil: merchant.pausedUntil,
      },
      deps.now(),
    )
  ) {
    return fail(
      CHECKOUT_ERROR_CODES.MERCHANT_NOT_ACCEPTING,
      "El comercio no está tomando pedidos.",
    );
  }

  const merchantNameResult = snapshotMerchantName(merchant.name);
  if (!merchantNameResult.ok) {
    return fail(
      CHECKOUT_ERROR_CODES.MERCHANT_NOT_ACCEPTING,
      "El comercio no está tomando pedidos.",
    );
  }

  const requestedCode = String(input.paymentMethodCode ?? "");
  const payment = payments.find((method) => method.code === requestedCode);
  if (
    !payment ||
    !payment.active ||
    !PAYMENT_METHOD_CODES.includes(
      payment.code as (typeof PAYMENT_METHOD_CODES)[number],
    )
  ) {
    return fail(
      CHECKOUT_ERROR_CODES.PAYMENT_METHOD_INVALID,
      "El medio de pago no es válido para este comercio.",
    );
  }

  const productById = new Map(products.map((product) => [product.id, product]));

  for (const productId of uniqueProductIds) {
    const product = productById.get(productId);
    if (!product) {
      return fail(
        CHECKOUT_ERROR_CODES.PRODUCT_NOT_FOUND,
        "Uno de los productos no existe.",
      );
    }
    if (product.merchantId !== merchant.id) {
      return fail(
        CHECKOUT_ERROR_CODES.PRODUCT_FOREIGN_MERCHANT,
        "Un producto no pertenece a este comercio.",
      );
    }
    if (!isCheckoutProductSellable(product)) {
      return fail(
        CHECKOUT_ERROR_CODES.PRODUCT_NOT_SELLABLE,
        "Un producto no está disponible para la venta.",
      );
    }
  }

  const trackedDemand = new Map<string, number>();
  for (const line of input.lines) {
    const product = productById.get(line.productId)!;
    if (product.stockMode === "TRACKED") {
      trackedDemand.set(
        product.id,
        (trackedDemand.get(product.id) ?? 0) + line.quantity,
      );
    }
  }
  for (const [productId, demand] of trackedDemand) {
    const product = productById.get(productId)!;
    const stock = product.stockQuantity ?? 0;
    if (stock < demand) {
      return fail(
        CHECKOUT_ERROR_CODES.INSUFFICIENT_STOCK,
        "No hay stock suficiente para uno de los productos.",
      );
    }
  }

  const groups = await deps.listOptionGroupsForProducts(uniqueProductIds);
  const groupIds = groups.map((group) => group.id);
  const choices =
    groupIds.length > 0 ? await deps.listOptionChoicesForGroups(groupIds) : [];

  const preparedLines: PreparedOrderLine[] = [];
  for (const line of input.lines) {
    const product = productById.get(line.productId)!;
    const optionsResult = prepareLineOptions(
      product.id,
      line.groups ?? [],
      groups,
      choices,
    );
    if (!optionsResult.ok) {
      return optionsResult;
    }

    const unitPriceCents = moneyCents(product.priceCents);
    const lineTotalCents = calculateLineTotal({
      unitPriceCents,
      quantity: line.quantity,
      options: optionsResult.value.map((option) => ({
        priceDeltaCents: option.priceDeltaCents,
        quantity: option.quantity,
      })),
    });

    preparedLines.push({
      productId: product.id,
      productNameSnapshot: product.name,
      unitPriceCents,
      quantity: line.quantity,
      options: optionsResult.value,
      lineTotalCents,
    });
  }

  const subtotalOnly = calculateOrderTotals(
    preparedLines.map((line) => ({
      unitPriceCents: line.unitPriceCents,
      quantity: line.quantity,
      options: line.options.map((option) => ({
        priceDeltaCents: option.priceDeltaCents,
        quantity: option.quantity,
      })),
    })),
    moneyCents(0),
  );

  let deliveryFee: MoneyCents = moneyCents(0);
  let delivery: PreparedOrder["delivery"] = null;

  if (fulfillmentMethod === "PICKUP") {
    if (!merchant.pickupEnabled) {
      return fail(
        CHECKOUT_ERROR_CODES.PICKUP_UNAVAILABLE,
        "Este comercio no ofrece retiro.",
      );
    }
    const pickupZoneId = input.customerZoneId?.trim() ?? "";
    if (!isValidUuid(pickupZoneId) || pickupZoneId !== merchant.zoneId) {
      return fail(
        CHECKOUT_ERROR_CODES.PICKUP_UNAVAILABLE,
        "El retiro sólo está disponible en la zona del comercio.",
      );
    }
  } else {
    if (!merchant.merchantDeliveryEnabled) {
      return fail(
        CHECKOUT_ERROR_CODES.INVALID_FULFILLMENT,
        "Este comercio no ofrece envío propio.",
      );
    }
    const deliveryInput = input.delivery;
    if (!deliveryInput?.zoneId) {
      return fail(
        CHECKOUT_ERROR_CODES.DELIVERY_ZONE_REQUIRED,
        "Seleccioná una zona de entrega.",
      );
    }
    const street = deliveryInput.street?.trim() ?? "";
    const number = deliveryInput.number?.trim() ?? "";
    if (!street || !number) {
      return fail(
        CHECKOUT_ERROR_CODES.DELIVERY_ADDRESS_REQUIRED,
        "Completá la dirección de entrega.",
      );
    }

    const domainZones: MerchantDeliveryZone[] = zoneRows.map((row) => ({
      merchantId: row.merchantId as MerchantDeliveryZone["merchantId"],
      zoneId: row.zoneId as MerchantDeliveryZone["zoneId"],
      deliveryFeeCents: moneyCents(row.deliveryFeeCents),
      minimumOrderCents: moneyCents(row.minimumOrderCents),
      estimatedMinutes: row.estimatedMinutes,
      active: row.active,
    }));

    const eligibility = resolveMerchantDeliveryForZone(
      { merchantDeliveryEnabled: merchant.merchantDeliveryEnabled },
      domainZones,
      deliveryInput.zoneId as MerchantDeliveryZone["zoneId"],
      subtotalOnly.orderSubtotalCents,
    );
    if (!eligibility.ok) {
      const code = eligibility.error.code;
      if (code === "MERCHANT_DELIVERY_BELOW_MINIMUM") {
        return fail(
          CHECKOUT_ERROR_CODES.DELIVERY_MINIMUM_NOT_MET,
          "El pedido no alcanza el mínimo de envío para esta zona.",
        );
      }
      if (code === "MERCHANT_DELIVERY_ZONE_INACTIVE") {
        return fail(
          CHECKOUT_ERROR_CODES.DELIVERY_ZONE_NOT_SERVED,
          "La zona de entrega no está activa.",
        );
      }
      return fail(
        CHECKOUT_ERROR_CODES.DELIVERY_ZONE_NOT_SERVED,
        "Este comercio no entrega en la zona seleccionada.",
      );
    }

    const zoneRow = zoneRows.find((row) => row.zoneId === deliveryInput.zoneId);
    if (!zoneRow) {
      return fail(
        CHECKOUT_ERROR_CODES.DELIVERY_ZONE_NOT_SERVED,
        "Este comercio no entrega en la zona seleccionada.",
      );
    }

    deliveryFee = eligibility.value.deliveryFeeCents;
    delivery = {
      cityId: zoneRow.cityId,
      zoneId: zoneRow.zoneId,
      cityNameSnapshot: zoneRow.cityName,
      zoneNameSnapshot: zoneRow.zoneName,
      street,
      number,
      floorApartment: (deliveryInput.floorApartment ?? "").trim(),
      reference: (deliveryInput.reference ?? "").trim(),
      feeCents: deliveryFee,
      estimatedMinutes: eligibility.value.estimatedMinutes,
    };
  }

  const totals = calculateOrderTotals(
    preparedLines.map((line) => ({
      unitPriceCents: line.unitPriceCents,
      quantity: line.quantity,
      options: line.options.map((option) => ({
        priceDeltaCents: option.priceDeltaCents,
        quantity: option.quantity,
      })),
    })),
    deliveryFee,
  );

  const intentFingerprint = buildOrderIntentFingerprint({
    merchantId: merchant.id,
    customerNameSnapshot: nameResult.value,
    customerPhoneSnapshot: phoneResult.value,
    fulfillmentMethod,
    paymentMethodCode: payment.code,
    delivery: delivery
      ? {
          zoneId: delivery.zoneId,
          street: delivery.street,
          number: delivery.number,
          floorApartment: delivery.floorApartment,
          reference: delivery.reference,
        }
      : null,
    lines: preparedLines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      options: line.options.map((option) => ({
        optionGroupId: option.optionGroupId,
        optionChoiceId: option.optionChoiceId,
        quantity: option.quantity,
      })),
    })),
  });

  return ok({
    merchantId: merchant.id,
    merchantNameSnapshot: merchantNameResult.value,
    customerUserId: null,
    customerNameSnapshot: nameResult.value,
    customerPhoneSnapshot: phoneResult.value,
    fulfillmentMethod,
    paymentMethodSnapshot: {
      code: payment.code as PreparedOrder["paymentMethodSnapshot"]["code"],
      label: payment.label,
      instructions: payment.instructions,
    },
    itemSubtotalCents: totals.itemSubtotalCents,
    optionsSubtotalCents: totals.optionsSubtotalCents,
    orderSubtotalCents: totals.orderSubtotalCents,
    deliveryFeeCents: totals.deliveryFeeCents,
    totalCents: totals.totalCents,
    delivery,
    lines: preparedLines,
    idempotencyKey: keyResult.value,
    intentFingerprint,
  });
}
