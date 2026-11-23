# Offline Mode FAQ

## General Questions

### What is offline mode?

Offline mode allows you to continue using the Scavenger application even when you don't have an internet connection. Your data is cached locally, and any changes you make are automatically synced when you reconnect.

### How do I know if I'm in offline mode?

A visual indicator appears in the top-right corner of the screen when you're offline. You'll also see a banner at the top of the page notifying you that some features may be limited.

### Will my changes be saved when I'm offline?

Yes! Any changes you make while offline are queued locally and will be synchronized with the server automatically when your connection is restored.

### How long can I use the app offline?

You can use cached data for up to 24 hours. After that, the data expires and you'll need to reconnect to refresh it.

## Data Management

### How much storage does offline mode use?

Offline mode typically uses 5-50MB of storage depending on how much data you've accessed. You can check your exact usage in the Offline Settings page.

### Can I clear my offline data?

Yes, you can clear all offline data from the Offline Settings page. Note that this will delete any pending changes that haven't been synced yet.

### What happens if I clear my browser data?

Clearing browser data will remove all offline cached data and pending changes. Make sure you're online and have synced all changes before clearing browser data.

## Synchronization

### How do I manually sync my changes?

Go to the Offline Settings page and click "Sync Now". This will upload all pending changes to the server.

### What happens if there's a conflict?

If you made changes to data that was also changed by someone else, the server version (remote) wins by default. Your local changes will be overwritten.

### Can I see what changes are pending?

Yes, the Offline Settings page shows the number of pending operations waiting to be synced.

### What if sync fails?

If sync fails, the changes remain queued and will be retried automatically when you're back online. You can also manually retry from the Offline Settings page.

## Features

### What features work offline?

**Available Offline:**

- Viewing previously cached waste records
- Viewing previously cached participant data
- Viewing dashboard statistics (cached)
- Creating new records (queued for sync)
- Editing existing records (queued for sync)
- Viewing the map with cached locations

**Not Available Offline:**

- Real-time updates
- Search (requires server)
- Analytics (requires server)
- File uploads
- Blockchain transactions
- Email notifications

### Can I submit waste reports offline?

Yes! You can create waste reports offline. They will be queued and submitted automatically when you reconnect.

### Can I scan QR codes offline?

Yes, QR code scanning works offline. The scanned data will be processed locally and synced when online.

## Technical Questions

### What technology powers offline mode?

Offline mode uses several technologies:

- **Service Workers**: Cache static assets and API responses
- **IndexedDB**: Store data locally on your device
- **Background Sync**: Automatically sync when connection is restored
- **Progressive Web App (PWA)**: Enable app-like experience

### Is my data secure when stored offline?

Yes! Your data is stored securely using browser APIs (IndexedDB) which are isolated per domain. Other websites cannot access your offline data.

### Does offline mode work on mobile?

Yes! Offline mode works on all modern mobile browsers and is optimized for mobile devices.

### Can I install the app for better offline support?

Yes! If you're using Chrome, Edge, or Safari, you can install the app to your device for enhanced offline capabilities and app-like experience.

## Troubleshooting

### The offline indicator isn't showing

Try refreshing the page. If the issue persists, check if service workers are supported in your browser and enabled.

### My changes aren't syncing

1. Check that you're online (look for the indicator)
2. Go to Offline Settings and try manually syncing
3. Check the browser console for error messages
4. If sync continues to fail, contact support

### The app is slow when offline

This can happen if you have a lot of cached data. Try clearing old cached data from the Offline Settings page.

### I see "Service Worker registration failed"

This usually means:

- Your browser doesn't support service workers
- You're on an insecure connection (HTTP instead of HTTPS)
- Service workers are disabled in your browser settings

### Data isn't loading offline

Make sure you've accessed the data while online at least once. Only previously viewed data is available offline.

## Best Practices

### Preparing for offline use

1. Visit all pages you need while online to cache the data
2. Wait for the "Ready for offline use" message
3. Check Offline Settings to confirm data is cached

### Working offline

1. Be aware that your changes are queued, not immediately saved to the server
2. Try to reconnect periodically to sync changes
3. Monitor the number of pending operations

### After reconnecting

1. Wait for the automatic sync to complete
2. Verify your changes appear correctly
3. Check for any sync errors in Offline Settings

## Performance

### Will offline mode slow down my app?

No, offline mode actually makes the app faster! Cached data loads instantly, and the service worker speeds up subsequent page loads.

### How often should I clear cached data?

You don't need to clear cached data regularly. It expires automatically after 24 hours. Only clear if you're running low on storage space.

### Does offline mode use a lot of battery?

No, offline mode is designed to be battery-efficient. Service workers run only when needed.

## Privacy

### Can other people access my offline data?

No, your offline data is stored locally on your device and cannot be accessed by other users, even if they use the same device with a different browser profile.

### Is offline data backed up?

No, offline data is not backed up. Once synced to the server, the data is safely stored in the cloud. Local offline data is only a temporary cache.

### Can I disable offline mode?

Yes, you can disable offline functionality by:

1. Going to Offline Settings
2. Clearing all offline data
3. Unregistering the service worker through browser settings

However, we recommend keeping it enabled for better performance and reliability.

## Support

### Where can I get help?

- Check the Offline Settings page for status and troubleshooting
- Review the Offline Mode Documentation
- Contact support if issues persist

### How do I report a bug?

If you encounter issues with offline mode:

1. Note what you were doing when the issue occurred
2. Check the browser console for error messages
3. Note your browser and version
4. Submit a bug report through our support channel

### Can I suggest improvements?

Absolutely! We welcome feedback on offline functionality. Submit suggestions through our feedback form.

---

**Last Updated:** {{currentDate}}
**Version:** 1.0.0
