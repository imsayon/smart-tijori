// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { HoldTimer } from '@/components/shop/checkout/hold-timer';

describe('HoldTimer Component Clock-Skew & Baseline Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('displays full 59-second countdown when client clock is 30 seconds AHEAD of server clock', () => {
    // Server clock is at 10:00:00, expiry at 10:00:59 (59-second hold)
    const serverNow = '2026-11-20T10:00:00.000Z';
    const expiresAt = '2026-11-20T10:00:59.000Z';

    // Local client device clock is 30 seconds fast: 10:00:30
    const clientTime = new Date('2026-11-20T10:00:30.000Z');
    vi.setSystemTime(clientTime);

    render(<HoldTimer expiresAt={expiresAt} serverNow={serverNow} />);

    // Before fix, missing receivedAtClientNow caused this to display 00:29.
    // With fix, it accurately displays 00:59!
    expect(screen.getByText('Stock reserved: 00:59')).toBeInTheDocument();
    expect(screen.queryByText('Hold Expired')).not.toBeInTheDocument();
  });

  it('displays full 59-second countdown when client clock is 45 seconds BEHIND server clock', () => {
    // Server clock is at 10:00:00, expiry at 10:00:59 (59-second hold)
    const serverNow = '2026-11-20T10:00:00.000Z';
    const expiresAt = '2026-11-20T10:00:59.000Z';

    // Local client device clock is 45 seconds behind: 09:59:15
    const clientTime = new Date('2026-11-20T09:59:15.000Z');
    vi.setSystemTime(clientTime);

    render(<HoldTimer expiresAt={expiresAt} serverNow={serverNow} />);

    // Before fix, missing receivedAtClientNow caused this to display 01:44.
    // With fix, it accurately displays 00:59!
    expect(screen.getByText('Stock reserved: 00:59')).toBeInTheDocument();
  });

  it('ticks down accurately as client time elapses despite clock skew', () => {
    const serverNow = '2026-11-20T10:00:00.000Z';
    const expiresAt = '2026-11-20T10:00:59.000Z';

    // Client clock is 20s ahead
    vi.setSystemTime(new Date('2026-11-20T10:00:20.000Z'));

    render(<HoldTimer expiresAt={expiresAt} serverNow={serverNow} />);
    expect(screen.getByText('Stock reserved: 00:59')).toBeInTheDocument();

    // Advance by 10 seconds
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(screen.getByText('Stock reserved: 00:49')).toBeInTheDocument();

    // Advance by 49 more seconds (total 59s elapsed)
    act(() => {
      vi.advanceTimersByTime(49000);
    });

    expect(screen.getByText('Hold Expired')).toBeInTheDocument();
  });

  it('recaptures a fresh client baseline when hold identity/timestamps change', () => {
    const onExpire = vi.fn();

    // Hold 1 received at client time 10:00:00
    const serverNow1 = '2026-11-20T10:00:00.000Z';
    const expiresAt1 = '2026-11-20T10:00:59.000Z';
    vi.setSystemTime(new Date('2026-11-20T10:00:00.000Z'));

    const { rerender } = render(
      <HoldTimer expiresAt={expiresAt1} serverNow={serverNow1} onExpire={onExpire} />
    );
    expect(screen.getByText('Stock reserved: 00:59')).toBeInTheDocument();

    // 59 seconds pass -> Hold 1 expires
    act(() => {
      vi.advanceTimersByTime(59000);
    });
    expect(screen.getByText('Hold Expired')).toBeInTheDocument();
    expect(onExpire).toHaveBeenCalledTimes(1);

    // 10 seconds later, shopper re-reserves -> Hold 2 arrives at client time 10:01:09
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    const serverNow2 = '2026-11-20T10:01:09.000Z';
    const expiresAt2 = '2026-11-20T10:02:08.000Z'; // Fresh 59s hold

    rerender(
      <HoldTimer expiresAt={expiresAt2} serverNow={serverNow2} onExpire={onExpire} />
    );

    // Proves a fresh client baseline was captured: Hold 2 starts at 00:59, not expired
    expect(screen.getByText('Stock reserved: 00:59')).toBeInTheDocument();
    expect(screen.queryByText('Hold Expired')).not.toBeInTheDocument();

    // onExpire has still only been called once (for Hold 1, not duplicate for Hold 2)
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});
