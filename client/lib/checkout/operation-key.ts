import { v4 as uuidv4 } from 'uuid';

/**
 * Key manager for checkout and orders.
 * Rules:
 * - Reuse the same operation key when retrying the same action (e.g. network timeout or retry click).
 * - Generate a new key for a genuinely new action (e.g. changing cart items or starting a fresh checkout).
 */
export class OperationKeyManager {
  private static keys = new Map<string, string>();

  /**
   * Gets existing operation key for an intent or generates a new one.
   */
  static getOrCreateKey(intentId: string): string {
    const existing = this.keys.get(intentId);
    if (existing) {
      return existing;
    }

    const newKey = uuidv4();
    this.keys.set(intentId, newKey);
    return newKey;
  }

  /**
   * Forces generation of a brand new key for a new intent.
   */
  static generateNewKey(intentId?: string): string {
    const newKey = uuidv4();
    if (intentId) {
      this.keys.set(intentId, newKey);
    }
    return newKey;
  }

  /**
   * Clears all operation keys (e.g. after order confirmation to prevent stale session keys)
   */
  static clearAll(): void {
    this.keys.clear();
  }

  /**
   * Clears the key after terminal action (order confirmed or abandoned).
   */
  static clearKey(intentId: string): void {
    this.keys.delete(intentId);
  }
}
