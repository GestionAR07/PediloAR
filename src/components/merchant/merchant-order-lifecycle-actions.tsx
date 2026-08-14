"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  completeMerchantPickupOrderAction,
  markMerchantOrderReadyAction,
  startPreparingMerchantOrderAction,
  type MerchantOrderActionState,
} from "@/app/merchant/[merchantId]/orders/actions";
import { MerchantPendingOrderActions } from "./merchant-pending-order-actions";

type Props = {
  merchantId: string;
  orderId: string;
  status: string;
  fulfillmentMethod: string;
};

const buttonClassName =
  "min-h-11 w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60";

type ProgressionProps = {
  merchantId: string;
  orderId: string;
  label: string;
  pendingLabel: string;
  fallbackError: string;
  run: (
    merchantId: string,
    orderId: string,
  ) => Promise<MerchantOrderActionState>;
};

function MerchantProgressionAction({
  merchantId,
  orderId,
  label,
  pendingLabel,
  fallbackError,
  run,
}: ProgressionProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    startTransition(async () => {
      setError(null);
      const result = await run(merchantId, orderId);
      if (!result.ok) {
        setError(result.message ?? fallbackError);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2" aria-busy={pending}>
      <button
        type="button"
        disabled={pending}
        onClick={onClick}
        className={buttonClassName}
      >
        {pending ? pendingLabel : label}
      </button>
      {error ? (
        <p className="text-sm text-red-900" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function MerchantOrderLifecycleActions({
  merchantId,
  orderId,
  status,
  fulfillmentMethod,
}: Props) {
  if (status === "PENDING") {
    return (
      <MerchantPendingOrderActions merchantId={merchantId} orderId={orderId} />
    );
  }

  if (status === "ACCEPTED") {
    return (
      <MerchantProgressionAction
        merchantId={merchantId}
        orderId={orderId}
        label="Comenzar preparación"
        pendingLabel="Comenzando..."
        fallbackError="No se pudo comenzar la preparación."
        run={startPreparingMerchantOrderAction}
      />
    );
  }

  if (status === "PREPARING") {
    return (
      <MerchantProgressionAction
        merchantId={merchantId}
        orderId={orderId}
        label="Marcar listo"
        pendingLabel="Marcando listo..."
        fallbackError="No se pudo marcar el pedido como listo."
        run={markMerchantOrderReadyAction}
      />
    );
  }

  if (status === "READY" && fulfillmentMethod === "PICKUP") {
    return (
      <MerchantProgressionAction
        merchantId={merchantId}
        orderId={orderId}
        label="Marcar retirado"
        pendingLabel="Marcando retirado..."
        fallbackError="No se pudo marcar el retiro."
        run={completeMerchantPickupOrderAction}
      />
    );
  }

  if (status === "READY" && fulfillmentMethod === "MERCHANT_DELIVERY") {
    return <p className="text-sm text-muted">Listo para iniciar el envío.</p>;
  }

  return null;
}
