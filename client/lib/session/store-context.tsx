'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Cart, Store, ProductOffer } from '@/contracts';
import { api } from '../api-client';

interface StoreContextValue {
  selectedStoreId: string;
  selectedStore: Store | null;
  availableStores: Store[];
  cart: Cart | null;
  cartItemCount: number;
  isLoading: boolean;
  error: string | null;
  isStoreModalOpen: boolean;
  openStoreModal: () => void;
  closeStoreModal: () => void;
  pendingStoreSwitch: Store | null;
  setPendingStoreSwitch: (store: Store | null) => void;
  confirmStoreSwitch: () => Promise<void>;
  cancelStoreSwitch: () => void;
  selectStore: (store: Store) => void;
  addToCart: (offer: ProductOffer, quantity?: number) => Promise<void>;
  updateCartQuantity: (productId: string, quantity: number) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  refreshCart: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [selectedStoreId, setSelectedStoreId] = useState<string>('blr-01');
  const [availableStores, setAvailableStores] = useState<Store[]>([]);
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingStoreSwitch, setPendingStoreSwitch] = useState<Store | null>(null);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState<boolean>(false);

  const openStoreModal = useCallback(() => setIsStoreModalOpen(true), []);
  const closeStoreModal = useCallback(() => setIsStoreModalOpen(false), []);

  // Load stores and initial cart
  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        setIsLoading(true);
        const cartRes = await api.getCart();
        const storesRes = await api.getStores();

        if (!mounted) return;
        setAvailableStores(storesRes.stores);
        setCart(cartRes);
        if (cartRes.storeId) {
          setSelectedStoreId(cartRes.storeId);
        }
      } catch (err) {
        if (!mounted) return;
        console.error('Failed to initialize store context:', err);
        setError('Failed to load store information.');
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    init();
    return () => {
      mounted = false;
    };
  }, []);

  const refreshCart = useCallback(async () => {
    try {
      const updated = await api.getCart();
      setCart(updated);
      if (updated.storeId) {
        setSelectedStoreId(updated.storeId);
      }
    } catch (err) {
      console.error('Failed to refresh cart:', err);
    }
  }, []);

  const selectStore = useCallback((store: Store) => {
    // If cart has items from another store, prompt confirmation first
    if (cart && cart.lines.length > 0 && cart.storeId !== store.id) {
      setPendingStoreSwitch(store);
      return;
    }

    setSelectedStoreId(store.id);
  }, [cart]);

  const confirmStoreSwitch = useCallback(async () => {
    if (!pendingStoreSwitch) return;
    try {
      setIsLoading(true);
      // Changing branch clears the cart and releases hold as required by Master Plan
      const newCart = await api.updateCart(pendingStoreSwitch.id, []);
      setCart(newCart);
      setSelectedStoreId(pendingStoreSwitch.id);
      setPendingStoreSwitch(null);
    } catch (err) {
      console.error('Failed to switch store:', err);
      setError('Could not switch store. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [pendingStoreSwitch]);

  const cancelStoreSwitch = useCallback(() => {
    setPendingStoreSwitch(null);
  }, []);

  const addToCart = useCallback(
    async (offer: ProductOffer, quantity: number = 1) => {
      if (!cart) return;

      // Ensure store matches
      const targetStoreId = offer.storeId;
      const currentLines = targetStoreId === cart.storeId ? [...cart.lines] : [];

      const existingIndex = currentLines.findIndex((l) => l.productId === offer.productId);
      if (existingIndex >= 0) {
        currentLines[existingIndex].quantity += quantity;
      } else {
        currentLines.push({
          productId: offer.productId,
          quantity,
          name: offer.name,
          unitPricePaise: offer.pricePaise,
        });
      }

      try {
        const updated = await api.updateCart(
          targetStoreId,
          currentLines.map((l) => ({ productId: l.productId, quantity: l.quantity }))
        );
        setCart(updated);
        setSelectedStoreId(targetStoreId);
      } catch (err) {
        console.error('Failed to add to cart:', err);
        throw err;
      }
    },
    [cart]
  );

  const updateCartQuantity = useCallback(
    async (productId: string, quantity: number) => {
      if (!cart) return;

      const updatedLines = cart.lines
        .map((l) => (l.productId === productId ? { ...l, quantity } : l))
        .filter((l) => l.quantity > 0);

      try {
        const updated = await api.updateCart(
          cart.storeId,
          updatedLines.map((l) => ({ productId: l.productId, quantity: l.quantity }))
        );
        setCart(updated);
      } catch (err) {
        console.error('Failed to update quantity:', err);
        throw err;
      }
    },
    [cart]
  );

  const removeFromCart = useCallback(
    async (productId: string) => {
      await updateCartQuantity(productId, 0);
    },
    [updateCartQuantity]
  );

  const selectedStore =
    availableStores.find((s) => s.id === selectedStoreId) ??
    availableStores[0] ??
    null;

  const cartItemCount =
    cart?.lines.reduce((total, line) => total + line.quantity, 0) ?? 0;

  return (
    <StoreContext.Provider
      value={{
        selectedStoreId,
        selectedStore,
        availableStores,
        cart,
        cartItemCount,
        isLoading,
        error,
        isStoreModalOpen,
        openStoreModal,
        closeStoreModal,
        pendingStoreSwitch,
        setPendingStoreSwitch,
        confirmStoreSwitch,
        cancelStoreSwitch,
        selectStore,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        refreshCart,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreContextValue {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}
