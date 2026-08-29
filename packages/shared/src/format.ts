export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  });
}

export function formatDateTime(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatTokenAmount(amount: number | bigint, decimals: number = 0): string {
  const formatted = Number(amount) / Math.pow(10, decimals);
  if (formatted >= 1_000_000) {
    return `${(formatted / 1_000_000).toFixed(2)}M`;
  }
  if (formatted >= 1_000) {
    return `${(formatted / 1_000).toFixed(2)}K`;
  }
  return formatted.toFixed(decimals > 0 ? decimals : 2);
}

export function formatAddress(addr: string): string {
  if (addr.length <= 8) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}