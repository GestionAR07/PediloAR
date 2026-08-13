"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  addProductToCart,
  clearCart,
  removeCartLine,
  replaceCartWithProduct,
  resolveStockCap,
  setCartLineQuantity,
  type AddToCartInput,
} from "@/domain/cart/cart-operations";
import {
  calculateCartBadgeCount,
  calculateCartTotalCents,
} from "@/domain/cart/pricing";
import {
  EMPTY_CART,
  getCartSnapshot,
  getServerCartSnapshot,
  setCartSnapshot,
  subscribeCart,
} from "@/lib/cart/cart-store";

export type PendingAdd = Omit<AddToCartInput, "createLineId"> & {
  createLineId?: () => string;
};

export type TryAddResult =
  | { status: "added"; merged: boolean }
  | {
      status: "merchant_conflict";
      pending: PendingAdd;
      currentMerchantName: string;
    }
  | { status: "invalid_quantity" };

type CartContextValue = {
  cart: ReturnType<typeof getCartSnapshot>;
  hydrated: boolean;
  badgeCount: number;
  totalCents: number;
  tryAdd: (input: PendingAdd) => TryAddResult;
  confirmReplaceAndAdd: (pending: PendingAdd) => void;
  setLineQuantity: (
    lineId: string,
    quantity: number,
    stockMode?: string,
    stockQuantity?: number | null,
  ) => void;
  removeLine: (lineId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function createLineId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `line-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toAddInput(pending: PendingAdd): AddToCartInput {
  return {
    ...pending,
    createLineId: pending.createLineId ?? createLineId,
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const cart = useSyncExternalStore(
    subscribeCart,
    getCartSnapshot,
    getServerCartSnapshot,
  );
  const hydrated = useSyncExternalStore(
    subscribeCart,
    () => true,
    () => false,
  );

  const tryAdd = useCallback((input: PendingAdd): TryAddResult => {
    const current = getCartSnapshot();
    const outcome = addProductToCart(current, toAddInput(input));
    if (!outcome.ok) {
      if (outcome.reason === "merchant_conflict") {
        return {
          status: "merchant_conflict",
          pending: input,
          currentMerchantName: current.merchantNameSnapshot,
        };
      }
      return { status: "invalid_quantity" };
    }
    setCartSnapshot(outcome.cart);
    return { status: "added", merged: outcome.merged };
  }, []);

  const confirmReplaceAndAdd = useCallback((pending: PendingAdd) => {
    const outcome = replaceCartWithProduct(toAddInput(pending));
    setCartSnapshot(outcome.ok ? outcome.cart : EMPTY_CART);
  }, []);

  const setLineQuantity = useCallback(
    (
      lineId: string,
      quantity: number,
      stockMode?: string,
      stockQuantity?: number | null,
    ) => {
      const stockCap =
        stockMode != null ? resolveStockCap(stockMode, stockQuantity) : null;
      setCartSnapshot(
        setCartLineQuantity(getCartSnapshot(), lineId, quantity, stockCap),
      );
    },
    [],
  );

  const removeLine = useCallback((lineId: string) => {
    setCartSnapshot(removeCartLine(getCartSnapshot(), lineId));
  }, []);

  const clear = useCallback(() => {
    setCartSnapshot(clearCart());
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      hydrated,
      badgeCount: calculateCartBadgeCount(cart.lines),
      totalCents: calculateCartTotalCents(cart.lines),
      tryAdd,
      confirmReplaceAndAdd,
      setLineQuantity,
      removeLine,
      clear,
    }),
    [
      cart,
      hydrated,
      tryAdd,
      confirmReplaceAndAdd,
      setLineQuantity,
      removeLine,
      clear,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within CartProvider");
  }
  return ctx;
}
