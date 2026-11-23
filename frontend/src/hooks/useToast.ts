import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/contractErrors'

/**
 * Non-hook error reporter that routes errors through the single toast
 * strategy. Safe to call from class components, error boundaries, and
 * non-React modules (e.g. query caches) where hooks cannot be used.
 */
export function reportError(error: unknown): void {
  toast.error(getErrorMessage(error))
}

export function useToast() {
  return {
    success: (message: string) => toast.success(message),
    error: (error: unknown) => reportError(error),
    info: (message: string) => toast.info(message)
  }
}
