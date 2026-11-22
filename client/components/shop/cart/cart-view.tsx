'use client';

import React from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/session/store-context';
import { formatPaise } from '@/lib/utils/currency';
import { CartLineItem } from './cart-line-item';
import { Alert } from '../feedback/alert';

export function CartView() {
  const { cart, selectedStore, updateCartQuantity, removeFromCart, isLoading } = useStore();

  if (isLoading && !cart) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center text-stone-500 animate-pulse">
        Loading cart details…
      </div>
    );
  }

  if (!cart || cart.lines.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4 text-center">
        <div className="w-20 h-20 bg-[#F5F1E8] rounded-3xl flex items-center justify-center text-4xl mx-auto mb-4 border border-stone-200">
          🛒
        </div>
        <h2 className="text-2xl font-black text-stone-900 mb-2">Your cart is empty</h2>
        <p className="text-sm text-stone-500 mb-6 max-w-sm mx-auto">
          Explore our fresh local inventory at{' '}
          <strong className="text-stone-700">{selectedStore?.name ?? 'your local branch'}</strong>.
        </p>
        <Link
          href="/"
          className="inline-block bg-[#173F35] hover:bg-[#275546] text-white font-bold px-6 py-3 rounded-xl transition-all shadow-xs"
        >
          Explore Catalog →
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-stone-200 mb-6 gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-stone-900">Shopping Cart</h1>
          <p className="text-xs text-stone-500 mt-1">
            Fulfilling from <span className="font-semibold text-emerald-900">{selectedStore?.name}</span> ({cart.storeId})
          </p>
        </div>
        <Link
          href="/"
          className="text-xs sm:text-sm font-semibold text-[#173F35] hover:underline"
        >
          ← Continue shopping
        </Link>
      </div>

      {/* CartLock stock guarantee rule */}
      <Alert type="info" className="mb-6">
        Checkout holds your items for 59 seconds.
      </Alert>

      {/* Line Items */}
      <div className="space-y-3 mb-8">
        {cart.lines.map((line) => (
          <CartLineItem
            key={line.productId}
            line={line}
            onUpdateQuantity={(qty) => updateCartQuantity(line.productId, qty)}
            onRemove={() => removeFromCart(line.productId)}
          />
        ))}
      </div>

      {/* Cart Summary & Checkout Action */}
      <div className="bg-[#F5F1E8] border border-[#275546]/20 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-[#275546]/10 text-sm">
          <span className="text-stone-600">Total lines</span>
          <span className="font-bold text-stone-800">{cart.lines.length} items</span>
        </div>
        <div className="flex items-center justify-between py-4 border-b border-[#275546]/10">
          <div>
            <span className="text-base sm:text-lg font-bold text-stone-900">Total Order Amount</span>
          </div>
          <span className="text-2xl sm:text-3xl font-black text-[#173F35]">
            {formatPaise(cart.totalPaise)}
          </span>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link
            href="/checkout"
            className="w-full sm:w-auto text-center bg-lime-400 hover:bg-lime-300 text-[#173F35] font-black text-base px-8 py-3.5 rounded-xl shadow-sm transition-transform active:scale-95 focus:ring-2 focus:ring-[#173F35]"
          >
            Proceed to Checkout →
          </Link>
        </div>

        <div className="mt-6 pt-4 border-t border-[#275546]/10 flex items-start sm:items-center gap-2 text-xs text-stone-500">
          <span className="text-sm">⏱️</span>
          <span>
            <strong className="text-stone-700">59-Second Hold Guarantee:</strong> Proceeding to checkout places an exclusive 59-second reservation hold on your items to guarantee stock availability while you complete simulated payment.
          </span>
        </div>
      </div>
    </div>
  );
}
