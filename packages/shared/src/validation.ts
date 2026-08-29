export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function isValidStellarAddress(address: string): boolean {
  return /^GA[0-9a-zA-Z]{55,56}$/.test(address);
}

export function isValidWasteType(type: string): boolean {
  const validTypes = ['Paper', 'Plastic', 'Metal', 'Glass', 'Organic', 'Electronic', 'PetPlastic'];
  return validTypes.includes(type);
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function parsePositiveInt(value: string, defaultValue: number): number {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) || parsed < 0 ? defaultValue : parsed;
}