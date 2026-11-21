'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import type { Hold, Order } from '@/contracts';
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

export function CheckoutView() {
  const { cart, refreshCart, removeFromCart } = useStore();
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
  const checkoutCartIdRef = useRef<string | null>(null);

  // Compute a stable cart fingerprint that changes when the cart content changes
  const cartFingerprint = cart
    ? `${cart.id}::${cart.lines.map((l) => `${l.productId}:${l.quantity}`).join(',')}`
    : '';

  // Reset checkout state when cart has meaningfully changed after an order
  useEffect(() => {
    if (!cart || cart.lines.length === 0) return;

    const isNewCheckoutNeeded =
      checkoutCartIdRef.current !== null &&
      cartFingerprint !== checkoutCartIdRef.current;

    if (isNewCheckoutNeeded && (state === 'ORDER_CONFIRMED' || hold)) {
      setHold(null);
      setOrder(null);
      setState('CREATING_HOLD');
      setErrorMessage(null);
      holdKeyRef.current = '';
      orderKeyRef.current = '';
      hasRequestedInitialRef.current = false;
      checkoutCartIdRef.current = cartFingerprint;
    } else if (checkoutCartIdRef.current === null) {
      checkoutCartIdRef.current = cartFingerprint;
    }
  }, [cartFingerprint, state, hold, cart]);

  const requestReservation = useCallback(
    async (options?: { forceNewKey?: boolean }) => {
      if (!cart || cart.lines.length === 0) return;
      if (isReservingRef.current) return;

      isReservingRef.current = true;
      setIsSubmitting(true);

      const cartRevision = `${cart.id}_${cart.totalPaise}_${cart.lines.map((l) => `${l.productId}:${l.quantity}`).join(',')}`;
      const intentId = `hold_${cartRevision}`;

      let holdKey: string;
      if (options?.forceNewKey) {
        holdKey = OperationKeyManager.generateNewKey(intentId);
      } else if (holdKeyRef.current) {
        holdKey = holdKeyRef.current;
      } else {
        holdKey = OperationKeyManager.getOrCreateKey(intentId);
      }

      holdKeyRef.current = holdKey;

      try {
        setState('CREATING_HOLD');
        setErrorMessage(null);

        const activeHold = await api.createReservation(cart.id, holdKey);
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
    if (cart && cart.lines.length > 0 && !hasRequestedInitialRef.current && state === 'CREATING_HOLD') {
      hasRequestedInitialRef.current = true;
      void requestReservation({ forceNewKey: false });
    }
  }, [cart, state, requestReservation]);

  const handleConfirmOrder = async () => {
    if (!hold || !cart) return;

    try {
      setIsSubmitting(true);
      setState('CONFIRMING_ORDER');
      setErrorMessage(null);

      const orderIntentId = `order_${hold.id}`;
      let orderKey = orderKeyRef.current;
      if (!orderKey) {
        orderKey = OperationKeyManager.getOrCreateKey(orderIntentId);
        orderKeyRef.current = orderKey;
      }

      const confirmedOrder = await api.confirmOrder(hold.id, orderKey);
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

  const handleRemoveUnavailableAndProceed = async () => {
    if (isReservingRef.current) return;
    for (const pId of unavailableProducts) {
      await removeFromCart(pId);
    }
    setUnavailableProducts([]);
    setHold(null);
    void requestReservation({ forceNewKey: true });
  };

  const handleReplacementApproved = async () => {
    if (isReservingRef.current) return;
    await refreshCart();
    setHold(null);
    void requestReservation({ forceNewKey: true });
  };

  if (!cart || cart.lines.length === 0) {
    if (state === 'ORDER_CONFIRMED' && order) {
      return <SimulatedPaymentReceipt order={order} />;
    }

    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-[#F3EFEA] text-[#0E2A22] text-3xl flex items-center justify-center mx-auto mb-4 border border-[#E3DDD2]">
          🧺
        </div>
        <h2 className="text-2xl font-black text-[#181614] mb-2 tracking-tight">No active cart for checkout</h2>
        <p className="text-xs text-[#78716C] mb-6">Please add items from your local neighborhood branch to proceed.</p>
        <Link
          href="/"
          className="bg-[#0E2A22] hover:bg-[#163D31] text-[#FAF8F5] px-6 py-3 rounded-full font-black text-sm inline-flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
        >
          <span>Return to Store</span>
          <span className="text-[#F59E0B]">→</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {state === 'CREATING_HOLD' && (
        <div className="bg-white rounded-3xl border border-[#E3DDD2] p-12 text-center shadow-md">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0E2A22] to-[#163D31] text-[#F59E0B] text-3xl flex items-center justify-center mx-auto mb-4 border border-[#1D4A3C] shadow-sm animate-pulse-slow">
            🔒
          </div>
          <h2 className="text-2xl font-black text-[#181614] mb-2 tracking-tight">Securing CartLock Hold</h2>
          <p className="text-xs text-[#78716C] max-w-sm mx-auto leading-relaxed">
            Contacting store inventory authority to lock your items for 59 seconds with single-stock truth…
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
        <div className="bg-white rounded-3xl border border-rose-200 p-8 sm:p-10 shadow-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-700 text-3xl flex items-center justify-center mx-auto mb-4 border border-rose-200">
            ⏰
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#181614] mb-2 tracking-tight">
            {errorMessage ? 'Checkout Reservation Issue' : 'Reservation Expired'}
          </h2>
          {errorMessage ? (
            <Alert type="error" className="mb-6 max-w-md mx-auto text-left">
              {errorMessage}
            </Alert>
          ) : (
            <p className="text-sm text-[#57534E] mb-6 max-w-md mx-auto leading-relaxed">
              Your 59-second stock hold has expired to ensure fairness for other shoppers. You can re-reserve with one click.
            </p>
          )}
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <button
              type="button"
              onClick={handleRetryReservation}
              disabled={isSubmitting}
              className="bg-[#0E2A22] hover:bg-[#163D31] text-[#FAF8F5] font-black py-3.5 px-7 rounded-full transition-all duration-150 shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer border border-[#276350]/60"
            >
              {isSubmitting
                ? 'Securing Hold…'
                : errorMessage
                ? 'Retry Reservation'
                : 'Re-reserve Stock & Checkout →'}
            </button>
            <Link
              href="/cart"
              className="bg-[#F3EFEA] hover:bg-[#E5DFD5] text-[#181614] font-bold py-3.5 px-6 rounded-full transition-colors border border-[#E3DDD2]"
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

          <div className="bg-gradient-to-br from-[#F7F4EE] via-[#FBF9F5] to-[#F5F1E8] border border-[#E3DDD2] rounded-3xl p-6 sm:p-8 shadow-md">
            <div className="flex items-center justify-between pb-4 border-b border-[#E3DDD2] mb-4">
              <div>
                <h3 className="font-black text-[#181614] text-lg sm:text-xl tracking-tight">Payment Simulation</h3>
                <span className="text-xs text-[#78716C]">
                  Instant simulated gateway (no real charge)
                </span>
              </div>
              <span className="text-xs bg-[#0E2A22] text-[#F59E0B] px-3 py-1 rounded-full font-mono font-bold uppercase border border-[#1D4A3C]">
                Mode: SIMULATED
              </span>
            </div>

            <p className="text-xs text-[#57534E] mb-6 leading-relaxed">
              Clicking below atomically marks your CartLock reservation as CONSUMED, creates a confirmed order, and decrements book stock in PostgreSQL.
            </p>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
              <div>
                <span className="text-xs text-[#78716C] block font-medium">Total Due</span>
                <span className="text-2xl sm:text-3xl font-black text-[#0E2A22] tracking-tight font-mono">
                  {formatPaise(hold.totalPaise)}
                </span>
              </div>

              <button
                type="button"
                onClick={handleConfirmOrder}
                disabled={state === 'CONFIRMING_ORDER'}
                className="w-full sm:w-auto bg-gradient-to-r from-[#F59E0B] to-[#D97706] hover:from-[#FBBF24] hover:to-[#D97706] text-[#0E2A22] font-black text-sm sm:text-base px-8 py-3.5 rounded-full shadow-md hover:shadow-lg transition-all duration-150 active:scale-95 disabled:opacity-50 focus:ring-2 focus:ring-[#0E2A22] cursor-pointer"
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
