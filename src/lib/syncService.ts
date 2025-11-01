/**
 * Sync service for syncing offline transactions with the server
 */

import { offlineDB, OfflineTransaction } from './offlineDB';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

class SyncService {
  private isSyncing = false;
  private syncInterval: number | null = null;

  async syncTransactions(): Promise<{ success: number; failed: number }> {
    if (this.isSyncing) {
      console.log('Sync already in progress');
      return { success: 0, failed: 0 };
    }

    if (!navigator.onLine) {
      console.log('Cannot sync: device is offline');
      return { success: 0, failed: 0 };
    }

    this.isSyncing = true;
    let successCount = 0;
    let failedCount = 0;

    try {
      const unsyncedTransactions = await offlineDB.getUnsyncedTransactions();
      
      if (unsyncedTransactions.length === 0) {
        console.log('No transactions to sync');
        return { success: 0, failed: 0 };
      }

      console.log(`Syncing ${unsyncedTransactions.length} transactions...`);

      for (const transaction of unsyncedTransactions) {
        try {
          await this.syncSingleTransaction(transaction);
          await offlineDB.markTransactionSynced(transaction.id);
          successCount++;
          console.log(`Synced transaction ${transaction.id}`);
        } catch (error) {
          console.error(`Failed to sync transaction ${transaction.id}:`, error);
          failedCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Synced ${successCount} transaction${successCount > 1 ? 's' : ''}`);
      }
      
      if (failedCount > 0) {
        toast.error(`Failed to sync ${failedCount} transaction${failedCount > 1 ? 's' : ''}`);
      }

    } catch (error) {
      console.error('Error during sync:', error);
      toast.error('Sync failed');
    } finally {
      this.isSyncing = false;
    }

    return { success: successCount, failed: failedCount };
  }

  private async syncSingleTransaction(transaction: OfflineTransaction): Promise<void> {
    // Insert the transaction into the database
    const { error } = await supabase
      .from('pos_transactions')
      .insert({
        id: transaction.id,
        store_id: transaction.storeId,
        cashier_id: transaction.cashierId,
        customer_id: transaction.customerId,
        subtotal: transaction.subtotal,
        discount: transaction.discount,
        total: transaction.total,
        payment_method: transaction.paymentMethod,
        notes: transaction.notes,
        items: transaction.items,
        created_at: transaction.timestamp,
      });

    if (error) {
      throw error;
    }

    // Update product stock for each item
    for (const item of transaction.items) {
      try {
        // Get current stock
        const { data: product, error: fetchError } = await supabase
          .from('products')
          .select('stock_quantity')
          .eq('id', item.productId)
          .single();

        if (fetchError) {
          console.error(`Error fetching product ${item.productId}:`, fetchError);
          continue;
        }

        // Update stock
        const newStock = (product.stock_quantity || 0) - item.quantity;
        const { error: updateError } = await supabase
          .from('products')
          .update({ stock_quantity: Math.max(0, newStock) })
          .eq('id', item.productId);

        if (updateError) {
          console.error(`Error updating stock for product ${item.productId}:`, updateError);
        }
      } catch (error) {
        console.error(`Error processing item ${item.productId}:`, error);
      }
    }
  }

  startAutoSync(intervalMs: number = 30000): void {
    if (this.syncInterval !== null) {
      console.log('Auto-sync already running');
      return;
    }

    console.log(`Starting auto-sync with interval ${intervalMs}ms`);
    
    // Sync immediately
    this.syncTransactions();

    // Then sync at intervals
    this.syncInterval = window.setInterval(() => {
      if (navigator.onLine) {
        this.syncTransactions();
      }
    }, intervalMs);

    // Sync when coming online
    window.addEventListener('online', this.handleOnline);
  }

  stopAutoSync(): void {
    if (this.syncInterval !== null) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('Auto-sync stopped');
    }
    window.removeEventListener('online', this.handleOnline);
  }

  private handleOnline = () => {
    console.log('Device came online, triggering sync...');
    toast.info('Connection restored, syncing data...');
    this.syncTransactions();
  };

  getIsSyncing(): boolean {
    return this.isSyncing;
  }
}

export const syncService = new SyncService();
