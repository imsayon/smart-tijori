import { describe, it, expect, beforeEach } from 'vitest';
import { OperationKeyManager } from '@/lib/checkout/operation-key';

describe('OperationKeyManager Unit Tests', () => {
  const intentA = 'cart-intent-100';

  beforeEach(() => {
    OperationKeyManager.clearKey(intentA);
  });

  it('generates a new key on first request', () => {
    const key = OperationKeyManager.getOrCreateKey(intentA);
    expect(key).toBeDefined();
    expect(key.length).toBeGreaterThan(10);
  });

  it('reuses the exact same operation key for retrying the same intent', () => {
    const key1 = OperationKeyManager.getOrCreateKey(intentA);
    const key2 = OperationKeyManager.getOrCreateKey(intentA);
    expect(key1).toBe(key2);
  });

  it('generates a brand new key when explicitly requested for a new action', () => {
    const key1 = OperationKeyManager.getOrCreateKey(intentA);
    const key2 = OperationKeyManager.generateNewKey(intentA);
    expect(key1).not.toBe(key2);
  });

  it('clears key after action completion', () => {
    const key1 = OperationKeyManager.getOrCreateKey(intentA);
    OperationKeyManager.clearKey(intentA);
    const key2 = OperationKeyManager.getOrCreateKey(intentA);
    expect(key1).not.toBe(key2);
  });
});
