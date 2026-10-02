/**
 * OpenVan rates are quoted as units of currency per 1 EUR.
 * `amount` in `from` becomes the same value denominated in `to`.
 */
export function convert(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>,
): number | null {
  if (!Number.isFinite(amount)) return null;
  if (from === to) return amount;
  const fromPerEur = rates[from];
  const toPerEur = rates[to];
  if (!fromPerEur || !toPerEur || fromPerEur <= 0 || toPerEur <= 0) return null;
  return (amount / fromPerEur) * toPerEur;
}
