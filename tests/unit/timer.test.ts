import { describe, it, expect } from 'vitest';
import { calculateHoldRemaining } from '@/lib/checkout/timer';

describe('Hold Timer Calculation Unit Tests', () => {
  it('correctly calculates 60-second countdown without skew', () => {
    const serverNow = '2026-11-20T10:00:00.000Z';
    const expiresAt = '2026-11-20T10:01:00.000Z'; // exactly 60 seconds later
    const now = new Date(serverNow).getTime();

    const result = calculateHoldRemaining(expiresAt, serverNow, now);
    expect(result.remainingSeconds).toBe(60);
    expect(result.formattedTime).toBe('01:00');
    expect(result.isExpired).toBe(false);
    expect(result.skewMs).toBe(0);
  });

  it('at 59 seconds it is still active with 1 second remaining', () => {
    const serverNow = '2026-11-20T10:00:00.000Z';
    const expiresAt = '2026-11-20T10:01:00.000Z'; // 60s total
    const at59Seconds = new Date(serverNow).getTime() + 59 * 1000;

    const result = calculateHoldRemaining(expiresAt, serverNow, at59Seconds);
    expect(result.remainingSeconds).toBe(1);
    expect(result.formattedTime).toBe('00:01');
    expect(result.isExpired).toBe(false);
  });

  it('at 60 seconds it is expired', () => {
    const serverNow = '2026-11-20T10:00:00.000Z';
    const expiresAt = '2026-11-20T10:01:00.000Z'; // 60s total
    const at60Seconds = new Date(serverNow).getTime() + 60 * 1000;

    const result = calculateHoldRemaining(expiresAt, serverNow, at60Seconds);
    expect(result.remainingSeconds).toBe(0);
    expect(result.formattedTime).toBe('00:00');
    expect(result.isExpired).toBe(true);
  });

  it('accurately compensates for browser clock skew with 60-second hold', () => {
    // Local client clock is running 10 seconds fast at receive time
    const serverNow = '2026-11-20T10:00:00.000Z';
    const expiresAt = '2026-11-20T10:01:00.000Z';
    const clientReceiveTime = new Date('2026-11-20T10:00:10.000Z').getTime();

    const result = calculateHoldRemaining(expiresAt, serverNow, clientReceiveTime, clientReceiveTime);
    expect(result.skewMs).toBe(10000);
    expect(result.remainingSeconds).toBe(60);
    expect(result.formattedTime).toBe('01:00');
    expect(result.isExpired).toBe(false);
  });
});
