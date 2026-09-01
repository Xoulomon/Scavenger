# Offline Functionality

This document describes the offline functionality implemented in the Scavenger frontend application.

## Features

### 1. Online/Offline Status Detection
- Automatically detects when the user goes online or offline
- Shows a visual indicator in the top-right corner when offline
- Uses the `navigator.onLine` API and window events

### 2. Data Caching with IndexedDB
- All query data is persisted to IndexedDB for offline access
- Uses `@tanstack/react-query-persist-client` for automatic persistence
- Data expires after 24 hours to prevent stale data

### 3. Offline Mutation Queuing
- Mutations are queued when offline and executed when connection is restored
- Uses a custom `useOfflineMutation` hook that wraps `@tanstack/react-query`'s `useMutation`
- Failed mutations are retried up to 3 times before being marked as failed

### 4. Service Worker Caching
- Implements Progressive Web App (PWA) features with `vite-plugin-pwa`
- Caches static assets and API responses for offline access
- Provides runtime caching for Stellar API calls and IPFS content

### 5. Conflict Resolution
- Implements a "remote-wins" conflict resolution strategy by default
- Detects conflicts when syncing offline mutations
- Logs conflicts for debugging and future manual resolution

## Usage

### Using Offline Mutations

Replace `useMutation` with `useOfflineMutation` for operations that should work offline:

```typescript
import { useOfflineMutation } from '@/hooks/useOfflineMutation'

function MyComponent() {
  const mutation = useOfflineMutation({
    mutationFn: async (data) => {
      // Your mutation logic here
      return apiCall(data)
    },
    onSuccess: (result) => {
      // Handle success
    },
    mutationKey: ['my-mutation'],
  })

  const handleSubmit = async () => {
    try {
      const result = await mutation.mutateAsync(formData)
      // Result is available immediately if online, or queued if offline
    } catch (error) {
      // Handle error
    }
  }

  return (
    <button onClick={handleSubmit} disabled={mutation.isPending}>
      {mutation.isOnline ? 'Submit' : 'Queue for Later'}
      Submit
    </button>
  )
}
```

### Checking Online Status

```typescript
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

function MyComponent() {
  const isOnline = useOnlineStatus()

  return (
    <div>
      Status: {isOnline ? 'Online' : 'Offline'}
    </div>
  )
}
```

## Technical Implementation

### IndexedDB Schema
- `queries`: Stores React Query cache data
- `mutations`: Queues offline mutations for later execution
- `cache`: General-purpose cache for other data

### Service Worker Configuration
- Caches static assets (JS, CSS, HTML, images)
- Runtime caching for Stellar API calls (NetworkFirst strategy)
- Runtime caching for IPFS content (CacheFirst strategy)

### Conflict Resolution Strategies
- `remote-wins`: Always use the server response
- `local-wins`: Always use the local cached data
- `manual`: Requires user intervention (not implemented)

## Testing

Run the offline functionality tests:

```bash
npm test src/lib/offline.test.tsx
npm test src/components/OfflineIndicator.test.tsx
```

## Browser Support

- Modern browsers with IndexedDB support
- Service Workers require HTTPS in production
- Progressive enhancement - works without JavaScript disabled

## Future Enhancements

- Manual conflict resolution UI
- Background sync for better UX
- Selective caching based on user preferences
- Offline analytics and error reporting
