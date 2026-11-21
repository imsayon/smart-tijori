// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BarcodeSalePanel } from '@/components/ops/pos/barcode-sale-panel';

describe('BarcodeSalePanel Browser & Scanner Input Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders scanner input with auto-focus and clear simulated fixture labeling', () => {
    render(<BarcodeSalePanel storeId="blr-01" operatorId="staff01" />);

    const input = screen.getByPlaceholderText(/Scan item barcode or enter SKU/i);
    expect(input).toBeInTheDocument();
    expect(screen.getByText(/\[SIMULATED FIXTURE GATE\]/i)).toBeInTheDocument();
  });

  it('submitting barcode via Enter triggers sale authorization and renders confirmed receipt', async () => {
    const user = userEvent.setup();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        sale: {
          ok: true,
          saleId: 'sale-test-999',
          storeId: 'blr-01',
          productId: 'blr-basmati-1kg',
          productName: 'Royal Basmati Rice 1kg',
          quantity: 1,
          unitPricePaise: 18500,
          totalPaise: 18500,
          allocatedAt: new Date().toISOString(),
          inventoryVersion: 2,
          source: 'FIXTURE_SIMULATED',
        },
      }),
    });
    global.fetch = mockFetch;

    render(<BarcodeSalePanel storeId="blr-01" operatorId="staff01" />);

    const input = screen.getByPlaceholderText(/Scan item barcode or enter SKU/i);

    // Simulate barcode scanner typing barcode followed by Enter
    await user.type(input, '8901030383123{enter}');

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe('/api/pos/sale');
    expect(JSON.parse(callArgs[1].body)).toEqual({
      storeId: 'blr-01',
      barcode: '8901030383123',
      quantity: 1,
    });

    // Confirmed sale card appears
    await waitFor(() => {
      expect(screen.getByText('Royal Basmati Rice 1kg')).toBeInTheDocument();
      expect(screen.getByText(/✓ Confirmed/i)).toBeInTheDocument();
      expect(screen.getByText(/ID: sale-test-999/i)).toBeInTheDocument();
    });
  });

  it('displays clear cashier conflict warning when stock is locked in active 59s online checkout', async () => {
    const user = userEvent.setup();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        error: {
          code: 'STOCK_LOCKED_ONLINE',
          message: 'Stock is currently locked in an active 59-second online checkout reservation.',
          details: {
            productId: 'blr-basmati-1kg',
            availableStock: 0,
            activeHoldExpiresAt: '2026-11-21T18:00:59.000Z',
          },
        },
      }),
    });
    global.fetch = mockFetch;

    render(<BarcodeSalePanel storeId="blr-01" operatorId="staff01" />);

    const input = screen.getByPlaceholderText(/Scan item barcode or enter SKU/i);
    await user.type(input, '8901030383123{enter}');

    await waitFor(() => {
      expect(screen.getByText('STOCK_LOCKED_ONLINE')).toBeInTheDocument();
      expect(screen.getByText(/Stock is currently locked in an active 59-second online checkout reservation/i)).toBeInTheDocument();
    });
  });
});
