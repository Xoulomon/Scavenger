/**
 * Accessibility utilities for keyboard navigation and ARIA support
 *
 * Focus management API (WCAG 2.1 AA):
 * - `getFocusableElements(container)` returns the currently focusable elements
 *   inside a container, in DOM order.
 * - `createFocusTrap(container, options)` activates a focus trap: it captures
 *   the previously focused element, moves focus into the container (to
 *   `options.initialFocus` or the first focusable element), cycles Tab /
 *   Shift+Tab within the container, invokes `options.onEscape` on Escape, and
 *   returns a cleanup function that removes listeners and restores focus to
 *   the previously focused element.
 * - `useFocusTrap(ref, options)` is the React hook wrapper around
 *   `createFocusTrap`; it activates while `options.active` (default `true`)
 *   and cleans up on deactivation/unmount.
 * - `trapFocus(element)` is DEPRECATED and kept for backwards compatibility.
 *   It is now implemented on top of `createFocusTrap`. Migrate to
 *   `createFocusTrap` (or `useFocusTrap`) to gain Escape handling and focus
 *   restoration.
 */

import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])'
].join(', ')

/**
 * Return the focusable elements inside a container, in DOM order.
 * Elements that are hidden (display: none / visibility: hidden) are excluded.
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const candidates = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))

  return candidates.filter((el) => {
    if (el.hasAttribute('disabled')) return false
    if (el.getAttribute('aria-hidden') === 'true') return false
    // offsetParent is null for display:none elements (and fixed-position ones,
    // so fall back to a computed-style check for those).
    if (el.offsetParent === null) {
      const style = window.getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden') {
        return false
      }
    }
    return true
  })
}

export interface FocusTrapOptions {
  /** Element to focus when the trap activates. Defaults to the first focusable element. */
  initialFocus?: HTMLElement | null
  /** Called when Escape is pressed while the trap is active. */
  onEscape?: () => void
  /** Whether to restore focus to the previously focused element on deactivation. Defaults to true. */
  restoreFocus?: boolean
}

/**
 * Activate a focus trap on `container`.
 * Returns a cleanup function that deactivates the trap and restores focus.
 */
export function createFocusTrap(
  container: HTMLElement,
  options: FocusTrapOptions = {}
): () => void {
  const { initialFocus, onEscape, restoreFocus = true } = options
  const previouslyFocused = document.activeElement as HTMLElement | null

  const focusInitial = () => {
    const target = initialFocus ?? getFocusableElements(container)[0] ?? container
    if (target === container && !container.hasAttribute('tabindex')) {
      container.setAttribute('tabindex', '-1')
    }
    target.focus()
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (onEscape) {
        e.preventDefault()
        e.stopPropagation()
        onEscape()
      }
      return
    }

    if (e.key !== 'Tab') return

    const focusable = getFocusableElements(container)
    if (focusable.length === 0) {
      e.preventDefault()
      container.focus()
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement

    if (e.shiftKey) {
      if (active === first || !container.contains(active)) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (active === last || !container.contains(active)) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  container.addEventListener('keydown', handleKeyDown)
  focusInitial()

  return () => {
    container.removeEventListener('keydown', handleKeyDown)
    if (restoreFocus && previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus()
    }
  }
}

/**
 * React hook wrapper around `createFocusTrap`.
 * Activates while `options.active` is true (default) and cleans up on
 * deactivation or unmount, restoring focus to the previously focused element.
 */
export function useFocusTrap(
  ref: React.RefObject<HTMLElement | null>,
  options: FocusTrapOptions & { active?: boolean } = {}
): void {
  const { active = true, initialFocus, onEscape, restoreFocus } = options
  const onEscapeRef = useRef(onEscape)
  onEscapeRef.current = onEscape

  useEffect(() => {
    if (!active || !ref.current) return
    const cleanup = createFocusTrap(ref.current, {
      initialFocus,
      restoreFocus,
      onEscape: () => onEscapeRef.current?.()
    })
    return cleanup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ref, initialFocus, restoreFocus])
}

/**
 * Trap focus within a modal or dialog.
 * @deprecated Use `createFocusTrap` (or the `useFocusTrap` hook) instead;
 * this wrapper does not handle Escape or focus restoration.
 */
export function trapFocus(element: HTMLElement): () => void {
  return createFocusTrap(element, { restoreFocus: false })
}

/**
 * Announce to screen readers
 */
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const announcement = document.createElement('div')
  announcement.setAttribute('role', 'status')
  announcement.setAttribute('aria-live', priority)
  announcement.setAttribute('aria-atomic', 'true')
  announcement.className = 'sr-only'
  announcement.textContent = message

  document.body.appendChild(announcement)
  setTimeout(() => document.body.removeChild(announcement), 1000)
}

/**
 * Get (creating if needed) a persistent aria-live region for announcements.
 * Reusing a single region avoids dropped announcements from rapid updates.
 */
export function getLiveRegion(priority: 'polite' | 'assertive' = 'polite'): HTMLElement {
  const id = `a11y-live-region-${priority}`
  let region = document.getElementById(id)
  if (!region) {
    region = document.createElement('div')
    region.id = id
    region.setAttribute('role', 'status')
    region.setAttribute('aria-live', priority)
    region.setAttribute('aria-atomic', 'true')
    region.className = 'sr-only'
    document.body.appendChild(region)
  }
  return region
}

/**
 * Announce a message through the persistent aria-live region.
 */
export function announceInLiveRegion(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void {
  const region = getLiveRegion(priority)
  region.textContent = ''
  // Force a re-announcement even when the message is unchanged.
  setTimeout(() => {
    region.textContent = message
  }, 50)
}

/**
 * Generate unique ID for ARIA attributes
 */
let idCounter = 0
export function generateId(prefix = 'a11y'): string {
  return `${prefix}-${++idCounter}`
}

/**
 * Keyboard navigation handler for lists
 */
export function createListKeyboardHandler<T extends HTMLElement>(
  items: T[],
  options?: {
    loop?: boolean
    onSelect?: (item: T, index: number) => void
  }
) {
  return (e: KeyboardEvent) => {
    const { loop = true, onSelect } = options || {}
    const currentIndex = items.findIndex((item) => item === document.activeElement)

    let nextIndex = currentIndex

    switch (e.key) {
      case 'ArrowDown':
      case 'Down':
        e.preventDefault()
        nextIndex = currentIndex + 1
        if (nextIndex >= items.length) {
          nextIndex = loop ? 0 : items.length - 1
        }
        break

      case 'ArrowUp':
      case 'Up':
        e.preventDefault()
        nextIndex = currentIndex - 1
        if (nextIndex < 0) {
          nextIndex = loop ? items.length - 1 : 0
        }
        break

      case 'Home':
        e.preventDefault()
        nextIndex = 0
        break

      case 'End':
        e.preventDefault()
        nextIndex = items.length - 1
        break

      case 'Enter':
      case ' ':
        e.preventDefault()
        if (currentIndex >= 0 && onSelect) {
          onSelect(items[currentIndex], currentIndex)
        }
        return

      default:
        return
    }

    items[nextIndex]?.focus()
  }
}

/**
 * Skip to main content link for keyboard users
 */
export function createSkipLink(targetId: string): HTMLAnchorElement {
  const link = document.createElement('a')
  link.href = `#${targetId}`
  link.textContent = 'Skip to main content'
  link.className =
    'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:p-2 focus:bg-primary focus:text-primary-foreground'
  link.onclick = (e) => {
    e.preventDefault()
    const target = document.getElementById(targetId)
    target?.focus()
    target?.scrollIntoView()
  }
  return link
}

/**
 * Apply high contrast mode
 */
export function applyHighContrast(enabled: boolean): void {
  if (enabled) {
    document.documentElement.classList.add('high-contrast')
  } else {
    document.documentElement.classList.remove('high-contrast')
  }
}

/**
 * Apply reduced motion preference
 */
export function applyReducedMotion(enabled: boolean): void {
  if (enabled) {
    document.documentElement.classList.add('reduce-motion')
  } else {
    document.documentElement.classList.remove('reduce-motion')
  }
}

/**
 * Apply font size preference
 */
export function applyFontSize(size: 'small' | 'medium' | 'large'): void {
  document.documentElement.classList.remove('font-small', 'font-medium', 'font-large')
  document.documentElement.classList.add(`font-${size}`)
}
