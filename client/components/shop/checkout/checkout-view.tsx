'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import type { Cart, Hold, Order } from '@/contracts';
import { api, ApiClientError } from '@/lib/api-client';
import { useStore } from '@/lib/session/store-context';
import { OperationKeyManager } from '@/lib/checkout/operation-key';
import { formatPaise } from '@/lib/utils/currency';
import { HoldStatusCard } from '../reservation/hold-status-card';
import { OnlinePayment } from './online-payment';
import { SimulatedPaymentReceipt } from './simulated-payment-receipt';
import { ConflictRecoveryPanel } from '../recovery/conflict-recovery-panel';
import { Alert } from '../feedback/alert';
import { CartLockDial } from './cartlock-dial';
import { Icon } from '@/components/ui/atelier';

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

export function CheckoutView({ online, initialHold }: { online?: { testMode: boolean }; initialHold?: Hold } = {}) {
  const [checkoutStarted, setCheckoutStarted] = useState(!online || Boolean(initialHold));
  const { cart, refreshCart, isLoading = false } = useStore();
  const [state, setState] = useState<CheckoutState>(initialHold ? 'HOLD_ACTIVE' : 'CREATING_HOLD');
  const [hold, setHold] = useState<Hold | null>(initialHold ?? null);
  const [order, setOrder] = useState<Order | null>(null);
  const [unavailableProducts, setUnavailableProducts] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const isReservingRef = useRef<boolean>(false);
  const holdKeyRef = useRef<string>('');
  const orderKeyRef = useRef<string>('');
  const hasRequestedInitialRef = useRef(Boolean(initialHold));

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
        setState((prev) => (prev === 'HOLD_EXPIRED' ? prev : 'CREATING_HOLD'));
        setErrorMessage(null);

        const activeHold = await api.createReservation(reservationCart.id, holdKey);
        setHold(activeHold);
        setState(activeHold.status === 'ACTIVE' ? 'HOLD_ACTIVE' : 'HOLD_EXPIRED');
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
    if (active && checkoutStarted && !hasRequestedInitialRef.current && cart && cart.lines.length > 0) {
      hasRequestedInitialRef.current = true;
      void requestReservation();
    }
    return () => {
      active = false;
    };
  }, [cart, requestReservation, checkoutStarted]);

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

    if (isLoading) {
      return (
        <div className="max-w-xl mx-auto py-16 text-center">
          <div className="text-4xl animate-pulse mb-3">🛒</div>
          <h2 className="text-xl font-bold text-stone-800 mb-2">Loading your cart…</h2>
          <p className="text-xs text-stone-500">Retrieving items from your local branch.</p>
        </div>
      );
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

  if (!checkoutStarted) {
    return <main className="st-journey st-checkout-page">
      <div className="st-breadcrumb"><Link href="/cart">YOUR BAG</Link><span>/</span><span>CHECKOUT</span></div>
      <header className="st-page-intro">
        <div><p className="st-kicker">YOUR FINISHING TOUCH / CHECKOUT</p>
          <h1 className="st-display">Ready when<br/><em>you are.</em></h1>
          <p className="st-intro-copy">Your {cart.lines.length} carefully chosen {cart.lines.length === 1 ? 'pick' : 'picks'} are waiting. We’ll reserve live stock only when you choose to begin.</p>
        </div>
      </header>
      <div className="st-checkout-ready">
        <div className="st-checkout-ready-copy">
          <p className="st-kicker">01 / RESERVE YOUR SELECTION</p>
          <h2>Your 59-second<br/><em>CartLock window.</em></h2>
          <p>Nothing is reserved yet. Starting checkout checks the latest stock and, if available, creates one non-renewing hold.</p>
          <div className="st-checkout-ready-total"><span>Your total</span><strong>{formatPaise(cart.totalPaise)}</strong></div>
          <button type="button" className="st-primary-cta" onClick={() => setCheckoutStarted(true)}>Reserve items <Icon name="arrow" size={18}/></button>
          <Link href="/cart" className="st-text-link">Review my bag <Icon name="upRight" size={15}/></Link>
        </div>
        <CartLockDial mode="preview"/>
      </div>
    </main>;
  }

  return (
    <main className="st-journey st-checkout-page">
      <div className="st-breadcrumb"><Link href="/cart">YOUR BAG</Link><span>/</span><span>CHECKOUT</span></div>
      <header className="st-page-intro st-checkout-intro">
        <div><p className="st-kicker"><span className="st-live-dot" /> A BETTER WAY TO CHECK OUT</p>
          <h1 className="st-display">The final<br/><em>little details.</em></h1>
          <p className="st-intro-copy">Your order is held only when stock is confirmed. Follow your reservation and payment status right here.</p>
        </div>
        <Link href="/cart" className="st-text-link st-intro-link">Back to bag <Icon name="upRight" size={17}/></Link>
      </header>
      <ol className="st-checkout-steps" aria-label="Checkout progress">
        <li data-current={false}><span>01</span><strong>Your selection</strong><small>Bag prepared</small></li>
        <li data-current={state !== 'ORDER_CONFIRMED'}><span>02</span><strong>Stock reservation</strong><small>59 seconds when active</small></li>
        <li data-current={state === 'ORDER_CONFIRMED'}><span>03</span><strong>Order confirmation</strong><small>Payment verified first</small></li>
      </ol>
      <div className="st-checkout-layout">
        <div className="st-checkout-main">
      {state === 'CREATING_HOLD' && (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="st-checkout-state st-checkout-pending"
        >
          <div className="st-pending-glyph mb-3"><Icon name="lock" size={26}/></div>
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

        <div
          role="alert"
          aria-live="assertive"
          className="st-checkout-state st-checkout-expired"
        >
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
          {online && hold && <Link className="mb-4 block underline" href={`/checkout/status/${hold.id}`}>
            Check the payment for this reservation
          </Link>}
          <div className="flex flex-wrap justify-center gap-4">
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

          {online ? <OnlinePayment key={hold.id} reservationId={hold.id} amount={hold.totalPaise}
            expiresAt={hold.expiresAt} serverNow={hold.serverNow} testMode={online.testMode} /> :
          <div className="st-payment-card">
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
          </div>}
        </div>
      )}

      {state === 'ORDER_CONFIRMED' && order && (
        <SimulatedPaymentReceipt order={order} />
      )}
        </div>
        <aside className="st-checkout-sidebar" aria-label="Checkout details">
          <div className="st-checkout-aside-card">
            <p className="st-kicker">YOUR ORDER AT A GLANCE</p>
            <h2>Collected close<br/><em>to home.</em></h2>
            <div className="st-aside-products">
              {cart.lines.map(line => <div key={line.productId}>
                <span>{line.name} <small>× {line.quantity}</small></span>
                <strong>{formatPaise(line.unitPricePaise * line.quantity)}</strong>
              </div>)}
            </div>
            <div className="st-aside-total"><span>Order total</span><strong>{formatPaise(cart.totalPaise)}</strong></div>
            <div className="st-aside-detail"><Icon name="pin" size={16} /><span>Allocated only at <strong>{cart.storeId}</strong></span></div>
          </div>
          <div className="st-checkout-aside-tip">
            <Icon name="lock" size={20} />
            <p>Every order is checked against your branch’s real stock. The countdown never renews silently.</p>
          </div>
        </aside>
      </div>
      <div className="st-journey-footnote"><span>CARTLOCK / EXCLUSIVE STOCK WINDOW</span><span>PROTECTION STARTS AT RESERVATION</span></div>
    </main>
  );
}
