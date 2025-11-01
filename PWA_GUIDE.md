# PWA Guide - Global Market POS

## Overview

Global Market POS is now a fully-featured Progressive Web App (PWA) with complete offline capabilities, automatic syncing, and installable on any device.

## Features

### 🌐 Offline Support
- Complete offline functionality - no internet required
- All static assets cached (HTML, CSS, JS, images)
- Product catalog cached in IndexedDB
- Categories and store data available offline
- Service worker handles all offline requests

### 💾 Local Storage
- **IndexedDB Database**: Stores all POS data locally
  - Products with variants
  - Categories
  - Stores
  - Customers
  - Unsynced transactions

### 🔄 Automatic Sync
- Syncs every 30 seconds when online
- Immediate sync when device comes back online
- Failed transactions automatically retry
- Visual indicators for sync status
- Manual sync button available

### 📱 Installable
- Install on desktop (Windows, Mac, Linux)
- Install on mobile (Android, iOS)
- Works like a native app when installed
- Standalone window without browser UI
- App icon on home screen/desktop

### 🔔 User Notifications
- Offline mode indicator
- Sync progress notifications
- Unsynced transaction counter
- Connection status alerts

### 🛡️ Fallback Support
- Graceful degradation when server unavailable
- All transactions saved locally first
- No data loss even if server is down
- Automatic retry mechanism

## Installation

### Desktop Installation

#### Chrome/Edge
1. Open the app in your browser
2. Look for the install icon (⊕) in the address bar
3. Click "Install" when prompted
4. App will open in standalone window

#### Alternative Method
1. Visit `/install` page
2. Click "Install App" button
3. Follow browser prompts

### Mobile Installation

#### Android
1. Open app in Chrome browser
2. Tap the menu (⋮) button
3. Select "Add to Home screen"
4. Tap "Add" to confirm
5. Find app icon on your home screen

#### iOS (iPhone/iPad)
1. Open app in Safari browser
2. Tap the Share button (⬆)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add" to confirm
5. Find app icon on your home screen

## Usage

### Starting the POS

1. Open the installed app or navigate to `/pos-login`
2. Enter your PIN to login
3. The app will initialize offline storage
4. You're ready to start processing transactions

### Working Offline

When offline, the app will:
- Show an orange "Offline" badge at bottom right
- Continue to function normally
- Save all transactions locally
- Display count of unsynced transactions
- Automatically sync when connection returns

### Transaction Processing

#### Online Mode
1. Transactions save to server immediately
2. Stock updates happen in real-time
3. Success confirmation displayed

#### Offline Mode
1. Transactions save to IndexedDB
2. Toast shows "Saved offline - will sync automatically"
3. Transaction added to sync queue
4. Badge shows number of pending transactions

### Syncing

#### Automatic Sync
- Runs every 30 seconds when online
- Triggers immediately when coming back online
- Processes all unsynced transactions
- Updates server with local data

#### Manual Sync
1. Look for "Sync Now" button at bottom right
2. Click to force immediate sync
3. View sync progress with animated indicator
4. Success/failure notifications shown

### Monitoring Sync Status

The offline indicator shows:
- 🟢 **Online** (green badge) - Connected to server
- 🟠 **Offline** (orange badge) - No connection
- 🔵 **X pending sync** (blue badge) - Unsynced transactions
- 🟣 **Syncing...** (purple badge, animated) - Sync in progress

## Technical Details

### Cached Resources

The service worker caches:
- All static assets (JS, CSS, HTML)
- App icons and images
- Google Fonts
- Supabase images (30 days)
- API responses (5 minutes)

### IndexedDB Schema

#### Transactions Store
```javascript
{
  id: string,
  storeId: string,
  cashierId: string,
  items: array,
  subtotal: number,
  discount: number,
  total: number,
  paymentMethod: string,
  customerId: string?,
  notes: string?,
  timestamp: string,
  synced: boolean
}
```

#### Products Store
```javascript
{
  id: string,
  name: string,
  price: number,
  barcode: string?,
  image_url: string?,
  category_id: string?,
  is_available: boolean,
  product_variants: array,
  lastUpdated: string
}
```

### Sync Logic

1. **Check Online Status**: Verifies navigator.onLine
2. **Fetch Unsynced**: Gets all transactions where synced=false
3. **Process Sequentially**: Syncs transactions one by one
4. **Update Stock**: Reduces stock quantities after sync
5. **Mark Synced**: Sets synced=true in IndexedDB
6. **Error Handling**: Failed syncs remain in queue for retry

### Error Handling

#### Network Errors
- Transaction saved to IndexedDB
- User notified of offline save
- Automatic retry on next sync cycle

#### Server Errors
- Transaction kept in sync queue
- Error logged to console
- User notified of sync failure
- Manual retry available

#### Storage Errors
- Fallback to localStorage if available
- Error notification displayed
- Manual intervention may be required

## Troubleshooting

### App Won't Install
- Ensure HTTPS is enabled
- Clear browser cache
- Try different browser
- Check browser supports PWA

### Offline Mode Not Working
- Check service worker registered
- Verify IndexedDB enabled in browser
- Clear site data and reload
- Check browser console for errors

### Sync Not Working
- Verify online connection
- Check server is accessible
- Look for error messages in console
- Try manual sync button
- Check unsynced transaction count

### Data Not Persisting
- Ensure IndexedDB not blocked
- Check available storage space
- Verify browser privacy settings
- Clear browser cache cautiously

### Performance Issues
- Clear old cached data
- Reduce cached products count
- Check available device storage
- Update to latest app version

## Best Practices

### For Cashiers
1. Always verify sync status before closing
2. Use manual sync if many pending transactions
3. Check for offline indicator regularly
4. Report any sync failures immediately

### For Administrators
1. Monitor sync failures in logs
2. Ensure adequate server capacity
3. Regular database backups
4. Test offline mode periodically

### For IT Staff
1. Keep service worker updated
2. Monitor IndexedDB usage
3. Set up error tracking
4. Test update mechanisms

## Browser Support

### Fully Supported
- Chrome 90+
- Edge 90+
- Safari 14+
- Firefox 90+
- Chrome Android
- Safari iOS

### Partially Supported
- Older browsers may not support install
- Service worker may have limited features
- Fallback to online-only mode

## Security

- All data encrypted in transit (HTTPS)
- IndexedDB data stored securely on device
- No sensitive data in service worker cache
- Authentication required for sync
- Session tokens managed securely

## Updates

### Automatic Updates
- Service worker checks for updates
- New version downloaded in background
- Update applied on next app restart
- No user intervention needed

### Manual Updates
- Force reload browser page
- Clear cache if needed
- Reinstall app from `/install` page

## Support

For issues or questions:
1. Check console logs for errors
2. Review this guide thoroughly
3. Contact system administrator
4. Report bugs to development team

---

**Version**: 1.0.0  
**Last Updated**: 2025  
**Documentation**: See [Lovable PWA Docs](https://docs.lovable.dev)
