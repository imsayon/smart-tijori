import { describe, it, expect } from 'vitest';
import { calculateHoldRemaining } from '@/lib/checkout/timer';

describe('Hold Timer Calculation Unit Tests', () => {
  it('correctly calculates 59-second countdown without skew', () => {
    const serverNow = '2026-11-20T10:00:00.000Z';
    const expiresAt = '2026-11-20T10:00:59.000Z'; // exactly 59 seconds later
    const now = new Date(serverNow).getTime();

    const result = calculateHoldRemaining(expiresAt, serverNow, now);
    expect(result.remainingSeconds).toBe(59);
    expect(result.formattedTime).toBe('00:59');
    expect(result.isExpired).toBe(false);
    expect(result.skewMs).toBe(0);
  });

  it('at 58 seconds it is still active with 1 second remaining', () => {
    const serverNow = '2026-11-20T10:00:00.000Z';
    const expiresAt = '2026-11-20T10:00:59.000Z'; // 59s total
    const at58Seconds = new Date(serverNow).getTime() + 58 * 1000;

    const result = calculateHoldRemaining(expiresAt, serverNow, at58Seconds);
    expect(result.remainingSeconds).toBe(1);
    expect(result.formattedTime).toBe('00:01');
    expect(result.isExpired).toBe(false);
  });

  it('at 59 seconds it is expired', () => {
    const serverNow = '2026-11-20T10:00:00.000Z';
    const expiresAt = '2026-11-20T10:00:59.000Z'; // 59s total
    const at59Seconds = new Date(serverNow).getTime() + 59 * 1000;

    const result = calculateHoldRemaining(expiresAt, serverNow, at59Seconds);
    expect(result.remainingSeconds).toBe(0);
    expect(result.formattedTime).toBe('00:00');
    expect(result.isExpired).toBe(true);
  });

  it('accurately compensates for browser clock skew with 59-second hold', () => {
    // Local client clock is running 10 seconds fast at receive time
    const serverNow = '2026-11-20T10:00:00.000Z';
    const expiresAt = '2026-11-20T10:00:59.000Z';
    const clientReceiveTime = new Date('2026-11-20T10:00:10.000Z').getTime();

    const result = calculateHoldRemaining(expiresAt, serverNow, clientReceiveTime, clientReceiveTime);
    expect(result.skewMs).toBe(10000);
    expect(result.remainingSeconds).toBe(59);
    expect(result.formattedTime).toBe('00:59');
    expect(result.isExpired).toBe(false);
  });
});
