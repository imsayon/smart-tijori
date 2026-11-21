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
      <div className="max-w-4xl mx-auto py-16 text-center text-[#78716C] animate-pulse">
        Loading cart details…
      </div>
    );
  }

  if (!cart || cart.lines.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4 text-center">
        <div className="w-20 h-20 bg-[#F3EFEA] rounded-3xl flex items-center justify-center text-4xl mx-auto mb-4 border border-[#E3DDD2]">
          🛒
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-[#181614] mb-2 tracking-tight">Your cart is empty</h2>
        <p className="text-sm text-[#78716C] mb-6 max-w-sm mx-auto leading-relaxed">
          Explore our fresh local inventory at{' '}
          <strong className="text-[#181614] font-bold">{selectedStore?.name ?? 'your local branch'}</strong>.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-[#0E2A22] hover:bg-[#163D31] text-[#FAF8F5] font-black px-7 py-3.5 rounded-full transition-all duration-150 shadow-md hover:shadow-lg active:scale-95 border border-[#276350]/60"
        >
          <span>Explore Catalog</span>
          <span className="text-[#F59E0B]">→</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-5 border-b border-[#E3DDD2] mb-6 gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#181614] tracking-tight">Shopping Cart</h1>
          <p className="text-xs text-[#78716C] mt-1">
            Fulfilling from <span className="font-bold text-[#0E2A22]">{selectedStore?.name}</span> ({cart.storeId})
          </p>
        </div>
        <Link
          href="/"
          className="text-xs sm:text-sm font-bold text-[#0E2A22] hover:text-[#C89B3C] transition-colors flex items-center gap-1"
        >
          <span>←</span>
          <span>Continue shopping</span>
        </Link>
      </div>

      {/* CartLock stock guarantee rule */}
      <Alert type="info" className="mb-6">
        <span className="font-bold">CartLock Notice:</span> Items in your cart do not reserve stock. Stock is allocated and locked for 59 seconds once you enter checkout.
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
      <div className="bg-gradient-to-br from-[#F7F4EE] via-[#FBF9F5] to-[#F5F1E8] border border-[#E3DDD2] rounded-3xl p-6 sm:p-8 shadow-md">
        <div className="flex items-center justify-between pb-4 border-b border-[#E3DDD2] text-sm">
          <span className="text-[#78716C] font-medium">Total lines</span>
          <span className="font-black text-[#181614] font-mono">{cart.lines.length} items</span>
        </div>

        <div className="py-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-[#78716C] block font-medium">Cart Total</span>
            <span className="text-2xl sm:text-3xl font-black text-[#0E2A22] tracking-tight font-mono">
              {formatPaise(cart.lines.reduce((sum, l) => sum + l.unitPricePaise * l.quantity, 0))}
            </span>
          </div>

          <Link
            href="/checkout"
            className="bg-gradient-to-r from-[#F59E0B] to-[#D97706] hover:from-[#FBBF24] hover:to-[#D97706] text-[#0E2A22] font-black text-sm sm:text-base px-8 py-4 rounded-full shadow-md hover:shadow-lg transition-all duration-150 active:scale-95 inline-flex items-center gap-2 cursor-pointer focus:ring-2 focus:ring-[#0E2A22]"
          >
            <span>Proceed to CartLock Checkout</span>
            <span>→</span>
          </Link>
        </div>

        <p className="text-[11px] text-[#78716C] border-t border-[#E3DDD2] pt-3 mt-1 leading-relaxed">
          🔒 Entering checkout initiates an atomic 59-second CartLock reservation at your chosen branch counter.
        </p>
      </div>
    </div>
  );
}
