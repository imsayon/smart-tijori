'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import type { Cart, Hold, Order } from '@/contracts';
import { api, ApiClientError } from '@/lib/api-client';
import { useStore } from '@/lib/session/store-context';
import { OperationKeyManager } from '@/lib/checkout/operation-key';
import { formatPaise } from '@/lib/utils/currency';
import { HoldStatusCard } from '../reservation/hold-status-card';
import { SimulatedPaymentReceipt } from './simulated-payment-receipt';
import { ConflictRecoveryPanel } from '../recovery/conflict-recovery-panel';
import { Alert } from '../feedback/alert';

type CheckoutState =
  | 'CREATING_HOLD'
  | 'HOLD_ACTIVE'
  | 'STOCK_CONFLICT'
  | 'HOLD_EXPIRED'
  | 'CONFIRMING_ORDER'
  | 'ORDER_CONFIRMED';

function revision(cart: Cart) {
  return JSON.stringify([cart.id, cart.storeId, cart.totalPaise, cart.lines.map(line => [line.productId, line.quantity])]);
}

export function CheckoutView() {
  const { cart, refreshCart } = useStore();
  const [state, setState] = useState<CheckoutState>('CREATING_HOLD');
  const [hold, setHold] = useState<Hold | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [unavailableProducts, setUnavailableProducts] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const isReservingRef = useRef<boolean>(false);
  const holdKeyRef = useRef<string>('');
  const orderKeyRef = useRef<string>('');
  const hasRequestedInitialRef = useRef<boolean>(false);

  // Track which cart ID the current checkout flow was started for.
  // When the cart ID changes (e.g. user completed an order and started a new cart),
  // we must reset the entire checkout state so the old receipt doesn't stick.
  const checkoutCartIdRef = useRef<string | null>(null);

  // Compute a stable cart fingerprint that changes when the cart content changes
  const cartFingerprint = cart ? revision(cart) : '';

  // Reset checkout state when cart has meaningfully changed after an order
  useEffect(() => {
    if (!cart || cart.lines.length === 0) return;

    const isNewCheckoutNeeded =
      checkoutCartIdRef.current !== null &&
      cartFingerprint !== checkoutCartIdRef.current;

    if (isNewCheckoutNeeded && (state === 'ORDER_CONFIRMED' || hold)) {
      // Cart has changed since the last checkout — reset everything for a fresh flow
      setHold(null);
      setOrder(null);
      setState('CREATING_HOLD');
      setErrorMessage(null);
      holdKeyRef.current = '';
      orderKeyRef.current = '';
      hasRequestedInitialRef.current = false;
      checkoutCartIdRef.current = cartFingerprint;
    } else if (checkoutCartIdRef.current === null) {
      // First time entering checkout — register the current cart
      checkoutCartIdRef.current = cartFingerprint;
    }
  }, [cartFingerprint, state, hold, cart]);
  const requestReservation = useCallback(
    async (options?: { forceNewKey?: boolean; updatedCart?: Cart }) => {
      const reservationCart = options?.updatedCart ?? cart;
      if (!reservationCart || reservationCart.lines.length === 0) return;
      if (isReservingRef.current) return;

      isReservingRef.current = true;
      setIsSubmitting(true);

      // Stable idempotency key for this exact cart snapshot (lines, quantities, and price)
      const intentId = `hold_${revision(reservationCart)}`;

      let holdKey: string;
      if (options?.forceNewKey) {
        // Genuinely new reservation attempt (e.g. Re-reserve after hold expiry or replacement approval)
        holdKey = OperationKeyManager.generateNewKey(intentId);
      } else if (holdKeyRef.current) {
        // Network retry of the same in-flight operation
        holdKey = holdKeyRef.current;
      } else {
        // Initial checkout reservation
        holdKey = OperationKeyManager.getOrCreateKey(intentId);
      }

      holdKeyRef.current = holdKey;

      try {
        setState('CREATING_HOLD');
        setErrorMessage(null);

        const activeHold = await api.createReservation(reservationCart.id, holdKey);
        setHold(activeHold);
        setState('HOLD_ACTIVE');
        setErrorMessage(null);
      } catch (err) {
        if (err instanceof ApiClientError && err.code === 'STOCK_UNAVAILABLE') {
          const details = err.details as { unavailableProducts?: string[] };
          setUnavailableProducts(details?.unavailableProducts ?? []);
          setState('STOCK_CONFLICT');
        } else if (err instanceof ApiClientError) {
          setErrorMessage(err.message);
          setState('HOLD_EXPIRED');
        } else {
          setErrorMessage('Failed to connect to checkout reservation service. You can safely retry.');
          setState('HOLD_EXPIRED');
        }
      } finally {
        isReservingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [cart]
  );

  useEffect(() => {
    let active = true;
    if (active && !hasRequestedInitialRef.current && cart && cart.lines.length > 0) {
      hasRequestedInitialRef.current = true;
      void requestReservation();
    }
    return () => {
      active = false;
    };
  }, [cart, requestReservation]);

  const handleConfirmOrder = async () => {
    if (!hold || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setState('CONFIRMING_ORDER');
      setErrorMessage(null);

      if (!orderKeyRef.current) {
        orderKeyRef.current = OperationKeyManager.getOrCreateKey(`order_${hold.id}`);
      }

      const confirmedOrder = await api.confirmOrder(hold.id, orderKeyRef.current);
      // Clear operation keys so subsequent shopping carts start with a clean slate
      OperationKeyManager.clearAll();
      setOrder(confirmedOrder);
      setState('ORDER_CONFIRMED');
      await refreshCart();
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'HOLD_EXPIRED') {
        setState('HOLD_EXPIRED');
        setErrorMessage('Your 59-second checkout hold has expired. Please revalidate and reserve again.');
      } else if (err instanceof ApiClientError) {
        setErrorMessage(err.message);
        setState('HOLD_ACTIVE');
      } else {
        setErrorMessage('Network error confirming order. You can safely retry.');
        setState('HOLD_ACTIVE');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetryReservation = () => {
    if (isReservingRef.current) return;
    const isNetworkRetry = Boolean(errorMessage && holdKeyRef.current);
    setHold(null);
    void requestReservation({ forceNewKey: !isNetworkRetry });
  };

  const handleHoldExpired = useCallback(() => {
    setErrorMessage(null);
    setState('HOLD_EXPIRED');
  }, []);

  const handleReplacementApproved = async (updatedCart: Cart) => {
    checkoutCartIdRef.current = revision(updatedCart);
    setHold(null);
    await refreshCart();
    await requestReservation({ forceNewKey: true, updatedCart });
  };

  const handleRemoveUnavailableAndProceed = async () => {
    if (!cart || isReservingRef.current) return;
    const remaining = cart.lines
      .filter(line => !unavailableProducts.includes(line.productId))
      .map(({ productId, quantity }) => ({ productId, quantity }));
    const updated = await api.updateCart(cart.storeId, remaining);
    setUnavailableProducts([]);
    await handleReplacementApproved(updated);
  };

  if (!cart || cart.lines.length === 0) {
    if (state === 'ORDER_CONFIRMED' && order) {
      return <SimulatedPaymentReceipt order={order} />;
    }

    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <h2 className="text-xl font-bold text-stone-800 mb-2">No active cart for checkout</h2>
        <p className="text-xs text-stone-500 mb-4">Please add items from your local branch.</p>
        <Link
          href="/"
          className="bg-[#173F35] text-white px-5 py-2.5 rounded-xl font-bold text-sm inline-block"
        >
          Return to Store →
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {state === 'CREATING_HOLD' && (
        <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center shadow-xs">
          <div className="text-4xl animate-bounce mb-3">🔒</div>
          <h2 className="text-xl font-black text-stone-900 mb-2">Securing CartLock Hold</h2>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            Contacting store inventory authority to lock your items for 59 seconds…
          </p>
        </div>
      )}

      {state === 'STOCK_CONFLICT' && (
        <ConflictRecoveryPanel
          storeId={cart.storeId}
          unavailableProductIds={unavailableProducts}
          onReplacementApproved={handleReplacementApproved}
          onKeepCartWithoutUnavailable={handleRemoveUnavailableAndProceed}
        />
      )}

      {state === 'HOLD_EXPIRED' && (
        <div className="bg-white rounded-3xl border border-red-200 p-8 shadow-sm text-center">
          <div className="text-4xl mb-3">⏰</div>
          <h2 className="text-2xl font-black text-stone-900 mb-2">
            {errorMessage ? 'Checkout Reservation Issue' : 'Reservation Expired'}
          </h2>
          {errorMessage ? (
            <Alert type="error" className="mb-6 max-w-md mx-auto text-left">
              {errorMessage}
            </Alert>
          ) : (
            <p className="text-sm text-stone-600 mb-6 max-w-md mx-auto">
              Your 59-second stock hold has expired to ensure fairness for other shoppers. You can re-reserve with one click.
            </p>
          )}
          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={handleRetryReservation}
              disabled={isSubmitting}
              className="bg-[#173F35] hover:bg-[#275546] text-white font-bold py-3 px-6 rounded-xl transition-all shadow-xs disabled:opacity-50"
            >
              {isSubmitting
                ? 'Securing Hold…'
                : errorMessage
                ? 'Retry Reservation'
                : 'Re-reserve Stock & Checkout →'}
            </button>
            <Link
              href="/cart"
              className="bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold py-3 px-6 rounded-xl transition-all"
            >
              Review Cart
            </Link>
          </div>
        </div>
      )}

      {(state === 'HOLD_ACTIVE' || state === 'CONFIRMING_ORDER') && hold && (
        <div>
          <HoldStatusCard
            key={hold.id}
            hold={hold}
            onExpire={handleHoldExpired}
          />

          {errorMessage && (
            <Alert type="error" className="mb-6">
              {errorMessage}
            </Alert>
          )}

          <div className="bg-[#F5F1E8] border border-[#275546]/20 rounded-3xl p-6 sm:p-8 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-[#275546]/10 mb-4">
              <div>
                <h3 className="font-bold text-stone-900 text-lg">Payment Simulation</h3>
                <span className="text-xs text-stone-500">
                  Instant simulated gateway (no real charge)
                </span>
              </div>
              <span className="text-xs bg-[#173F35] text-white px-2.5 py-1 rounded-md font-mono uppercase">
                Mode: SIMULATED
              </span>
            </div>

            <p className="text-xs text-stone-600 mb-6 leading-relaxed">
              Clicking below atomically marks your CartLock reservation as CONSUMED, creates a confirmed order, and decrements book stock in PostgreSQL.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <div>
                <span className="text-xs text-stone-500 block">Total Due</span>
                <span className="text-2xl font-black text-[#173F35]">
                  {formatPaise(hold.totalPaise)}
                </span>
              </div>

              <button
                type="button"
                onClick={handleConfirmOrder}
                disabled={state === 'CONFIRMING_ORDER'}
                className="w-full sm:w-auto bg-lime-400 hover:bg-lime-300 text-[#173F35] font-black text-base px-8 py-3.5 rounded-xl shadow-sm transition-transform active:scale-95 disabled:opacity-50 focus:ring-2 focus:ring-[#173F35]"
              >
                {state === 'CONFIRMING_ORDER' ? 'Confirming Order…' : 'Confirm Order (Simulated) →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {state === 'ORDER_CONFIRMED' && order && (
        <SimulatedPaymentReceipt order={order} />
      )}
    </div>
  );
}
