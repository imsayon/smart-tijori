import { describe, it, expect } from 'vitest';
import { formatPaise, parseRupeesToPaise } from '@/lib/utils/currency';

describe('Currency Utilities Unit Tests', () => {
  it('formats whole rupee paise without decimals when requested', () => {
    expect(formatPaise(18500)).toContain('185');
    expect(formatPaise(4500)).toContain('45');
    expect(formatPaise(0)).toContain('0');
  });

  it('formats fractional paise with 2 decimals when needed', () => {
    const formatted = formatPaise(18550, true);
    expect(formatted).toContain('185.50');
  });

  it('converts rupee numbers and strings accurately to integer paise', () => {
    expect(parseRupeesToPaise(185)).toBe(18500);
    expect(parseRupeesToPaise('185.50')).toBe(18550);
    expect(parseRupeesToPaise('0')).toBe(0);
    expect(parseRupeesToPaise(-10)).toBe(0);
    expect(parseRupeesToPaise('invalid')).toBe(0);
  });
});
