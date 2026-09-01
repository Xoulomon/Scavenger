# Offline Mode Documentation

## Overview

The Scavenger application includes comprehensive offline mode capabilities, allowing users to continue working even when they lose internet connectivity. All changes made offline are automatically synchronized when the connection is restored.

## Architecture

### Components

1. **Service Worker** (`lib/offline/serviceWorker.ts`)
   - Registers and manages the PWA service worker
   - Caches static assets and API responses
   - Provides offline-first experience

2. **Offline Storage** (`lib/offline/storage.ts`)
   - IndexedDB-based persistent storage
   - Query caching
   - Mutation queuing
   - Settings storage

3. **Sync Manager** (`lib/offline/syncManager.ts`)
   - Manages offline mutation synchronization
   - Retry logic for failed operations
   - Conflict resolution

4. **Offline Indicator** (`components/offline/OfflineIndicator.tsx`)
   - Visual status indicator
   - Connection quality monitoring
   - User notifications

## Features

### 1. Automatic Offline Detection

The app automatically detects when the user goes offline using the `navigator.onLine` API and network event listeners.

```typescript
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

function MyComponent() {
  const isOnline = useOnlineStatus();

  return <div>Status: {isOnline ? 'Online' : 'Offline'}</div>;
}
```

### 2. Data Caching

All viewed data is automatically cached for offline access using IndexedDB:

- **Queries**: API responses are cached
- **Assets**: Static files cached by service worker
- **TTL**: Data expires after 24 hours

### 3. Offline Mutations

Operations performed while offline are queued and synced automatically:

```typescript
import { useOfflineMutation } from '@/hooks/useOfflineMutation';

function CreateWasteForm() {
  const mutation = useOfflineMutation({
    mutationFn: async (data) => createWaste(data),
    mutationKey: ['create-waste'],
    offlineMessage: 'Waste report queued for submission',
  });

  const handleSubmit = async (data) => {
    try {
      await mutation.mutateAsync(data);
      // Successful or queued
    } catch (error) {
      // Handle error
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
      <button disabled={mutation.isPending}>
        {mutation.isOnline ? 'Submit' : 'Queue for Later'}
      </button>
    </form>
  );
}
```

### 4. Connection Quality Monitoring

Track connection quality using the Network Information API:

```typescript
import { useConnectionQuality } from '@/hooks/useOnlineStatus';

function MyComponent() {
  const { effectiveType, downlink, rtt } = useConnectionQuality();

  return (
    <div>
      Connection: {effectiveType} ({downlink}Mbps, {rtt}ms)
    </div>
  );
}
```

### 5. Service Worker Caching

The service worker implements intelligent caching strategies:

```typescript
// Network First for API calls
{
  urlPattern: /\/api\/.*/,
  handler: 'NetworkFirst',
  options: {
    cacheName: 'api-cache',
    expiration: {
      maxEntries: 200,
      maxAgeSeconds: 60
    }
  }
}

// Cache First for static assets
{
  urlPattern: /\.(js|css|png|jpg|svg)$/,
  handler: 'CacheFirst',
  options: {
    cacheName: 'static-cache'
  }
}
```

## API Reference

### Storage API

```typescript
// Query cache
await saveQuery('key', data);
const data = await getQuery('key');
await deleteQuery('key');
await clearQueries();

// Mutation queue
const id = await queueMutation({
  mutationKey: ['create-user'],
  variables: { name: 'John' }
});
const pending = await getPendingMutations();
await updateMutationStatus(id, 'success');
await deleteMutation(id);

// General cache
await setCache('key', data, 3600000); // 1 hour TTL
const data = await getCache('key');
await clearCache();

// Settings
await setSetting('key', value);
const value = await getSetting('key');

// Database management
await clearAllData();
const size = await getDatabaseSize();
```

### Sync Manager API

```typescript
import { syncManager } from '@/lib/offline/syncManager';

// Register mutation handler
syncManager.registerMutationHandler('create-user', async (mutation) => {
  return await api.createUser(mutation.variables);
});

// Manual sync
const result = await syncManager.syncPendingMutations();
console.log(`${result.success} succeeded, ${result.failed} failed`);

// Check sync status
const isSyncing = syncManager.syncing;
```

### Service Worker API

```typescript
import {
  registerServiceWorker,
  unregisterServiceWorker,
  checkServiceWorkerSupport
} from '@/lib/offline/serviceWorker';

// Register
await registerServiceWorker({
  onSuccess: (registration) => {
    console.log('Service worker registered');
  },
  onUpdate: (registration) => {
    console.log('New version available');
  },
  onOfflineReady: () => {
    console.log('App ready for offline use');
  }
});

// Check support
if (checkServiceWorkerSupport()) {
  await registerServiceWorker();
}

// Unregister
await unregisterServiceWorker();
```

## IndexedDB Schema

### Stores

1. **queries**
   ```typescript
   {
     key: string,
     data: unknown,
     timestamp: number
   }
   ```

2. **mutations**
   ```typescript
   {
     id: string,
     mutationKey: string[],
     variables: unknown,
     timestamp: number,
     retries: number,
     status: 'pending' | 'syncing' | 'failed' | 'success',
     error?: string
   }
   ```

3. **cache**
   ```typescript
   {
     key: string,
     data: unknown,
     timestamp: number,
     expiresAt?: number
   }
   ```

4. **settings**
   ```typescript
   {
     key: string,
     value: unknown
   }
   ```

## Implementation Guide

### Step 1: Register Service Worker

In your main entry file:

```typescript
import { registerServiceWorker } from '@/lib/offline/serviceWorker';

registerServiceWorker({
  onOfflineReady: () => {
    console.log('App is ready for offline use');
  }
});
```

### Step 2: Add Offline Indicator

```typescript
import { OfflineIndicator, OfflineBanner } from '@/components/offline/OfflineIndicator';

function App() {
  return (
    <>
      <OfflineBanner />
      <OfflineIndicator />
      {/* Your app content */}
    </>
  );
}
```

### Step 3: Use Offline Mutations

```typescript
import { useOfflineMutation } from '@/hooks/useOfflineMutation';

const mutation = useOfflineMutation({
  mutationFn: apiCall,
  mutationKey: ['my-mutation'],
});
```

### Step 4: Register Sync Handlers

```typescript
import { syncManager } from '@/lib/offline/syncManager';

// Register handlers for your mutations
syncManager.registerMutationHandler('create-waste', async (mutation) => {
  return await api.createWaste(mutation.variables);
});
```

## Testing

### Unit Tests

```bash
npm test tests/offline/
```

### Manual Testing

1. **Test Offline Mode:**
   - Open DevTools → Network tab
   - Enable "Offline" mode
   - Verify offline indicator appears
   - Perform operations
   - Re-enable network
   - Verify sync occurs

2. **Test Service Worker:**
   - Open DevTools → Application tab
   - Check "Service Workers"
   - Verify status is "activated"
   - Test cache storage

3. **Test IndexedDB:**
   - Open DevTools → Application tab
   - Check "IndexedDB"
   - Verify data is stored correctly

## Best Practices

### 1. Cache Strategically

```typescript
// Cache frequently accessed data
await saveQuery('user-profile', userData);

// Don't cache sensitive data unnecessarily
// Clear cache when user logs out
await clearQueries();
```

### 2. Handle Errors Gracefully

```typescript
try {
  await mutation.mutateAsync(data);
} catch (error) {
  if (!isOnline) {
    toast.info('Changes queued for when you're online');
  } else {
    toast.error('Failed to save changes');
  }
}
```

### 3. Provide Clear Feedback

```typescript
{mutation.isOnline ? (
  <span>Save</span>
) : (
  <span>Queue for Later</span>
)}
```

### 4. Sync Regularly

```typescript
// Auto-sync on visibility change
document.addEventListener('visibilitychange', async () => {
  if (!document.hidden && navigator.onLine) {
    await syncManager.syncPendingMutations();
  }
});
```

## Performance

### Optimization Tips

1. **Limit cache size:** Clear old data regularly
2. **Use TTL:** Set expiration for cached data
3. **Batch operations:** Group related mutations
4. **Lazy load:** Don't cache everything upfront
5. **Monitor storage:** Track IndexedDB usage

### Storage Limits

- Chrome: ~60% of available disk space
- Firefox: ~50% of available disk space
- Safari: ~1GB per domain

## Security

### Considerations

1. **Local storage is not encrypted**
   - Don't store sensitive data offline
   - Clear cache on logout

2. **Service worker has broad access**
   - Review cached resources
   - Use HTTPS in production

3. **Sync conflicts**
   - Implement proper conflict resolution
   - Log conflicts for review

## Browser Support

- ✅ Chrome 40+
- ✅ Firefox 44+
- ✅ Safari 11.1+
- ✅ Edge 17+
- ❌ IE 11 (no service worker support)

## Troubleshooting

### Service Worker Not Registering

```typescript
// Check console for errors
if ('serviceWorker' in navigator) {
  console.log('Service Workers supported');
} else {
  console.log('Service Workers not supported');
}
```

### Data Not Syncing

```typescript
// Check pending mutations
const pending = await getPendingMutations();
console.log('Pending mutations:', pending);

// Manual sync
await syncManager.syncPendingMutations();
```

### Storage Quota Exceeded

```typescript
// Check storage usage
const size = await getDatabaseSize();
console.log('Storage used:', size.formatted);

// Clear old data
await clearQueries();
await clearCache();
```

## Future Enhancements

- Background sync API integration
- Periodic background sync
- Push notifications for sync completion
- Advanced conflict resolution UI
- Selective sync
- Compression for cached data
- Encryption for sensitive data

## References

- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Network Information API](https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API)
- [PWA Documentation](https://web.dev/progressive-web-apps/)
