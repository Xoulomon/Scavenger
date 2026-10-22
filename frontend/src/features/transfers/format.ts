/** Formats a waste weight in grams as grams or kilograms (>= 1000 g). */
export function formatWasteWeight(weight: bigint): string {
  return Number(weight) >= 1000
    ? `${(Number(weight) / 1000).toFixed(2)} kg`
    : `${weight.toString()} g`
}
