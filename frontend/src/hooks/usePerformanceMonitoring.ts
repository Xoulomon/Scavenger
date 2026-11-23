import { useEffect } from 'react'
import { initWebVitals, sendMetricsToAnalytics } from '@/lib/webVitals'

/**
 * Hook to initialize and monitor Web Vitals
 */
export function usePerformanceMonitoring(debug = false): void {
  useEffect(() => {
    const cleanup = initWebVitals((metric) => {
      // Send to analytics if endpoint exists
      try {
        sendMetricsToAnalytics({ [metric.name.toLowerCase()]: metric })
      } catch (error) {
        if (debug) console.error('Failed to send metrics:', error)
      }
    }, debug)

    return cleanup
  }, [debug])
}

/**
 * Hook to get current performance metrics
 */
export function usePerformanceMetrics() {
  return {
    navigationStart: performance.timing.navigationStart,
    domContentLoadedEventEnd: performance.timing.domContentLoadedEventEnd,
    loadEventEnd: performance.timing.loadEventEnd
  }
}

export { initWebVitals, sendMetricsToAnalytics } from '@/lib/webVitals'
