/**
 * Formats integer paise into Indian Rupee string: e.g. 18500 paise -> "₹185" or "₹185.00"
 */
export function formatPaise(paise: number, showDecimals: boolean = false): string {
  const rupees = paise / 100;
  if (!showDecimals && paise % 100 === 0) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(rupees);
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

/**
 * Parses rupee float string into integer paise
 */
export function parseRupeesToPaise(rupees: number | string): number {
  const val = typeof rupees === 'string' ? parseFloat(rupees) : rupees;
  if (isNaN(val) || val < 0) return 0;
  return Math.round(val * 100);
}
