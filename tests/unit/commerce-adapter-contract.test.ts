import { describe, it, expect, beforeEach } from 'vitest';
import type { CommerceCommands } from '@/server/http/adapters/commerce-commands';
import { FixtureCommerceAdapter } from '@/server/http/adapters/fixture-commerce-adapter';
import { RecordingAdapter } from '@/server/http/adapters/recording-adapter';
import { HttpError } from '@/server/http/errors/http-errors';

/**
 * Reusable contract test suite for CommerceCommands implementations.
 * Can be run against FixtureCommerceAdapter, RecordingAdapter, and future
 * Sayon's PostgresCommerceAdapter to guarantee 100% contract compliance.
 */
export function runCommerceAdapterContractTests(
  adapterName: string,
  createAdapter: () => Promise<CommerceCommands> | CommerceCommands
) {
  describe(`CommerceCommands Compliance Contract: ${adapterName}`, () => {
    let adapter: CommerceCommands;
    const sessionA = '22222222-2222-4222-8222-222222222222';
    const sessionB = '33333333-3333-4333-8333-333333333333';

    beforeEach(async () => {
      adapter = await createAdapter();
    });

    it('listStores: returns stores with required id, name, and city', async () => {
      const stores = await adapter.listStores();
      expect(Array.isArray(stores)).toBe(true);
      expect(stores.length).toBeGreaterThan(0);
      for (const s of stores) {
        expect(typeof s.id).toBe('string');
        expect(typeof s.name).toBe('string');
        expect(['Bengaluru', 'Mysuru']).toContain(s.city);
      }
    });

    it('getProductOffers: retrieves offers scoped to store and calculates integer paise', async () => {
      const offers = await adapter.getProductOffers('blr-01');
      expect(offers.length).toBeGreaterThan(0);
      for (const o of offers) {
        expect(o.storeId).toBe('blr-01');
        expect(Number.isInteger(o.pricePaise)).toBe(true);
        expect(o.pricePaise).toBeGreaterThan(0);
        expect(typeof o.available).toBe('number');
        expect(o.pack).toBeDefined();
      }
    });

    it('getCart: returns empty cart for new session and persists across calls', async () => {
      const cart = await adapter.getCart(sessionA);
      expect(cart.sessionId).toBe(sessionA);
      expect(cart.lines).toHaveLength(0);
      expect(cart.totalPaise).toBe(0);

      const cartAgain = await adapter.getCart(sessionA);
      expect(cartAgain.id).toBe(cart.id);
    });

    it('updateCart: server calculates totalPaise and line prices from store offers', async () => {
      const cart = await adapter.updateCart(sessionA, 'blr-01', [
        { productId: 'blr-basmati-1kg', quantity: 2 },
      ]);
      expect(cart.lines).toHaveLength(1);
      expect(cart.lines[0].productId).toBe('blr-basmati-1kg');
      expect(cart.lines[0].quantity).toBe(2);
      expect(cart.lines[0].unitPricePaise).toBe(18500);
      expect(cart.totalPaise).toBe(37000); // 18500 * 2
    });

    it('updateCart: releases active hold when cart is mutated', async () => {
      await adapter.updateCart(sessionA, 'blr-01', [
        { productId: 'blr-basmati-1kg', quantity: 1 },
      ]);
      const cart = await adapter.getCart(sessionA);
      const holdRes = await adapter.createHold(sessionA, cart.id, 'key-hold-release-test');
      expect(holdRes.ok).toBe(true);
      const holdId = (holdRes as { ok: true; hold: { id: string } }).hold.id;

      // Mutate cart
      await adapter.updateCart(sessionA, 'blr-01', [
        { productId: 'blr-basmati-1kg', quantity: 2 },
      ]);

      // Prior hold should now be RELEASED
      const hold = await adapter.getHold(sessionA, holdId);
      expect(hold?.status).toBe('RELEASED');
    });

    it('createHold: enforces 60-second expiry and single active hold per session', async () => {
      await adapter.updateCart(sessionA, 'blr-01', [
        { productId: 'blr-basmati-1kg', quantity: 1 },
      ]);
      const cart = await adapter.getCart(sessionA);

      const res1 = await adapter.createHold(sessionA, cart.id, 'key-h1');
      expect(res1.ok).toBe(true);
      const h1 = (res1 as { ok: true; hold: { id: string; expiresAt: string; serverNow: string } }).hold;

      const durationMs = new Date(h1.expiresAt).getTime() - new Date(h1.serverNow).getTime();
      expect(durationMs).toBe(60 * 1000); // 60 seconds hold

      // Creating a second hold releases the first
      const res2 = await adapter.createHold(sessionA, cart.id, 'key-h2');
      expect(res2.ok).toBe(true);
      const h2 = (res2 as { ok: true; hold: { id: string } }).hold;
      expect(h2.id).not.toBe(h1.id);

      const oldHold = await adapter.getHold(sessionA, h1.id);
      expect(oldHold?.status).toBe('RELEASED');
    });

    it('createHold: returns STOCK_UNAVAILABLE when requested quantity exceeds available stock', async () => {
      await adapter.updateCart(sessionA, 'blr-01', [
        { productId: 'blr-basmati-1kg', quantity: 9999 },
      ]);
      const cart = await adapter.getCart(sessionA);

      const res = await adapter.createHold(sessionA, cart.id, 'key-excess-stock');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe('STOCK_UNAVAILABLE');
        expect(res.unavailableProducts).toContain('blr-basmati-1kg');
      }
    });

    it('createHold: idempotent retry with same key returns identical hold snapshot', async () => {
      await adapter.updateCart(sessionA, 'blr-01', [
        { productId: 'blr-basmati-1kg', quantity: 1 },
      ]);
      const cart = await adapter.getCart(sessionA);

      const res1 = await adapter.createHold(sessionA, cart.id, 'key-idem-hold');
      const res2 = await adapter.createHold(sessionA, cart.id, 'key-idem-hold');

      expect(res1).toEqual(res2);
    });

    it('confirmOrder: atomically consumes hold, returns SIMULATED payment, and provisions fresh cart', async () => {
      await adapter.updateCart(sessionA, 'blr-01', [
        { productId: 'blr-basmati-1kg', quantity: 1 },
      ]);
      const cartBefore = await adapter.getCart(sessionA);
      const holdRes = await adapter.createHold(sessionA, cartBefore.id, 'key-hold-confirm');
      const hold = (holdRes as { ok: true; hold: { id: string } }).hold;

      const order = await adapter.confirmOrder(sessionA, hold.id, 'key-order-confirm');
      expect(order.status).toBe('CONFIRMED');
      expect(order.paymentMode).toBe('SIMULATED');
      expect(order.reservationId).toBe(hold.id);
      expect(order.totalPaise).toBe(18500);

      // Hold status is now CONSUMED
      const holdAfter = await adapter.getHold(sessionA, hold.id);
      expect(holdAfter?.status).toBe('CONSUMED');

      // Cart is provisioned with a brand new ID
      const cartAfter = await adapter.getCart(sessionA);
      expect(cartAfter.id).not.toBe(cartBefore.id);
      expect(cartAfter.lines).toHaveLength(0);
    });

    it('confirmOrder: idempotent retry with same key returns same confirmed order', async () => {
      await adapter.updateCart(sessionA, 'blr-01', [
        { productId: 'blr-basmati-1kg', quantity: 1 },
      ]);
      const cart = await adapter.getCart(sessionA);
      const holdRes = await adapter.createHold(sessionA, cart.id, 'key-hold-retry');
      const hold = (holdRes as { ok: true; hold: { id: string } }).hold;

      const order1 = await adapter.confirmOrder(sessionA, hold.id, 'key-order-retry');
      const order2 = await adapter.confirmOrder(sessionA, hold.id, 'key-order-retry');

      expect(order1).toEqual(order2);
    });

    it('cross-session boundaries: denies cross-session access to holds and orders', async () => {
      await adapter.updateCart(sessionA, 'blr-01', [
        { productId: 'blr-basmati-1kg', quantity: 1 },
      ]);
      const cartA = await adapter.getCart(sessionA);
      const holdResA = await adapter.createHold(sessionA, cartA.id, 'key-h-cross');
      const holdA = (holdResA as { ok: true; hold: { id: string } }).hold;

      // Session B cannot view hold A
      const crossHold = await adapter.getHold(sessionB, holdA.id);
      expect(crossHold).toBeNull();

      // Session B cannot confirm hold A
      await expect(
        adapter.confirmOrder(sessionB, holdA.id, 'key-ord-cross')
      ).rejects.toThrowError(HttpError);
    });

    it('saveInterest: records stock interest for customer', async () => {
      const interest = await adapter.saveInterest(
        sessionA,
        'blr-01',
        'blr-detergent-liquid-1l'
      );
      expect(interest.sessionId).toBe(sessionA);
      expect(interest.storeId).toBe('blr-01');
      expect(interest.productId).toBe('blr-detergent-liquid-1l');
      expect(typeof interest.id).toBe('string');
    });
  });
}

// 1. Run compliance contract against FixtureCommerceAdapter
runCommerceAdapterContractTests('FixtureCommerceAdapter', () => new FixtureCommerceAdapter());

// 2. Run compliance contract against RecordingAdapter wrapping FixtureCommerceAdapter
runCommerceAdapterContractTests(
  'RecordingAdapter(FixtureCommerceAdapter)',
  () => new RecordingAdapter(new FixtureCommerceAdapter())
);
