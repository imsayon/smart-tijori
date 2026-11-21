// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BarcodeSalePanel } from '@/components/ops/pos/barcode-sale-panel';

describe('BarcodeSalePanel Browser & Scanner Input Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it('renders scanner input with auto-focus and clear simulated fixture labeling', () => {
    render(<BarcodeSalePanel storeId="blr-01" operatorId="cashier" fixture />);

    const input = screen.getByPlaceholderText(/Scan item barcode or enter SKU/i);
    expect(input).toBeInTheDocument();
    expect(screen.getByText(/\[SIMULATED FIXTURE GATE\]/i)).toBeInTheDocument();
    expect(screen.getByText(/Server-Verified/i)).toBeInTheDocument();
  });

  it('submitting barcode via Enter triggers sale authorization and renders confirmed receipt', async () => {
    const user = userEvent.setup();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        sale: {
          saleId: 'sale-test-999',
          storeId: 'blr-01',
          status: 'CONFIRMED',
          source: 'postgresql',
          soldAt: new Date().toISOString(),
          totalPaise: 15000,
          lines: [
            {
              name: 'Nilgiri Black Tea',
              productId: 'tea-250',
              quantity: 1,
              unitPricePaise: 15000,
              inventoryVersion: 2,
            },
          ],
        },
      }),
    });
    global.fetch = mockFetch;

    render(<BarcodeSalePanel storeId="blr-01" operatorId="cashier" fixture />);

    const input = screen.getByPlaceholderText(/Scan item barcode or enter SKU/i);

    // Simulate barcode scanner entering barcode followed by Enter
    await user.type(input, 'ST:tea-250{enter}');

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe('/api/pos/sale');
    expect(callArgs[1].headers['Authorization']).toBe('Bearer ops_cashier_blr-01');
    expect(JSON.parse(callArgs[1].body)).toEqual({
      storeId: 'blr-01',
      barcode: 'ST:tea-250',
      quantity: 1,
    });

    // Confirmed sale card appears with receipt details
    await waitFor(() => {
      expect(screen.getByText('Nilgiri Black Tea')).toBeInTheDocument();
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
          message: 'Stock is currently held by an active online checkout reservation.',
          productIds: ['tea-250'],
        },
      }),
    });
    global.fetch = mockFetch;

    render(<BarcodeSalePanel storeId="blr-01" operatorId="cashier" fixture />);

    const input = screen.getByPlaceholderText(/Scan item barcode or enter SKU/i);
    await user.type(input, 'ST:tea-250{enter}');

    await waitFor(() => {
      expect(screen.getByText('STOCK_LOCKED_ONLINE')).toBeInTheDocument();
      expect(
        screen.getByText(/This unit is actively held by an online checkout reservation/i)
      ).toBeInTheDocument();
    });
  });

  it('displays unknown barcode warning on 404 NOT_FOUND response', async () => {
    const user = userEvent.setup();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        error: {
          code: 'NOT_FOUND',
          message: 'Barcode is not registered for this store.',
        },
      }),
    });
    global.fetch = mockFetch;

    render(<BarcodeSalePanel storeId="blr-01" operatorId="cashier" fixture />);

    const input = screen.getByPlaceholderText(/Scan item barcode or enter SKU/i);
    await user.type(input, 'ST:unknown-999{enter}');

    await waitFor(() => {
      expect(screen.getByText('NOT_FOUND')).toBeInTheDocument();
      expect(screen.getByText(/Barcode is not registered for this store/i)).toBeInTheDocument();
    });
  });

  it('reuses the live operation key when a sale response is lost', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockRejectedValueOnce(new Error('lost response')).mockResolvedValueOnce({
      ok: false, status: 409,
      json: async () => ({ error: { code: 'STOCK_LOCKED_ONLINE', message: 'Reserved' } }),
    });
    global.fetch = mockFetch;
    render(<BarcodeSalePanel storeId="blr-01" operatorId="cashier" />);
    const input = screen.getByPlaceholderText(/Scan item barcode or enter SKU/i);
    await user.type(input, 'ST:tea-250{enter}');
    await screen.findByText(/Sale outcome is unknown/i);
    await user.type(input, '{enter}');
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    const first = mockFetch.mock.calls[0][1].headers;
    const second = mockFetch.mock.calls[1][1].headers;
    expect(second.Authorization).toBeUndefined();
    expect(second['Idempotency-Key']).toBe(first['Idempotency-Key']);
  });

  it('sends the exact scanned EAN to the server instead of substituting a preview alias', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false, status: 404,
      json: async () => ({ error: { code: 'NOT_FOUND', message: 'Barcode is not registered for this store.' } }),
    });
    global.fetch = mockFetch;
    render(<BarcodeSalePanel storeId="blr-01" operatorId="cashier" fixture />);

    await user.type(screen.getByPlaceholderText(/Scan item barcode or enter SKU/i), '8901030383192{enter}');
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).barcode).toBe('8901030383192');
    await screen.findByText('NOT_FOUND');
  });

  it('restores the unresolved key after a cashier terminal remount', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new Error('connection lost after commit'))
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({
          sale: {
            saleId: 'sale-replayed-1', storeId: 'blr-01', status: 'CONFIRMED',
            soldAt: '2026-11-21T12:00:00.000Z', totalPaise: 15000,
            lines: [{ productId: 'tea-250', name: 'Nilgiri Black Tea', quantity: 1, unitPricePaise: 15000 }],
          },
        }),
      });
    global.fetch = mockFetch;
    const terminal = render(<BarcodeSalePanel storeId="blr-01" operatorId="cashier" fixture />);
    await user.type(screen.getByPlaceholderText(/Scan item barcode or enter SKU/i), 'ST:tea-250{enter}');
    await screen.findByText(/Sale outcome is unknown/i);
    const previousKey = mockFetch.mock.calls[0][1].headers['Idempotency-Key'];

    terminal.unmount();
    render(<BarcodeSalePanel storeId="blr-01" operatorId="cashier" fixture />);
    const restoredInput = screen.getByPlaceholderText(/Scan item barcode or enter SKU/i);
    await waitFor(() => expect(restoredInput).toHaveValue('ST:tea-250'));
    await user.type(restoredInput, '{enter}');
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(mockFetch.mock.calls[1][1].headers['Idempotency-Key']).toBe(previousKey);
    await screen.findByText(/ID: sale-replayed-1/i);
    expect(window.sessionStorage.length).toBe(0);
  });
});
