"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { CheckoutConfiguration } from "@/application/checkout/configuration";
import type { CheckoutReview } from "@/application/checkout/checkout-review";
import {
  checkoutRequestSignature,
  type CheckoutFormDraft,
} from "@/application/checkout/parse-checkout-input";
import { isStaleCartError } from "@/application/checkout/user-messages";
import { CHECKOUT_ERROR_CODES } from "@/application/checkout/errors";
import { isCartEmpty } from "@/domain/cart/types";
import { moneyCents } from "@/domain/money/money-cents";
import { formatMoneyCentsArs } from "@/lib/format-money";
import { useCart } from "@/components/cart/cart-provider";
import {
  getCheckoutConfigurationAction,
  placeOrderAction,
  reviewCheckoutAction,
} from "@/app/checkout/actions";
import {
  createIdempotencyKey,
  markAttemptReviewed,
  markAttemptUnknown,
  resolveAttemptForSignature,
} from "@/lib/checkout/session";
import {
  getCheckoutAttemptSnapshot,
  getCheckoutSuccessSnapshot,
  getFrozenCheckoutDraftSnapshot,
  getServerCheckoutAttemptSnapshot,
  getServerCheckoutSuccessSnapshot,
  getServerFrozenCheckoutDraftSnapshot,
  setCheckoutAttempt,
  setCheckoutSuccess,
  setFrozenCheckoutDraft,
  subscribeCheckoutAttempt,
  subscribeCheckoutSuccess,
  subscribeFrozenCheckoutDraft,
} from "@/lib/checkout/session-store";
import { readPublicZoneId } from "@/lib/public-zone-storage";

const inputClassName =
  "min-h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-accent focus-visible:ring-2 disabled:opacity-60";

function formatCents(cents: number): string {
  return formatMoneyCentsArs(moneyCents(cents));
}

function fulfillmentLabel(method: string): string {
  return method === "MERCHANT_DELIVERY"
    ? "Envío a domicilio"
    : "Retiro en el comercio";
}

function subscribeDiscoveryZone(listener: () => void): () => void {
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}

function getDiscoveryZoneSnapshot(): string {
  return readPublicZoneId(window.localStorage) ?? "";
}

function getServerDiscoveryZoneSnapshot(): string {
  return "";
}

export function CheckoutPageClient() {
  const { cart, hydrated, totalCents, clear } = useCart();
  const storedAttempt = useSyncExternalStore(
    subscribeCheckoutAttempt,
    getCheckoutAttemptSnapshot,
    getServerCheckoutAttemptSnapshot,
  );
  const storedSuccess = useSyncExternalStore(
    subscribeCheckoutSuccess,
    getCheckoutSuccessSnapshot,
    getServerCheckoutSuccessSnapshot,
  );
  const frozen = useSyncExternalStore(
    subscribeFrozenCheckoutDraft,
    getFrozenCheckoutDraftSnapshot,
    getServerFrozenCheckoutDraftSnapshot,
  );
  const discoveryZoneId = useSyncExternalStore(
    subscribeDiscoveryZone,
    getDiscoveryZoneSnapshot,
    getServerDiscoveryZoneSnapshot,
  );

  const [config, setConfig] = useState<CheckoutConfiguration | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [fulfillmentMethod, setFulfillmentMethod] = useState("");
  const [deliveryZoneId, setDeliveryZoneId] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [floorApartment, setFloorApartment] = useState("");
  const [reference, setReference] = useState("");
  const [paymentMethodCode, setPaymentMethodCode] = useState("");
  const [review, setReview] = useState<CheckoutReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const confirmLock = useRef(false);

  const success = isCartEmpty(cart) ? storedSuccess : null;
  const pickupAvailable = Boolean(config?.merchant.pickupEnabled);
  const deliveryAvailable = Boolean(
    config?.merchant.merchantDeliveryEnabled &&
    (config?.deliveryZones.length ?? 0) > 0,
  );
  const defaultFulfillment = pickupAvailable
    ? "PICKUP"
    : deliveryAvailable
      ? "MERCHANT_DELIVERY"
      : "";
  const effectiveFulfillment = fulfillmentMethod || defaultFulfillment;
  const defaultPayment =
    config?.paymentMethods.length === 1 ? config.paymentMethods[0]!.code : "";
  const effectivePayment = paymentMethodCode || defaultPayment;
  const servedDiscovery = config?.deliveryZones.find(
    (zone) => zone.zoneId === discoveryZoneId,
  );
  const effectiveDeliveryZoneId =
    deliveryZoneId || servedDiscovery?.zoneId || "";
  const customerZoneId =
    effectiveFulfillment === "PICKUP"
      ? (config?.merchant.homeZoneId ?? "")
      : discoveryZoneId;

  const unknown = storedAttempt?.phase === "unknown";
  const formLocked = unknown || confirming;
  const nameValue = unknown && frozen ? frozen.customerName : customerName;
  const phoneValue = unknown && frozen ? frozen.customerPhone : customerPhone;
  const fulfillmentValue =
    unknown && frozen ? frozen.fulfillmentMethod : effectiveFulfillment;
  const deliveryZoneValue =
    unknown && frozen ? frozen.deliveryZoneId : effectiveDeliveryZoneId;
  const streetValue = unknown && frozen ? frozen.street : street;
  const numberValue = unknown && frozen ? frozen.number : number;
  const floorValue = unknown && frozen ? frozen.floorApartment : floorApartment;
  const referenceValue = unknown && frozen ? frozen.reference : reference;
  const paymentValue =
    unknown && frozen ? frozen.paymentMethodCode : effectivePayment;

  const draftForSignature = useMemo(
    () => ({
      merchantId: cart.merchantId,
      customerZoneId,
      customerName: nameValue,
      customerPhone: phoneValue,
      fulfillmentMethod: fulfillmentValue,
      deliveryZoneId: deliveryZoneValue,
      street: streetValue,
      number: numberValue,
      floorApartment: floorValue,
      reference: referenceValue,
      paymentMethodCode: paymentValue,
    }),
    [
      cart.merchantId,
      customerZoneId,
      nameValue,
      phoneValue,
      fulfillmentValue,
      deliveryZoneValue,
      streetValue,
      numberValue,
      floorValue,
      referenceValue,
      paymentValue,
    ],
  );

  const signature = useMemo(
    () => checkoutRequestSignature(cart, draftForSignature),
    [cart, draftForSignature],
  );

  const attempt = useMemo(
    () =>
      resolveAttemptForSignature(
        storedAttempt,
        signature,
        createIdempotencyKey,
      ),
    [storedAttempt, signature],
  );

  useEffect(() => {
    if (!hydrated || isCartEmpty(cart) || success) return;
    const merchantId = cart.merchantId;
    let cancelled = false;
    void getCheckoutConfigurationAction(merchantId).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setConfig(null);
        setConfigError(result.message);
        return;
      }
      setConfigError(null);
      setConfig(result.configuration);
    });
    return () => {
      cancelled = true;
    };
  }, [hydrated, cart, success]);

  const selectedPayment = config?.paymentMethods.find(
    (method) => method.code === paymentValue,
  );
  const selectedDeliveryZone = config?.deliveryZones.find(
    (zone) => zone.zoneId === deliveryZoneValue,
  );
  const belowMinimum =
    fulfillmentValue === "MERCHANT_DELIVERY" &&
    selectedDeliveryZone != null &&
    selectedDeliveryZone.minimumOrderCents > 0 &&
    totalCents < selectedDeliveryZone.minimumOrderCents;
  const configLoading =
    hydrated &&
    !isCartEmpty(cart) &&
    !success &&
    config === null &&
    configError === null;

  const canReview =
    !formLocked &&
    !reviewing &&
    Boolean(config?.merchant.acceptingOrders) &&
    (config?.paymentMethods.length ?? 0) > 0 &&
    nameValue.trim().length > 0 &&
    phoneValue.trim().length > 0 &&
    (fulfillmentValue === "PICKUP" ||
      fulfillmentValue === "MERCHANT_DELIVERY") &&
    (fulfillmentValue !== "PICKUP" || Boolean(customerZoneId)) &&
    (fulfillmentValue !== "MERCHANT_DELIVERY" ||
      (Boolean(deliveryZoneValue) &&
        streetValue.trim().length > 0 &&
        numberValue.trim().length > 0)) &&
    Boolean(paymentValue);

  const reviewIsCurrent =
    review != null &&
    attempt.quoteFingerprint === review.quoteFingerprint &&
    attempt.requestSignature === signature &&
    attempt.phase !== "unknown";

  const canConfirm =
    reviewIsCurrent && !confirming && !reviewing && attempt.phase !== "unknown";

  function buildDraft(fingerprint: string | null): CheckoutFormDraft {
    return {
      ...draftForSignature,
      idempotencyKey: attempt.idempotencyKey,
      expectedQuoteFingerprint: fingerprint,
    };
  }

  async function handleReview(): Promise<void> {
    if (!canReview) return;
    setError(null);
    setErrorCode(null);
    setReviewing(true);
    try {
      const result = await reviewCheckoutAction({
        cart,
        draft: buildDraft(null),
      });
      if (!result.ok) {
        setError(result.message);
        setErrorCode(result.code);
        if (result.review) {
          setReview(result.review);
          setCheckoutAttempt(
            markAttemptReviewed(attempt, result.review.quoteFingerprint),
          );
        } else {
          setReview(null);
        }
        return;
      }
      setReview(result.review);
      setCheckoutAttempt(
        markAttemptReviewed(attempt, result.review.quoteFingerprint),
      );
    } catch {
      setError("No pudimos revisar el pedido. Reintentá.");
      setErrorCode(null);
    } finally {
      setReviewing(false);
    }
  }

  async function confirmWithDraft(draft: CheckoutFormDraft): Promise<void> {
    if (confirmLock.current) return;
    confirmLock.current = true;
    setConfirming(true);
    setError(null);
    setErrorCode(null);
    setFrozenCheckoutDraft({
      ...draft,
      expectedQuoteFingerprint: draft.expectedQuoteFingerprint ?? "",
    });
    try {
      const result = await placeOrderAction({ cart, draft });
      if (!result.ok) {
        setError(result.message);
        setErrorCode(result.code);
        if (
          result.code === CHECKOUT_ERROR_CODES.CHECKOUT_REVIEW_REQUIRED &&
          result.review
        ) {
          setReview(result.review);
          setCheckoutAttempt(
            markAttemptReviewed(attempt, result.review.quoteFingerprint),
          );
        }
        return;
      }
      const merchantName =
        review?.merchantName ||
        config?.merchant.name ||
        cart.merchantNameSnapshot;
      setCheckoutSuccess({
        ...result.order,
        merchantName,
      });
      setCheckoutAttempt(null);
      setFrozenCheckoutDraft(null);
      clear();
      setReview(null);
    } catch {
      setCheckoutAttempt(markAttemptUnknown(attempt));
      setError("No pudimos confirmar la respuesta del servidor.");
      setErrorCode("NETWORK_UNKNOWN");
    } finally {
      confirmLock.current = false;
      setConfirming(false);
    }
  }

  async function handleConfirm(): Promise<void> {
    if (!canConfirm || !review) return;
    await confirmWithDraft(buildDraft(review.quoteFingerprint));
  }

  async function handleRetry(): Promise<void> {
    const draft = frozen
      ? {
          ...frozen,
          expectedQuoteFingerprint: frozen.expectedQuoteFingerprint,
        }
      : review
        ? buildDraft(review.quoteFingerprint)
        : null;
    if (!draft) return;
    await confirmWithDraft(draft);
  }

  if (!hydrated) {
    return (
      <p className="text-sm text-muted" role="status">
        Cargando checkout…
      </p>
    );
  }

  if (success) {
    return (
      <section className="space-y-4" aria-live="polite">
        <h1 className="text-2xl font-semibold tracking-tight">
          Pedido recibido
        </h1>
        <p className="text-sm text-muted">
          El comercio recibió tu pedido y está pendiente de confirmación.
        </p>
        <dl className="space-y-2 rounded-xl border border-border bg-white/70 p-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Referencia</dt>
            <dd className="font-medium">{success.orderRef}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Comercio</dt>
            <dd className="font-medium">{success.merchantName}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Total</dt>
            <dd className="font-medium">{formatCents(success.totalCents)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Modalidad</dt>
            <dd className="font-medium">
              {fulfillmentLabel(success.fulfillmentMethod)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Estado</dt>
            <dd className="font-medium">Pendiente</dd>
          </div>
        </dl>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-white"
        >
          Volver al inicio
        </Link>
      </section>
    );
  }

  if (isCartEmpty(cart)) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>
        <p className="text-sm text-muted">
          Tu carrito está vacío. Agregá productos antes de continuar.
        </p>
        <Link
          href="/carrito"
          className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-white"
        >
          Ir al carrito
        </Link>
      </div>
    );
  }

  const selectedInstructions = selectedPayment?.instructions?.trim() ?? "";

  return (
    <div className="space-y-6">
      <p className="text-sm">
        <Link
          href="/carrito"
          className="text-accent underline-offset-4 hover:underline"
        >
          ← Volver al carrito
        </Link>
      </p>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>
        <p className="text-sm text-muted">
          {config?.merchant.name ?? cart.merchantNameSnapshot}
        </p>
      </header>

      {configLoading ? (
        <p className="text-sm text-muted" role="status">
          Cargando datos del comercio…
        </p>
      ) : null}

      {configError ? (
        <p
          className="rounded-md border border-border px-3 py-2 text-sm"
          role="alert"
        >
          {configError}
        </p>
      ) : null}

      {config && !config.merchant.acceptingOrders ? (
        <p
          className="rounded-md border border-border px-3 py-2 text-sm"
          role="alert"
        >
          Este comercio no está tomando pedidos en este momento.
        </p>
      ) : null}

      {config && config.paymentMethods.length === 0 ? (
        <p
          className="rounded-md border border-border px-3 py-2 text-sm"
          role="alert"
        >
          Este comercio todavía no configuró medios de pago.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Contacto</h2>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Nombre</span>
              <input
                name="customerName"
                autoComplete="name"
                maxLength={80}
                required
                disabled={formLocked}
                value={nameValue}
                onChange={(event) => setCustomerName(event.target.value)}
                className={inputClassName}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Teléfono</span>
              <input
                name="customerPhone"
                type="tel"
                autoComplete="tel"
                maxLength={32}
                required
                disabled={formLocked}
                value={phoneValue}
                onChange={(event) => setCustomerPhone(event.target.value)}
                className={inputClassName}
              />
            </label>
          </section>

          <fieldset className="space-y-3" disabled={formLocked}>
            <legend className="text-lg font-semibold">
              Modalidad de entrega
            </legend>
            {pickupAvailable ? (
              <label className="flex min-h-11 items-start gap-3 rounded-md border border-border px-3 py-2 text-sm">
                <input
                  type="radio"
                  name="fulfillmentMethod"
                  value="PICKUP"
                  checked={fulfillmentValue === "PICKUP"}
                  onChange={() => setFulfillmentMethod("PICKUP")}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium">
                    Retiro en el comercio
                  </span>
                  {config ? (
                    <span className="block text-xs text-muted">
                      En {config.merchant.homeZoneName},{" "}
                      {config.merchant.homeCityName}
                      {config.merchant.preparationMinutes != null
                        ? ` · preparación estimada ${config.merchant.preparationMinutes} min`
                        : ""}
                    </span>
                  ) : null}
                </span>
              </label>
            ) : null}
            {deliveryAvailable ? (
              <label className="flex min-h-11 items-start gap-3 rounded-md border border-border px-3 py-2 text-sm">
                <input
                  type="radio"
                  name="fulfillmentMethod"
                  value="MERCHANT_DELIVERY"
                  checked={fulfillmentValue === "MERCHANT_DELIVERY"}
                  onChange={() => setFulfillmentMethod("MERCHANT_DELIVERY")}
                  className="mt-1"
                />
                <span className="font-medium">Envío a domicilio</span>
              </label>
            ) : null}
            {!pickupAvailable && !deliveryAvailable && config ? (
              <p className="text-sm text-muted">
                Este comercio no tiene retiro ni envío disponible.
              </p>
            ) : null}
          </fieldset>

          {fulfillmentValue === "PICKUP" && config ? (
            <p className="text-sm text-muted">
              El retiro es en {config.merchant.homeZoneName} (
              {config.merchant.homeCityName}).
            </p>
          ) : null}

          {fulfillmentValue === "MERCHANT_DELIVERY" ? (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Dirección y zona</h2>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Zona de envío</span>
                <select
                  name="deliveryZoneId"
                  required
                  disabled={formLocked}
                  value={deliveryZoneValue}
                  onChange={(event) => setDeliveryZoneId(event.target.value)}
                  className={inputClassName}
                >
                  <option value="">Elegí una zona</option>
                  {(config?.deliveryZones ?? []).map((zone) => (
                    <option key={zone.zoneId} value={zone.zoneId}>
                      {zone.zoneName} · {zone.cityName} ·{" "}
                      {formatCents(zone.feeCents)}
                    </option>
                  ))}
                </select>
              </label>
              {selectedDeliveryZone ? (
                <p className="text-xs text-muted">
                  Envío {formatCents(selectedDeliveryZone.feeCents)}
                  {selectedDeliveryZone.minimumOrderCents > 0
                    ? ` · mínimo ${formatCents(selectedDeliveryZone.minimumOrderCents)}`
                    : ""}
                  {selectedDeliveryZone.estimatedMinutes > 0
                    ? ` · ${selectedDeliveryZone.estimatedMinutes} min estimados`
                    : ""}
                </p>
              ) : null}
              {belowMinimum && selectedDeliveryZone ? (
                <p className="text-sm" role="status">
                  Para esta zona el pedido mínimo es de{" "}
                  {formatCents(selectedDeliveryZone.minimumOrderCents)}.
                </p>
              ) : null}
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Calle</span>
                <input
                  name="street"
                  autoComplete="address-line1"
                  required
                  disabled={formLocked}
                  value={streetValue}
                  onChange={(event) => setStreet(event.target.value)}
                  className={inputClassName}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Número</span>
                <input
                  name="number"
                  required
                  disabled={formLocked}
                  value={numberValue}
                  onChange={(event) => setNumber(event.target.value)}
                  className={inputClassName}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Piso / depto (opcional)</span>
                <input
                  name="floorApartment"
                  disabled={formLocked}
                  value={floorValue}
                  onChange={(event) => setFloorApartment(event.target.value)}
                  className={inputClassName}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Referencia (opcional)</span>
                <input
                  name="reference"
                  disabled={formLocked}
                  value={referenceValue}
                  onChange={(event) => setReference(event.target.value)}
                  className={inputClassName}
                />
              </label>
            </section>
          ) : null}

          <fieldset className="space-y-3" disabled={formLocked}>
            <legend className="text-lg font-semibold">Medio de pago</legend>
            {(config?.paymentMethods ?? []).map((method) => (
              <label
                key={method.code}
                className="flex min-h-11 items-start gap-3 rounded-md border border-border px-3 py-2 text-sm"
              >
                <input
                  type="radio"
                  name="paymentMethodCode"
                  value={method.code}
                  checked={paymentValue === method.code}
                  onChange={() => setPaymentMethodCode(method.code)}
                  className="mt-1"
                />
                <span className="font-medium">{method.label}</span>
              </label>
            ))}
            {selectedInstructions ? (
              <p className="rounded-md border border-border bg-white/60 px-3 py-2 text-sm text-muted">
                {selectedInstructions}
              </p>
            ) : null}
          </fieldset>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <section className="space-y-3 rounded-xl border border-border bg-white/70 p-4">
            <h2 className="text-lg font-semibold">Resumen</h2>
            <ul className="space-y-2 text-sm">
              {cart.lines.map((line) => (
                <li key={line.id} className="flex justify-between gap-2">
                  <span>
                    {line.quantity} × {line.productNameSnapshot}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted">
              Los precios definitivos se confirman al revisar el pedido.
            </p>
          </section>

          {reviewIsCurrent && review ? (
            <section className="space-y-3 rounded-xl border border-border bg-white/70 p-4">
              <h2 className="text-lg font-semibold">Revisión del pedido</h2>
              <p className="text-sm font-medium">{review.merchantName}</p>
              <ul className="space-y-2 text-sm">
                {review.lines.map((line) => (
                  <li key={`${line.productId}-${line.quantity}`}>
                    <div className="flex justify-between gap-2">
                      <span>
                        {line.quantity} × {line.productName}
                      </span>
                      <span>{formatCents(line.lineTotalCents)}</span>
                    </div>
                    {line.options.length > 0 ? (
                      <ul className="mt-1 space-y-0.5 text-xs text-muted">
                        {line.options.map((option) => (
                          <li
                            key={`${option.optionGroupId}-${option.optionChoiceId}`}
                          >
                            {option.choiceName} × {option.quantity}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between gap-2">
                  <dt>Subtotal</dt>
                  <dd>{formatCents(review.orderSubtotalCents)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Envío</dt>
                  <dd>{formatCents(review.deliveryFeeCents)}</dd>
                </div>
                <div className="flex justify-between gap-2 font-semibold">
                  <dt>Total</dt>
                  <dd>{formatCents(review.totalCents)}</dd>
                </div>
              </dl>
              <p className="text-sm">
                {fulfillmentLabel(review.fulfillmentMethod)}
              </p>
              {review.delivery ? (
                <p className="text-xs text-muted">
                  {review.delivery.street} {review.delivery.number}
                  {review.delivery.floorApartment
                    ? `, ${review.delivery.floorApartment}`
                    : ""}
                  {" · "}
                  {review.delivery.zoneName}, {review.delivery.cityName}
                </p>
              ) : null}
              <p className="text-sm">
                {review.payment.label}
                {review.payment.instructions
                  ? ` — ${review.payment.instructions}`
                  : ""}
              </p>
            </section>
          ) : null}

          {error ? (
            <p className="text-sm" role="alert" aria-live="assertive">
              {errorCode === CHECKOUT_ERROR_CODES.DELIVERY_MINIMUM_NOT_MET &&
              selectedDeliveryZone
                ? `Para esta zona el pedido mínimo es de ${formatCents(selectedDeliveryZone.minimumOrderCents)}.`
                : error}
            </p>
          ) : null}

          {isStaleCartError(errorCode ?? "") ? (
            <Link
              href="/carrito"
              className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm"
            >
              Volver al carrito
            </Link>
          ) : null}

          {attempt.phase === "unknown" ? (
            <div className="space-y-2" aria-live="polite">
              <p className="text-sm">
                No pudimos confirmar la respuesta del servidor.
              </p>
              <button
                type="button"
                onClick={() => void handleRetry()}
                disabled={confirming}
                className="min-h-11 w-full rounded-md bg-accent px-4 text-sm font-medium text-white disabled:opacity-60"
              >
                {confirming ? "Confirmando pedido…" : "Reintentar confirmación"}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => void handleReview()}
                disabled={!canReview}
                className="min-h-11 w-full rounded-md border border-border px-4 text-sm font-medium disabled:opacity-60"
              >
                {reviewing ? "Revisando…" : "Revisar pedido"}
              </button>
              {reviewIsCurrent ? (
                <button
                  type="button"
                  onClick={() => void handleConfirm()}
                  disabled={!canConfirm}
                  className="min-h-11 w-full rounded-md bg-accent px-4 text-sm font-medium text-white disabled:opacity-60"
                >
                  {confirming ? "Confirmando pedido…" : "Confirmar pedido"}
                </button>
              ) : null}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
