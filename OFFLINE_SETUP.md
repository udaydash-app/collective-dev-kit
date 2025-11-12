# Offline Setup Guide

## Overview

The Global Market POS app now supports full offline operation. Once data is cached, the app can function completely without an internet connection, storing transactions locally and syncing them when connectivity is restored.

## How Offline Mode Works

### 1. Data Caching
- On first launch with internet, the app automatically caches all essential data to IndexedDB
- Cached data includes:
  - Products (with variants and pricing)
  - Categories
  - Stores
  - Customers
  - POS Users (with encrypted PINs)
  - Combo Offers and BOGO offers
  
### 2. Offline Operations
When offline, the app:
- Uses cached data for all read operations
- Stores all transactions locally in IndexedDB
- Allows POS operations (sales, refunds, payments)
- Validates POS user logins against cached credentials

### 3. Automatic Sync
When internet connection is restored:
- All pending transactions automatically sync to the server
- Cache is refreshed if data is older than 24 hours
- Sync status is displayed in the offline indicator

## Setup Instructions

### For Windows EXE App

1. **First Launch (Online Required)**
   - Ensure internet connection is available
   - Launch the app - it will automatically cache all data
   - Wait for "Data cached successfully" message in console
   - This usually takes 30-60 seconds depending on data size

2. **Verify Cache Status**
   - Login as admin
   - Navigate to Settings page
   - Check the "Offline Data Cache" card
   - Verify "Last cached" timestamp is recent

3. **Manual Cache Refresh** (Optional)
   - Go to Settings > Offline Data Cache
   - Click "Update Cache" or "Refresh Cache" button
   - This forces a full data refresh from server

4. **Test Offline Mode**
   - Disconnect from internet
   - Relaunch the app
   - Login with POS user PIN
   - Verify products load from cache
   - Complete a test transaction
   - Reconnect to internet
   - Watch transactions sync automatically

## Cache Management

### Viewing Cache Status
- **Settings Page**: Shows last cache time and freshness
- **Offline Indicator**: Shows sync status and pending transactions
- **Console Logs**: Detailed cache operations

### Manual Cache Operations
Navigate to: **Admin > Settings > Offline Data Cache**
- View last cache timestamp
- Check if cache is fresh or stale
- Manually refresh cache when needed

### Cache Expiration
- Cache is considered **stale** after 24 hours
- Stale cache triggers automatic refresh when online
- Can be manually refreshed at any time via Settings

## Offline Capabilities

### What Works Offline:
✅ POS Login with PIN
✅ Product browsing and search
✅ Add products to cart
✅ Complete sales transactions
✅ Process cash, mobile money, and credit sales
✅ Create refunds
✅ Hold/retrieve tickets
✅ Print receipts (if printer configured)
✅ View cached customer information
✅ Apply combo offers and discounts

### What Requires Internet:
❌ New product creation
❌ Stock updates from admin panel
❌ User management
❌ Settings changes
❌ Report generation
❌ Real-time inventory sync

## Sync Management

### Automatic Sync
- Runs every 30 seconds when online
- Syncs all pending offline transactions
- Shows progress in offline indicator

### Manual Sync
- Click "Sync Now" button in offline indicator
- Forces immediate sync of pending transactions
- Available in Settings or Admin dashboard

### Viewing Pending Transactions
Navigate to: **Admin > Offline Sync**
- View all unsynced transactions
- See sync status and errors
- Retry failed transactions
- Clear old transactions

## Troubleshooting

### App Won't Work Offline
1. Check if data was cached:
   - Go to Settings > Offline Data Cache
   - Verify last cache time exists
   - If not, connect to internet and click "Update Cache"

2. Clear and re-cache:
   - Open browser DevTools (F12)
   - Go to Application > IndexedDB
   - Delete "GlobalMarketDB" database
   - Refresh app while online to re-cache

### Transactions Not Syncing
1. Check network connection
2. View sync status in Offline Indicator
3. Go to Admin > Offline Sync to see pending items
4. Use "Sync Now" button to force sync
5. Check console for sync errors

### Login Issues Offline
1. Ensure you logged in at least once online
2. POS user credentials are cached after first online login
3. Clear cache and re-login online if needed

### Performance Issues
- Large databases (10,000+ products) may take longer to cache
- Consider limiting cached products to active items only
- Clear old transactions periodically from Offline Sync page

## Best Practices

1. **Daily Cache Refresh**
   - Refresh cache at start of business day
   - Ensures latest prices and products

2. **Regular Syncing**
   - Keep app online when possible
   - Sync runs automatically every 30 seconds
   - Don't accumulate too many offline transactions

3. **Backup Strategy**
   - Don't rely solely on local cache
   - Sync frequently to cloud database
   - Export important data regularly

4. **Monitor Sync Status**
   - Check offline indicator regularly
   - Address sync errors promptly
   - Don't let unsent transactions accumulate

## Technical Details

### Storage Technology
- **IndexedDB**: Browser-based local database
- **Capacity**: Up to several GB per origin
- **Persistence**: Data survives app restarts
- **Encryption**: PINs are hashed before storage

### Sync Algorithm
1. Fetch unsynced transactions from IndexedDB
2. For each transaction:
   - Attempt to insert into Supabase
   - Mark as synced if successful
   - Log error if failed
3. Retry failed transactions on next sync
4. Auto-refresh cache if stale

### Data Flow
```
Online:  Server → Cache → App Display
Offline: Cache → App Display
         App Changes → Local Storage
Online:  Local Storage → Server → Cache Update
```
