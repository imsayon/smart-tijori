import type {
  Store,
  ProductOffer,
  Cart,
  Hold,
  Order,
  RecoveryResult,
  RecoveryConstraints,
  ApiError,
  OpsFacts,
  PipelineFacts,
} from '@/contracts';

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: 'same-origin',
  });

  const isJson = res.headers?.get?.('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    const errorPayload = data?.error as ApiError & { details?: unknown };
    throw new ApiClientError(
      errorPayload?.code ?? 'UNKNOWN_ERROR',
      errorPayload?.message ?? `Request failed with status ${res.status}`,
      res.status,
      errorPayload?.details
    );
  }

  return data as T;
}

export const api = {
  async getStores(): Promise<{ stores: Store[] }> {
    return request<{ stores: Store[] }>('/api/stores');
  },

  async getProducts(params?: {
    q?: string;
    category?: string;
    minPricePaise?: number;
    maxPricePaise?: number;
    city?: string;
    storeId?: string;
  }): Promise<{ items: ProductOffer[] }> {
    const searchParams = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== '') {
          searchParams.set(k, String(v));
        }
      }
    }
    const query = searchParams.toString();
    return request<{ items: ProductOffer[] }>(`/api/products${query ? `?${query}` : ''}`);
  },

  async getCart(): Promise<Cart> {
    return request<Cart>('/api/cart');
  },

  async updateCart(
    storeId: string,
    lines: Array<{ productId: string; quantity: number }>
  ): Promise<Cart> {
    return request<Cart>('/api/cart', {
      method: 'PUT',
      body: JSON.stringify({ storeId, lines }),
    });
  },

  async createReservation(cartId: string, operationKey: string): Promise<Hold> {
    return request<Hold>('/api/reservations', {
      method: 'POST',
      headers: {
        'Idempotency-Key': operationKey,
      },
      body: JSON.stringify({ cartId }),
    });
  },

  async getReservation(id: string): Promise<Hold> {
    return request<Hold>(`/api/reservations/${encodeURIComponent(id)}`);
  },

  async releaseReservation(id: string): Promise<Hold> {
    return request<Hold>(`/api/reservations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async confirmOrder(reservationId: string, operationKey: string): Promise<Order> {
    return request<Order>('/api/orders', {
      method: 'POST',
      headers: {
        'Idempotency-Key': operationKey,
      },
      body: JSON.stringify({ reservationId }),
    });
  },

  async getOrder(id: string): Promise<Order> {
    return request<Order>(`/api/orders/${encodeURIComponent(id)}`);
  },

  async saveInterest(storeId: string, productId: string): Promise<{ saved: boolean }> {
    return request<{ saved: boolean }>('/api/interest', {
      method: 'POST',
      body: JSON.stringify({ storeId, productId }),
    });
  },

  async getRecovery(params: {
    storeId: string;
    unavailableProductId: string;
    text?: string;
    explicitConstraints?: Partial<RecoveryConstraints>;
  }): Promise<RecoveryResult> {
    return request<RecoveryResult>('/api/recovery', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async getOpsInventory(): Promise<OpsFacts> {
    return request<OpsFacts>('/api/ops/inventory');
  },

  async getOpsDiagnostics(): Promise<PipelineFacts> {
    return request<PipelineFacts>('/api/ops/diagnostics');
  },
};
