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
import { formatConfigurationSummary } from "@/domain/cart/validate-configuration";
import { isCartEmpty } from "@/domain/cart/types";
import { moneyCents } from "@/domain/money/money-cents";
import { formatMoneyCentsArs } from "@/lib/format-money";
import { useCart } from "@/components/cart/cart-provider";
import {
  BikeIcon,
  ShoppingBagIcon,
  StoreIcon,
} from "@/components/ui/public-icons";
import {
  getCheckoutConfigurationAction,
  placeOrderAction,
  reviewCheckoutAction,
} from "@/app/checkout/actions";
import {
  clearAttemptQuote,
  createIdempotencyKey,
  markAttemptReviewed,
  resolveAttemptForSignature,
} from "@/lib/checkout/session";
import {
  applyCheckoutActionFailure,
  applyUnknownNetworkOutcome,
  canShowAuthoritativeReview,
  canShowConfirmButton,
} from "@/lib/checkout/review-invalidation";
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
import {
  playOrderConfirmationSound,
  prepareOrderConfirmationSound,
} from "@/lib/order-confirmation-sound";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-violet)]";

const inputClassName = `checkout-input min-h-12 w-full rounded-2xl border border-violet-100 bg-white px-4 py-3 text-sm outline-none ring-accent focus-visible:ring-2 disabled:opacity-60 ${focusRing}`;

const choiceBase =
  "checkout-choice flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition";
const choiceIdle = `${choiceBase} border-violet-100 bg-white text-[var(--ps-night-900)]`;
const choiceActive = `${choiceBase} checkout-choice--active border-violet-300 bg-violet-50 text-[var(--ps-night-900)]`;

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

export function CheckoutPageClient({
  initialCustomer,
}: {
  initialCustomer: { name: string; phone: string };
}) {
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
  const [customerName, setCustomerName] = useState(initialCustomer.name);
  const [customerPhone, setCustomerPhone] = useState(initialCustomer.phone);
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
  const minimumRemainingCents =
    belowMinimum && selectedDeliveryZone
      ? selectedDeliveryZone.minimumOrderCents - totalCents
      : 0;
  const configLoading =
    hydrated &&
    !isCartEmpty(cart) &&
    !success &&
    config === null &&
    configError === null;

  const canReview =
    !formLocked &&
    !reviewing &&
    !belowMinimum &&
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

  const showAuthoritativeReview = canShowAuthoritativeReview({
    review,
    attempt,
    errorCode,
    requestSignature: signature,
  });
  const showConfirm = canShowConfirmButton({
    review,
    attempt,
    errorCode,
    merchantAccepting: Boolean(config?.merchant.acceptingOrders),
    requestInFlight: false,
    requestSignature: signature,
  });
  const canConfirm = showConfirm && !confirming && !reviewing;

  function buildDraft(fingerprint: string | null): CheckoutFormDraft {
    return {
      ...draftForSignature,
      idempotencyKey: attempt.idempotencyKey,
      expectedQuoteFingerprint: fingerprint,
    };
  }

  function applyReviewSlice(slice: {
    review: typeof review;
    attempt: typeof attempt;
    error: string | null;
    errorCode: string | null;
    clearFrozen: boolean;
  }): void {
    setReview(slice.review);
    setCheckoutAttempt(slice.attempt);
    setError(slice.error);
    setErrorCode(slice.errorCode);
    if (slice.clearFrozen) {
      setFrozenCheckoutDraft(null);
    }
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
        applyReviewSlice(
          applyCheckoutActionFailure({ review, attempt }, result),
        );
        return;
      }
      setError(null);
      setErrorCode(null);
      setReview(result.review);
      setCheckoutAttempt(
        markAttemptReviewed(attempt, result.review.quoteFingerprint),
      );
    } catch {
      setReview(null);
      setCheckoutAttempt(clearAttemptQuote(attempt));
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
      await prepareOrderConfirmationSound();
      const result = await placeOrderAction({ cart, draft });
      if (!result.ok) {
        applyReviewSlice(
          applyCheckoutActionFailure({ review, attempt }, result),
        );
        return;
      }
      void playOrderConfirmationSound(result.order.orderId);
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
      applyReviewSlice(applyUnknownNetworkOutcome({ review, attempt }));
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

  const contactInvalid = errorCode === CHECKOUT_ERROR_CODES.CONTACT_INVALID;
  const addressInvalid =
    errorCode === CHECKOUT_ERROR_CODES.DELIVERY_ADDRESS_REQUIRED;
  const zoneInvalid = errorCode === CHECKOUT_ERROR_CODES.DELIVERY_ZONE_REQUIRED;

  if (!hydrated) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-sm text-muted" role="status">
          Cargando checkout…
        </p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-10 sm:px-6 lg:px-8">
        <section
          className="checkout-success mx-auto w-full max-w-md space-y-5 rounded-[1.75rem] border border-violet-100/70 bg-white p-6 text-center shadow-soft sm:p-8"
          aria-live="polite"
        >
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
            <ShoppingBagIcon className="h-7 w-7" />
          </span>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-[var(--ps-night-900)]">
            Pedido recibido
          </h1>
          <p className="text-sm text-muted">
            El comercio recibió tu pedido. Ahora está pendiente de aceptación.
          </p>
          <dl className="space-y-2 rounded-2xl bg-violet-50/70 p-4 text-left text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Referencia</dt>
              <dd className="font-bold">{success.orderRef}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Comercio</dt>
              <dd className="font-medium">{success.merchantName}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Total</dt>
              <dd className="font-extrabold tabular-nums">
                {formatCents(success.totalCents)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Modalidad</dt>
              <dd className="font-medium">
                {fulfillmentLabel(success.fulfillmentMethod)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Estado</dt>
              <dd className="font-medium">Pendiente de aceptación</dd>
            </div>
          </dl>
          <Link
            href={`/cuenta/pedidos/${success.orderId}`}
            className={`grad-btn inline-flex min-h-12 w-full items-center justify-center rounded-full px-4 text-sm font-extrabold text-white shadow-glow ${focusRing}`}
          >
            Seguir mi pedido
          </Link>
          <Link
            href="/"
            className={`inline-flex min-h-11 w-full items-center justify-center rounded-full border border-violet-100 px-4 text-sm font-bold text-violet-800 ${focusRing}`}
          >
            Volver al inicio
          </Link>
        </section>
      </div>
    );
  }

  if (isCartEmpty(cart)) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-10 sm:px-6 lg:px-8">
        <div className="checkout-empty mx-auto w-full max-w-md rounded-[1.75rem] border border-violet-100/70 bg-white px-6 py-12 text-center shadow-soft">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
            <ShoppingBagIcon className="h-7 w-7" />
          </span>
          <h1 className="font-display mt-5 text-2xl font-extrabold tracking-tight text-[var(--ps-night-900)]">
            Checkout
          </h1>
          <p className="mt-2 text-sm text-muted">
            Tu carrito está vacío. Agregá productos antes de continuar.
          </p>
          <Link
            href="/carrito"
            className={`grad-btn mt-6 inline-flex min-h-12 items-center justify-center rounded-full px-6 text-sm font-extrabold text-white shadow-glow ${focusRing}`}
          >
            Ir al carrito
          </Link>
        </div>
      </div>
    );
  }

  const selectedInstructions = selectedPayment?.instructions?.trim() ?? "";
  const merchantLabel = config?.merchant.name ?? cart.merchantNameSnapshot;
  const cartItemCount = cart.lines.reduce(
    (sum, line) => sum + line.quantity,
    0,
  );
  const serverMinimumError =
    errorCode === CHECKOUT_ERROR_CODES.DELIVERY_MINIMUM_NOT_MET;
  const showMinimumHint =
    belowMinimum && Boolean(selectedDeliveryZone) && !serverMinimumError;
  const displayedError =
    errorCode === CHECKOUT_ERROR_CODES.DELIVERY_MINIMUM_NOT_MET &&
    selectedDeliveryZone
      ? `Para esta zona el pedido mínimo es de ${formatCents(selectedDeliveryZone.minimumOrderCents)}.`
      : error;
  const shellPadding = showConfirm
    ? "pb-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:pb-12"
    : "pb-10 lg:pb-12";

  return (
    <div
      className={`mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8 ${shellPadding}`}
    >
      <p className="text-sm">
        <Link
          href="/carrito"
          className={`inline-flex items-center font-bold text-violet-800 underline-offset-4 hover:underline ${focusRing}`}
        >
          ← Volver al carrito
        </Link>
      </p>

      <header className="checkout-intro mt-5 max-w-2xl space-y-2">
        <p className="text-[11px] font-bold tracking-wider text-violet-700 uppercase">
          Pedido local
        </p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-[var(--ps-night-900)]">
          Finalizá tu pedido
        </h1>
        <p className="flex items-center gap-2 text-sm font-medium text-muted">
          <StoreIcon className="h-4 w-4 shrink-0 text-violet-600" />
          <span className="min-w-0 truncate">{merchantLabel}</span>
        </p>
        <p className="text-sm text-muted">
          Completá tus datos, revisá el pedido y confirmá. La disponibilidad y
          las condiciones de entrega se validan al revisar el pedido.
        </p>
        <p className="text-xs font-bold tracking-wide text-violet-700">
          {showAuthoritativeReview ? (
            <>
              Datos listos · Revisado ·{" "}
              <span className="text-[var(--ps-night-900)]">Confirmá</span>
            </>
          ) : (
            <>
              Completá ·{" "}
              <span className="text-[var(--ps-night-900)]">Revisá</span> ·
              Confirmá
            </>
          )}
        </p>
      </header>

      {configLoading ? (
        <p className="mt-4 text-sm text-muted" role="status">
          Cargando datos del comercio…
        </p>
      ) : null}

      {configError ? (
        <p
          className="checkout-alert mt-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm"
          role="alert"
        >
          {configError}
        </p>
      ) : null}

      {config && !config.merchant.acceptingOrders ? (
        <p
          className="checkout-alert mt-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm"
          role="alert"
        >
          Este comercio no está tomando pedidos en este momento.
        </p>
      ) : null}

      {config && config.paymentMethods.length === 0 ? (
        <p
          className="checkout-alert mt-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm"
          role="alert"
        >
          Este comercio todavía no configuró medios de pago.
        </p>
      ) : null}

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1.62fr)_minmax(18rem,0.9fr)] lg:gap-8">
        <div className="space-y-5">
          <section className="checkout-section space-y-4 rounded-[1.75rem] border border-violet-100/70 bg-white p-5 shadow-soft">
            <h2 className="font-display text-lg font-extrabold tracking-tight text-[var(--ps-night-900)]">
              Tus datos
            </h2>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-bold">Nombre</span>
              <input
                name="customerName"
                autoComplete="name"
                maxLength={80}
                required
                disabled={formLocked}
                aria-invalid={contactInvalid}
                value={nameValue}
                onChange={(event) => setCustomerName(event.target.value)}
                className={inputClassName}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-bold">Teléfono</span>
              <input
                name="customerPhone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={32}
                required
                disabled={formLocked}
                aria-invalid={contactInvalid}
                value={phoneValue}
                onChange={(event) => setCustomerPhone(event.target.value)}
                className={inputClassName}
              />
            </label>
          </section>

          <section className="checkout-section space-y-4 rounded-[1.75rem] border border-violet-100/70 bg-white p-5 shadow-soft">
            <h2 className="font-display text-lg font-extrabold tracking-tight text-[var(--ps-night-900)]">
              Cómo lo recibís
            </h2>
            <fieldset
              className="m-0 min-w-0 space-y-3 border-0 p-0"
              disabled={formLocked}
            >
              <legend className="sr-only">Cómo lo recibís</legend>
              {pickupAvailable ? (
                <label
                  className={
                    fulfillmentValue === "PICKUP" ? choiceActive : choiceIdle
                  }
                >
                  <input
                    type="radio"
                    name="fulfillmentMethod"
                    value="PICKUP"
                    checked={fulfillmentValue === "PICKUP"}
                    onChange={() => setFulfillmentMethod("PICKUP")}
                    className="mt-1 accent-violet-700"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-bold">
                      <StoreIcon className="h-4 w-4 shrink-0 text-violet-600" />
                      Retiro en el comercio
                    </span>
                    {config ? (
                      <span className="mt-1 block text-xs text-muted">
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
                <label
                  className={
                    fulfillmentValue === "MERCHANT_DELIVERY"
                      ? choiceActive
                      : choiceIdle
                  }
                >
                  <input
                    type="radio"
                    name="fulfillmentMethod"
                    value="MERCHANT_DELIVERY"
                    checked={fulfillmentValue === "MERCHANT_DELIVERY"}
                    onChange={() => setFulfillmentMethod("MERCHANT_DELIVERY")}
                    className="mt-1 accent-violet-700"
                  />
                  <span className="flex items-center gap-2 font-bold">
                    <BikeIcon className="h-4 w-4 shrink-0 text-violet-600" />
                    Envío a domicilio
                  </span>
                </label>
              ) : null}
              {!pickupAvailable && !deliveryAvailable && config ? (
                <p className="text-sm text-muted">
                  Este comercio no tiene retiro ni envío disponible.
                </p>
              ) : null}
            </fieldset>
          </section>

          {fulfillmentValue === "MERCHANT_DELIVERY" ? (
            <section className="checkout-section checkout-address space-y-4 rounded-[1.75rem] border border-violet-100/70 bg-white p-5 shadow-soft">
              <h2 className="font-display text-lg font-extrabold tracking-tight text-[var(--ps-night-900)]">
                Dirección
              </h2>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-bold">Zona de envío</span>
                <select
                  name="deliveryZoneId"
                  required
                  disabled={formLocked}
                  aria-invalid={zoneInvalid}
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
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-bold">Calle</span>
                <input
                  name="street"
                  autoComplete="address-line1"
                  required
                  disabled={formLocked}
                  aria-invalid={addressInvalid}
                  value={streetValue}
                  onChange={(event) => setStreet(event.target.value)}
                  className={inputClassName}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-bold">Número</span>
                <input
                  name="number"
                  required
                  disabled={formLocked}
                  aria-invalid={addressInvalid}
                  value={numberValue}
                  onChange={(event) => setNumber(event.target.value)}
                  className={inputClassName}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-bold">Piso / depto (opcional)</span>
                <input
                  name="floorApartment"
                  disabled={formLocked}
                  value={floorValue}
                  onChange={(event) => setFloorApartment(event.target.value)}
                  className={inputClassName}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-bold">Referencia (opcional)</span>
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

          <section className="checkout-section space-y-4 rounded-[1.75rem] border border-violet-100/70 bg-white p-5 shadow-soft">
            <h2 className="font-display text-lg font-extrabold tracking-tight text-[var(--ps-night-900)]">
              Cómo pagás
            </h2>
            <fieldset
              className="m-0 min-w-0 space-y-3 border-0 p-0"
              disabled={formLocked}
            >
              <legend className="sr-only">Cómo pagás</legend>
              {(config?.paymentMethods ?? []).map((method) => (
                <label
                  key={method.code}
                  className={
                    paymentValue === method.code ? choiceActive : choiceIdle
                  }
                >
                  <input
                    type="radio"
                    name="paymentMethodCode"
                    value={method.code}
                    checked={paymentValue === method.code}
                    onChange={() => setPaymentMethodCode(method.code)}
                    className="mt-1 accent-violet-700"
                  />
                  <span className="font-bold">{method.label}</span>
                </label>
              ))}
              {selectedInstructions ? (
                <p className="rounded-2xl border border-violet-100 bg-violet-50/70 px-4 py-3 text-sm text-muted">
                  {selectedInstructions}
                </p>
              ) : null}
            </fieldset>
          </section>

          {error ? (
            <p
              className="checkout-alert rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
              role="alert"
              aria-live="assertive"
            >
              {displayedError}
            </p>
          ) : null}

          {errorCode === CHECKOUT_ERROR_CODES.AUTHENTICATION_REQUIRED ? (
            <Link
              href="/login?next=/checkout"
              className={`inline-flex min-h-11 w-full items-center justify-center rounded-full border border-violet-200 px-4 text-sm font-extrabold text-violet-800 ${focusRing}`}
            >
              Volver a ingresar
            </Link>
          ) : null}

          {isStaleCartError(errorCode ?? "") ? (
            <Link
              href="/carrito"
              className={`inline-flex min-h-11 items-center justify-center rounded-full border border-violet-100 px-4 text-sm font-bold text-violet-800 ${focusRing}`}
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
                className={`grad-btn min-h-12 w-full rounded-full px-4 text-sm font-extrabold text-white shadow-glow disabled:opacity-60 ${focusRing}`}
              >
                {confirming ? "Confirmando pedido…" : "Reintentar confirmación"}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {showMinimumHint && selectedDeliveryZone ? (
                <p
                  className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
                  role="status"
                >
                  Pedido mínimo de esta zona:{" "}
                  {formatCents(selectedDeliveryZone.minimumOrderCents)}. Agregá{" "}
                  {formatCents(minimumRemainingCents)} más para continuar.
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => void handleReview()}
                disabled={!canReview}
                className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-extrabold disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-500 disabled:opacity-100 ${focusRing} ${
                  showAuthoritativeReview
                    ? "border border-violet-100 bg-violet-50/80 text-violet-700"
                    : "border border-violet-200 bg-white text-violet-800"
                }`}
              >
                {reviewing ? (
                  <>
                    <span className="checkout-spinner" aria-hidden />
                    Revisando…
                  </>
                ) : showAuthoritativeReview ? (
                  "Volver a revisar"
                ) : (
                  "Revisar pedido"
                )}
              </button>
            </div>
          )}
        </div>

        <aside className="checkout-summary-panel flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <section
            className={`space-y-3 rounded-[1.75rem] border border-violet-100/70 bg-white shadow-soft ${
              showAuthoritativeReview && review ? "order-2 p-4" : "order-1 p-5"
            }`}
          >
            <h2
              className={`font-display font-extrabold tracking-tight text-[var(--ps-night-900)] ${
                showAuthoritativeReview && review ? "text-base" : "text-lg"
              }`}
            >
              Resumen
            </h2>
            {showAuthoritativeReview && review ? (
              <>
                <p className="text-sm font-medium text-muted">
                  {merchantLabel}
                </p>
                <p className="text-sm text-muted">
                  {cartItemCount}{" "}
                  {cartItemCount === 1 ? "producto" : "productos"} · Subtotal de
                  productos {formatCents(totalCents)}
                </p>
                <p className="text-xs text-muted">
                  El detalle completo está en la revisión del pedido.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-muted">
                  {merchantLabel}
                </p>
                <ul className="space-y-2 text-sm">
                  {cart.lines.map((line) => {
                    const summary = formatConfigurationSummary(
                      line.configuration,
                    );
                    return (
                      <li key={line.id}>
                        <span className="font-medium">
                          {line.quantity} × {line.productNameSnapshot}
                        </span>
                        {summary.length > 0 ? (
                          <ul className="mt-0.5 space-y-0.5 text-xs text-muted">
                            {summary.map((row) => (
                              <li key={row}>{row}</li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                <div className="flex items-end justify-between gap-3 border-t border-violet-100 pt-3">
                  <span className="text-sm font-bold text-slate-500">
                    Subtotal de productos
                  </span>
                  <span
                    key={totalCents}
                    className="checkout-total-value font-display text-lg font-extrabold tabular-nums"
                  >
                    {formatCents(totalCents)}
                  </span>
                </div>
                {fulfillmentValue === "MERCHANT_DELIVERY" &&
                selectedDeliveryZone ? (
                  <p className="text-xs text-muted">
                    Envío de zona: {formatCents(selectedDeliveryZone.feeCents)}.
                  </p>
                ) : null}
              </>
            )}
          </section>

          {showAuthoritativeReview && review ? (
            <section className="checkout-review-panel order-1 space-y-3 rounded-[1.75rem] border border-violet-200 bg-violet-50/60 p-5 shadow-soft">
              <h2 className="font-display text-lg font-extrabold tracking-tight text-[var(--ps-night-900)]">
                Revisión del pedido
              </h2>
              <p className="text-sm font-medium">{review.merchantName}</p>
              <p className="text-xs font-bold tracking-wider text-violet-700 uppercase">
                Pedido revisado
              </p>
              <ul className="space-y-2 text-sm">
                {review.lines.map((line) => (
                  <li key={`${line.productId}-${line.quantity}`}>
                    <div className="flex justify-between gap-2">
                      <span>
                        {line.quantity} × {line.productName}
                      </span>
                      <span className="tabular-nums">
                        {formatCents(line.lineTotalCents)}
                      </span>
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
                  <dt>Subtotal de productos</dt>
                  <dd className="tabular-nums">
                    {formatCents(review.orderSubtotalCents)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Envío</dt>
                  <dd className="tabular-nums">
                    {formatCents(review.deliveryFeeCents)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 font-extrabold">
                  <dt>Total</dt>
                  <dd
                    key={review.totalCents}
                    className="checkout-total-value tabular-nums"
                  >
                    {formatCents(review.totalCents)}
                  </dd>
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
              {showConfirm ? (
                <button
                  type="button"
                  onClick={() => void handleConfirm()}
                  disabled={!canConfirm}
                  className={`grad-btn hidden min-h-12 w-full items-center justify-center rounded-full px-4 text-sm font-extrabold text-white shadow-glow disabled:opacity-60 lg:inline-flex ${focusRing}`}
                >
                  {confirming ? "Confirmando pedido…" : "Confirmar pedido"}
                </button>
              ) : null}
            </section>
          ) : null}
        </aside>
      </div>

      {showConfirm ? (
        <div className="checkout-sticky-bar pointer-events-none fixed inset-x-0 bottom-0 z-20 lg:hidden">
          <div className="pointer-events-auto mx-auto max-w-6xl px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:px-6">
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={!canConfirm}
              className={`grad-btn flex min-h-12 w-full items-center justify-between gap-3 rounded-full px-5 text-sm font-extrabold whitespace-nowrap text-white shadow-glow disabled:opacity-60 ${focusRing}`}
            >
              <span>
                {confirming ? "Confirmando pedido…" : "Confirmar pedido"}
              </span>
              <span className="shrink-0 tabular-nums">
                {review ? formatCents(review.totalCents) : ""}
              </span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
