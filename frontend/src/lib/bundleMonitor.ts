interface BundleMetrics {
  timestamp: string
  totalSize: number
  chunks: Record<string, number>
  largestChunks: Array<{ name: string; size: number }>
}

class BundleMonitor {
  private metrics: BundleMetrics[] = []

  recordMetrics(totalSize: number, chunks: Record<string, number>): void {
    const largestChunks = Object.entries(chunks)
      .map(([name, size]) => ({ name, size }))
      .sort((a, b) => b.size - a.size)
      .slice(0, 5)

    this.metrics.push({
      timestamp: new Date().toISOString(),
      totalSize,
      chunks,
      largestChunks
    })
  }

  getMetrics(): BundleMetrics[] {
    return this.metrics
  }

  getLatestMetrics(): BundleMetrics | null {
    return this.metrics[this.metrics.length - 1] || null
  }

  checkThreshold(threshold: number): boolean {
    const latest = this.getLatestMetrics()
    if (!latest) return false
    return latest.totalSize > threshold
  }

  clearMetrics(): void {
    this.metrics = []
  }
}

export const bundleMonitor = new BundleMonitor()
