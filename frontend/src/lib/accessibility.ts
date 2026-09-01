/**
 * Accessibility utilities for keyboard navigation and ARIA support
 */

/**
 * Trap focus within a modal or dialog
 */
export function trapFocus(element: HTMLElement): () => void {
  const focusableElements = element.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleTab = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  };

  element.addEventListener('keydown', handleTab);
  firstElement?.focus();

  return () => element.removeEventListener('keydown', handleTab);
}

/**
 * Announce to screen readers
 */
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);
  setTimeout(() => document.body.removeChild(announcement), 1000);
}

/**
 * Generate unique ID for ARIA attributes
 */
let idCounter = 0;
export function generateId(prefix = 'a11y'): string {
  return `${prefix}-${++idCounter}`;
}

/**
 * Keyboard navigation handler for lists
 */
export function createListKeyboardHandler<T extends HTMLElement>(
  items: T[],
  options?: {
    loop?: boolean;
    onSelect?: (item: T, index: number) => void;
  },
) {
  return (e: KeyboardEvent) => {
    const { loop = true, onSelect } = options || {};
    const currentIndex = items.findIndex((item) => item === document.activeElement);

    let nextIndex = currentIndex;

    switch (e.key) {
      case 'ArrowDown':
      case 'Down':
        e.preventDefault();
        nextIndex = currentIndex + 1;
        if (nextIndex >= items.length) {
          nextIndex = loop ? 0 : items.length - 1;
        }
        break;

      case 'ArrowUp':
      case 'Up':
        e.preventDefault();
        nextIndex = currentIndex - 1;
        if (nextIndex < 0) {
          nextIndex = loop ? items.length - 1 : 0;
        }
        break;

      case 'Home':
        e.preventDefault();
        nextIndex = 0;
        break;

      case 'End':
        e.preventDefault();
        nextIndex = items.length - 1;
        break;

      case 'Enter':
      case ' ':
        e.preventDefault();
        if (currentIndex >= 0 && onSelect) {
          onSelect(items[currentIndex], currentIndex);
        }
        return;

      default:
        return;
    }

    items[nextIndex]?.focus();
  };
}

/**
 * Skip to main content link for keyboard users
 */
export function createSkipLink(targetId: string): HTMLAnchorElement {
  const link = document.createElement('a');
  link.href = `#${targetId}`;
  link.textContent = 'Skip to main content';
  link.className = 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:p-2 focus:bg-primary focus:text-primary-foreground';
  link.onclick = (e) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    target?.focus();
    target?.scrollIntoView();
  };
  return link;
}

/**
 * Apply high contrast mode
 */
export function applyHighContrast(enabled: boolean): void {
  if (enabled) {
    document.documentElement.classList.add('high-contrast');
  } else {
    document.documentElement.classList.remove('high-contrast');
  }
}

/**
 * Apply reduced motion preference
 */
export function applyReducedMotion(enabled: boolean): void {
  if (enabled) {
    document.documentElement.classList.add('reduce-motion');
  } else {
    document.documentElement.classList.remove('reduce-motion');
  }
}

/**
 * Apply font size preference
 */
export function applyFontSize(size: 'small' | 'medium' | 'large'): void {
  document.documentElement.classList.remove('font-small', 'font-medium', 'font-large');
  document.documentElement.classList.add(`font-${size}`);
}
