import { describe, it, expect } from 'vitest';
import { calculateHoldRemaining } from '@/lib/checkout/timer';

describe('Hold Timer Calculation Unit Tests', () => {
  it('correctly calculates five-minute countdown without skew', () => {
    const serverNow = '2026-11-20T10:00:00.000Z';
    const expiresAt = '2026-11-20T10:05:00.000Z'; // exactly 5 minutes (300 seconds) later
    const now = new Date(serverNow).getTime();

    const result = calculateHoldRemaining(expiresAt, serverNow, now);
    expect(result.remainingSeconds).toBe(300);
    expect(result.formattedTime).toBe('05:00');
    expect(result.isExpired).toBe(false);
    expect(result.skewMs).toBe(0);
  });

  it('at 299 seconds it is still active with 1 second remaining', () => {
    const serverNow = '2026-11-20T10:00:00.000Z';
    const expiresAt = '2026-11-20T10:05:00.000Z'; // 300s total
    const at299Seconds = new Date(serverNow).getTime() + 299 * 1000;

    const result = calculateHoldRemaining(expiresAt, serverNow, at299Seconds);
    expect(result.remainingSeconds).toBe(1);
    expect(result.formattedTime).toBe('00:01');
    expect(result.isExpired).toBe(false);
  });

  it('stays active through the last partial second', () => {
    const now = '2026-11-20T10:00:00.000Z';
    const expiresAt = '2026-11-20T10:05:00.000Z';
    const timer = calculateHoldRemaining(expiresAt, now, Date.parse(expiresAt) - 1);
    expect(timer.isExpired).toBe(false);
    expect(timer.remainingSeconds).toBe(1);
  });

  it('at 300 seconds it is expired', () => {
    const serverNow = '2026-11-20T10:00:00.000Z';
    const expiresAt = '2026-11-20T10:05:00.000Z'; // 300s total
    const at300Seconds = new Date(serverNow).getTime() + 300 * 1000;

    const result = calculateHoldRemaining(expiresAt, serverNow, at300Seconds);
    expect(result.remainingSeconds).toBe(0);
    expect(result.formattedTime).toBe('00:00');
    expect(result.isExpired).toBe(true);
  });

  it('accurately compensates for browser clock skew with five-minute hold', () => {
    // Local client clock is running 10 seconds fast at receive time
    const serverNow = '2026-11-20T10:00:00.000Z';
    const expiresAt = '2026-11-20T10:05:00.000Z';
    const clientReceiveTime = new Date('2026-11-20T10:00:10.000Z').getTime();

    const result = calculateHoldRemaining(expiresAt, serverNow, clientReceiveTime, clientReceiveTime);
    expect(result.skewMs).toBe(10000);
    expect(result.remainingSeconds).toBe(300);
    expect(result.formattedTime).toBe('05:00');
    expect(result.isExpired).toBe(false);
  });
});
