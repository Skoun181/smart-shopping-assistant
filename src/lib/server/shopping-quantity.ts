export function mergedQuantity(current: number, added: number): number {
  const total = current + added;
  if (!Number.isFinite(total) || total <= current || total > 1000000)
    throw new Error('Quantity too large');
  return total;
}
