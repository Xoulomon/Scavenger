/**
 * Offline Settings Page
 * Manage offline functionality and storage
 */

import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useAsync } from '../hooks/useAsync';
import { useResource } from '../hooks/useResource';
import { getDatabaseSize, clearAllData, getPendingMutations } from '../lib/offline/storage';
import { syncManager } from '../lib/offline/syncManager';
import { Trash2, RefreshCw, Database, Wifi } from 'lucide-react';

export function OfflineSettings() {
  const isOnline = useOnlineStatus();
  const storage = useResource(getDatabaseSize);
  const pending = useResource(async () => (await getPendingMutations()).length);

  const storageInfo = storage.data ?? { bytes: 0, formatted: '0 B' };
  const pendingCount = pending.data ?? 0;

  const { run: handleSync, isLoading: isSyncing } = useAsync(async () => {
    if (!isOnline) {
      alert('Cannot sync while offline');
      return;
    }

    try {
      const result = await syncManager.syncPendingMutations();
      alert(`Sync complete: ${result.success} succeeded, ${result.failed} failed`);
      await pending.reload();
    } catch (error) {
      alert('Sync failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  });

  const { run: handleClearData, isLoading: isClearing } = useAsync(async () => {
    if (!confirm('Are you sure you want to clear all offline data? This action cannot be undone.')) {
      return;
    }

    try {
      await clearAllData();
      await storage.reload();
      await pending.reload();
      alert('All offline data cleared successfully');
    } catch (error) {
      alert('Failed to clear data: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">Offline Mode Settings</h1>
      <p className="text-muted-foreground mb-8">
        Manage offline functionality and cached data
      </p>

      {/* Connection Status */}
      <div className="mb-8 p-6 rounded-lg border border-border">
        <div className="flex items-center gap-3 mb-2">
          <Wifi className={`h-5 w-5 ${isOnline ? 'text-green-500' : 'text-destructive'}`} />
          <h2 className="text-xl font-semibold">Connection Status</h2>
        </div>
        <p className="text-lg">
          Status: <span className={isOnline ? 'text-green-500' : 'text-destructive'}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          {isOnline
            ? 'You are connected to the internet. All features are available.'
            : 'You are offline. Some features are limited, and changes will sync when you reconnect.'}
        </p>
      </div>

      {/* Storage Info */}
      <div className="mb-8 p-6 rounded-lg border border-border">
        <div className="flex items-center gap-3 mb-4">
          <Database className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Storage</h2>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Offline data size:</span>
            <span className="font-medium">{storageInfo.formatted}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Pending operations:</span>
            <span className="font-medium">{pendingCount}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-4">
        <div className="p-6 rounded-lg border border-border">
          <div className="flex items-start gap-3">
            <RefreshCw className="h-5 w-5 mt-1" />
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Sync Pending Operations</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Synchronize all pending operations with the server. This will upload any changes made while offline.
              </p>
              <button
                onClick={handleSync}
                disabled={!isOnline || isSyncing || pendingCount === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Sync Now ({pendingCount})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-lg border border-destructive/20 bg-destructive/5">
          <div className="flex items-start gap-3">
            <Trash2 className="h-5 w-5 mt-1 text-destructive" />
            <div className="flex-1">
              <h3 className="font-semibold mb-1 text-destructive">Clear All Offline Data</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Delete all cached data and pending operations. This action cannot be undone.
              </p>
              <button
                onClick={handleClearData}
                disabled={isClearing}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isClearing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Clear All Data
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="mt-8 p-4 rounded-lg bg-muted text-sm">
        <h4 className="font-semibold mb-2">About Offline Mode</h4>
        <ul className="space-y-1 text-muted-foreground list-disc list-inside">
          <li>Your data is stored securely on your device using IndexedDB</li>
          <li>Changes made offline are automatically synced when you reconnect</li>
          <li>Cached data expires after 24 hours to prevent stale information</li>
          <li>Service workers cache static assets for faster loading</li>
        </ul>
      </div>
    </div>
  );
}
