/**
 * Service Worker Registration and Management
 * Handles PWA functionality and offline caching
 */

export interface ServiceWorkerConfig {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onOfflineReady?: () => void;
}

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '[::1]' ||
  window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

export async function registerServiceWorker(config?: ServiceWorkerConfig): Promise<void> {
  if ('serviceWorker' in navigator) {
    // Wait for load to prevent blocking
    window.addEventListener('load', async () => {
      const swUrl = '/sw.js';

      if (isLocalhost) {
        // Check if a service worker still exists or not
        await checkValidServiceWorker(swUrl, config);
      } else {
        // Register service worker in production
        await registerValidSW(swUrl, config);
      }
    });
  }
}

async function registerValidSW(swUrl: string, config?: ServiceWorkerConfig): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.register(swUrl);

    registration.onupdatefound = () => {
      const installingWorker = registration.installing;
      if (installingWorker == null) {
        return;
      }

      installingWorker.onstatechange = () => {
        if (installingWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            // New content available, notify user
            config?.onUpdate?.(registration);
          } else {
            // Content cached for offline use
            config?.onSuccess?.(registration);
            config?.onOfflineReady?.();
          }
        }
      };
    };
  } catch (error) {
    console.error('Error during service worker registration:', error);
  }
}

async function checkValidServiceWorker(swUrl: string, config?: ServiceWorkerConfig): Promise<void> {
  try {
    const response = await fetch(swUrl, {
      headers: { 'Service-Worker': 'script' },
    });

    const contentType = response.headers.get('content-type');
    if (
      response.status === 404 ||
      (contentType != null && contentType.indexOf('javascript') === -1)
    ) {
      // No service worker found, reload the page
      const registration = await navigator.serviceWorker.ready;
      await registration.unregister();
      window.location.reload();
    } else {
      // Service worker found, proceed with registration
      await registerValidSW(swUrl, config);
    }
  } catch {
    // No internet connection found; app continues in offline mode
  }
}

export async function unregisterServiceWorker(): Promise<void> {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.unregister();
    } catch (error) {
      console.error('Error unregistering service worker:', error);
    }
  }
}

export function checkServiceWorkerSupport(): boolean {
  return 'serviceWorker' in navigator;
}
