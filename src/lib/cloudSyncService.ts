/**
 * Cloud Sync Service
 * 
 * Architecture:
 * - Local Supabase (LAN) = PRIMARY database (all reads/writes)
 * - Cloud Supabase = BACKUP/SYNC target (sync when internet available)
 * 
 * This service syncs data from local Supabase to cloud Supabase
 * when internet connectivity is detected.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Cloud Supabase configuration (the original cloud instance)
const CLOUD_SUPABASE_URL = 'https://wvdrsofehwiopbkzrqit.supabase.co';
const CLOUD_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2ZHJzb2ZlaHdpb3Bia3pycWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0NzE1NjUsImV4cCI6MjA3NjA0NzU2NX0.GH5r-1xInHsL_EyzMOTVtb2QWIImuyJe-_ysqF0LCQ0';

// Tables to sync (order matters for foreign key dependencies)
const SYNC_TABLES = [
  'stores',
  'categories', 
  'products',
  'product_variants',
  'contacts',
  'accounts',
  'pos_users',
  'pos_transactions',
  'orders',
  'order_items',
  'purchases',
  'purchase_items',
  'expenses',
  'payment_receipts',
  'supplier_payments',
  'journal_entries',
  'journal_entry_lines',
  'cash_sessions',
  'stock_adjustments',
];

class CloudSyncService {
  private cloudClient: SupabaseClient | null = null;
  private isSyncing = false;
  private syncInterval: number | null = null;
  private lastSyncTime: string | null = null;

  constructor() {
    // Initialize cloud client
    this.cloudClient = createClient(CLOUD_SUPABASE_URL, CLOUD_SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    });
    
    // Load last sync time from localStorage
    this.lastSyncTime = localStorage.getItem('cloud_last_sync_time');
  }

  /**
   * Check if internet (cloud) is available
   */
  private async isCloudReachable(): Promise<boolean> {
    // First check if browser reports online
    if (!navigator.onLine) {
      console.log('[CloudSync] Browser reports offline, skipping cloud check');
      return false;
    }
    
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${CLOUD_SUPABASE_URL}/rest/v1/`, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'apikey': CLOUD_SUPABASE_ANON_KEY,
        }
      });
      
      clearTimeout(timeout);
      return response.ok || response.status === 400;
    } catch (e) {
      console.log('[CloudSync] Cloud not reachable:', e);
      return false;
    }
  }

  /**
   * Sync all data from local Supabase to cloud Supabase
   */
  async syncToCloud(): Promise<{ success: boolean; synced: number; errors: string[] }> {
    if (this.isSyncing) {
      console.log('[CloudSync] Sync already in progress');
      return { success: false, synced: 0, errors: ['Sync already in progress'] };
    }

    const isReachable = await this.isCloudReachable();
    if (!isReachable) {
      console.log('[CloudSync] Cloud not reachable, skipping sync');
      return { success: false, synced: 0, errors: ['Cloud not reachable'] };
    }

    this.isSyncing = true;
    let totalSynced = 0;
    const errors: string[] = [];

    console.log('[CloudSync] Starting sync to cloud...');
    toast.info('Syncing to cloud...', { duration: 2000 });

    try {
      for (const table of SYNC_TABLES) {
        try {
          const result = await this.syncTable(table);
          totalSynced += result.synced;
          if (result.error) {
            errors.push(`${table}: ${result.error}`);
          }
        } catch (e: any) {
          console.error(`[CloudSync] Error syncing ${table}:`, e);
          errors.push(`${table}: ${e.message}`);
        }
      }

      // Update last sync time
      this.lastSyncTime = new Date().toISOString();
      localStorage.setItem('cloud_last_sync_time', this.lastSyncTime);

      if (totalSynced > 0) {
        toast.success(`Synced ${totalSynced} records to cloud`);
      }

      console.log(`[CloudSync] Sync complete. Synced: ${totalSynced}, Errors: ${errors.length}`);
      return { success: errors.length === 0, synced: totalSynced, errors };

    } catch (e: any) {
      console.error('[CloudSync] Sync failed:', e);
      toast.error('Cloud sync failed');
      return { success: false, synced: totalSynced, errors: [e.message] };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync a single table from local to cloud
   */
  private async syncTable(tableName: string): Promise<{ synced: number; error?: string }> {
    if (!this.cloudClient) {
      return { synced: 0, error: 'Cloud client not initialized' };
    }

    try {
      // Get records updated since last sync from local
      // Use any to bypass strict typing since we're dynamically accessing tables
      const baseQuery = (supabase.from as any)(tableName).select('*');
      
      let query = baseQuery;
      if (this.lastSyncTime) {
        query = query.gte('updated_at', this.lastSyncTime);
      }

      const { data: localData, error: localError } = await query;

      if (localError) {
        console.error(`[CloudSync] Error fetching local ${tableName}:`, localError);
        return { synced: 0, error: localError.message };
      }

      if (!localData || localData.length === 0) {
        return { synced: 0 };
      }

      console.log(`[CloudSync] Syncing ${localData.length} records from ${tableName}`);

      // Upsert to cloud (use id as the conflict resolution key)
      const { error: cloudError } = await (this.cloudClient.from as any)(tableName)
        .upsert(localData, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        });

      if (cloudError) {
        console.error(`[CloudSync] Error upserting to cloud ${tableName}:`, cloudError);
        return { synced: 0, error: cloudError.message };
      }

      return { synced: localData.length };
    } catch (e: any) {
      console.error(`[CloudSync] Exception syncing ${tableName}:`, e);
      return { synced: 0, error: e.message };
    }
  }

  /**
   * Start automatic cloud sync at intervals
   */
  startAutoSync(intervalMs: number = 300000): void { // Default: 5 minutes
    if (this.syncInterval !== null) {
      console.log('[CloudSync] Auto-sync already running');
      return;
    }

    console.log(`[CloudSync] Starting auto-sync with interval ${intervalMs}ms`);

    // Sync immediately on start
    this.syncToCloud();

    // Then sync at intervals
    this.syncInterval = window.setInterval(() => {
      this.syncToCloud();
    }, intervalMs);

    // Also sync when coming online
    window.addEventListener('online', this.handleOnline);
  }

  /**
   * Stop automatic cloud sync
   */
  stopAutoSync(): void {
    if (this.syncInterval !== null) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('[CloudSync] Auto-sync stopped');
    }
    window.removeEventListener('online', this.handleOnline);
  }

  private handleOnline = () => {
    console.log('[CloudSync] Internet detected, triggering cloud sync...');
    setTimeout(() => this.syncToCloud(), 2000); // Wait 2 seconds for connection to stabilize
  };

  /**
   * Get sync status
   */
  getStatus(): { isSyncing: boolean; lastSyncTime: string | null } {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime
    };
  }

  /**
   * Force a full sync (ignore last sync time)
   */
  async forceFullSync(): Promise<{ success: boolean; synced: number; errors: string[] }> {
    const savedTime = this.lastSyncTime;
    this.lastSyncTime = null;
    const result = await this.syncToCloud();
    if (!result.success) {
      // Restore last sync time on failure
      this.lastSyncTime = savedTime;
    }
    return result;
  }

  /**
   * Sync all data FROM cloud TO local Supabase
   * This pulls cloud data to populate the local database
   */
  async syncFromCloud(): Promise<{ success: boolean; synced: number; errors: string[] }> {
    if (this.isSyncing) {
      console.log('[CloudSync] Sync already in progress');
      return { success: false, synced: 0, errors: ['Sync already in progress'] };
    }

    const isReachable = await this.isCloudReachable();
    if (!isReachable) {
      console.log('[CloudSync] Cloud not reachable, cannot sync from cloud');
      toast.error('Cloud not reachable');
      return { success: false, synced: 0, errors: ['Cloud not reachable'] };
    }

    this.isSyncing = true;
    let totalSynced = 0;
    const errors: string[] = [];

    console.log('[CloudSync] Starting sync FROM cloud to local...');
    toast.info('Pulling data from cloud...', { duration: 3000 });

    try {
      for (const table of SYNC_TABLES) {
        try {
          const result = await this.syncTableFromCloud(table);
          totalSynced += result.synced;
          if (result.error) {
            errors.push(`${table}: ${result.error}`);
          }
        } catch (e: any) {
          console.error(`[CloudSync] Error syncing ${table} from cloud:`, e);
          errors.push(`${table}: ${e.message}`);
        }
      }

      if (totalSynced > 0) {
        toast.success(`Pulled ${totalSynced} records from cloud`);
      } else {
        toast.info('No new data to pull from cloud');
      }

      console.log(`[CloudSync] Sync from cloud complete. Synced: ${totalSynced}, Errors: ${errors.length}`);
      return { success: errors.length === 0, synced: totalSynced, errors };

    } catch (e: any) {
      console.error('[CloudSync] Sync from cloud failed:', e);
      toast.error('Failed to pull from cloud');
      return { success: false, synced: totalSynced, errors: [e.message] };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync a single table FROM cloud TO local
   */
  private async syncTableFromCloud(tableName: string): Promise<{ synced: number; error?: string }> {
    if (!this.cloudClient) {
      return { synced: 0, error: 'Cloud client not initialized' };
    }

    try {
      // Get all records from cloud
      const { data: cloudData, error: cloudError } = await (this.cloudClient.from as any)(tableName)
        .select('*');

      if (cloudError) {
        console.error(`[CloudSync] Error fetching cloud ${tableName}:`, cloudError);
        return { synced: 0, error: cloudError.message };
      }

      if (!cloudData || cloudData.length === 0) {
        console.log(`[CloudSync] No data in cloud ${tableName}`);
        return { synced: 0 };
      }

      console.log(`[CloudSync] Pulling ${cloudData.length} records from cloud ${tableName}`);

      // Upsert to local (use id as the conflict resolution key)
      const { error: localError } = await (supabase.from as any)(tableName)
        .upsert(cloudData, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        });

      if (localError) {
        console.error(`[CloudSync] Error upserting to local ${tableName}:`, localError);
        return { synced: 0, error: localError.message };
      }

      return { synced: cloudData.length };
    } catch (e: any) {
      console.error(`[CloudSync] Exception syncing ${tableName} from cloud:`, e);
      return { synced: 0, error: e.message };
    }
  }
}

export const cloudSyncService = new CloudSyncService();
