import { z } from 'zod';
import { MAX_QUANTITY } from '../../contracts/commerce';

export const updateCartSchema = z.object({
  storeId: z.string().min(1, 'storeId is required').max(64),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1, 'productId is required').max(128),
        quantity: z.number().int().min(0).max(100, 'Maximum quantity per line is 100'),
      })
    )
    .max(50, 'Maximum 50 lines allowed per cart'),
});

export const createHoldSchema = z.object({
  cartId: z.string().min(1, 'cartId is required').max(128),
});

export const confirmOrderSchema = z.object({
  reservationId: z.string().min(1, 'reservationId is required').max(128),
});

export const saveInterestSchema = z.object({
  storeId: z.string().min(1, 'storeId is required').max(64),
  productId: z.string().min(1, 'productId is required').max(128),
});

export const productFilterSchema = z.object({
  q: z.string().max(100).optional(),
  category: z.enum(['pantry', 'household', 'essentials']).optional(),
  minPricePaise: z.coerce.number().int().min(0).optional(),
  maxPricePaise: z.coerce.number().int().min(0).optional(),
  city: z.string().max(64).optional(),
  storeId: z.string().max(64).optional(),
});

export const recoveryRequestSchema = z.object({
  storeId: z.string().min(1, 'storeId is required').max(64),
  unavailableProductId: z.string().min(1, 'unavailableProductId is required').max(128),
  text: z.string().max(500).optional(),
  explicitConstraints: z
    .object({
      purpose: z.string().optional(),
      maxPricePaise: z.number().int().min(0).optional(),
      maxPriceMinor: z.number().int().min(0).optional(),
      minPack: z
        .object({
          quantity: z.number().min(0),
          unit: z.enum(['g', 'ml', 'count', 'kg', 'l']),
        })
        .optional(),
      minPackUnits: z
        .union([
          z.object({
            quantity: z.number().min(0),
            unit: z.enum(['g', 'ml', 'count', 'kg', 'l']),
          }),
          z.number().min(0),
        ])
        .optional(),
      requiredAttributes: z.record(z.string(), z.string()).optional(),
      preferences: z.array(z.string()).optional(),
    })
    .optional(),
});

export const posSaleRequestSchema = z.object({
  storeId: z.string().min(1).max(64),
  barcode: z.string().trim().min(1).max(64),
  quantity: z.number().int().min(1).max(MAX_QUANTITY),
});
