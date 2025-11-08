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
          console.log(`✅ Synced transaction ${transaction.id}`);
        } catch (error: any) {
          console.error(`❌ Failed to sync transaction ${transaction.id}:`, error);
          console.error('Error details:', {
            message: error?.message,
            details: error?.details,
            hint: error?.hint,
            code: error?.code,
            transaction: transaction
          });
          failedCount++;
          
          // Store error details in transaction
          const errorMessage = error?.message || 'Unknown error';
          const errorDetails = error?.details || error?.hint || '';
          await offlineDB.updateTransactionError(
            transaction.id, 
            `${errorMessage}${errorDetails ? ': ' + errorDetails : ''}`,
            (transaction.syncAttempts || 0) + 1
          );
          
          // Show detailed error to user
          toast.error(`Sync failed: ${errorMessage}`, {
            description: errorDetails
          });
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
    console.log('🔄 Syncing transaction:', {
      id: transaction.id,
      storeId: transaction.storeId,
      cashierId: transaction.cashierId,
      itemCount: transaction.items.length,
      total: transaction.total
    });

    // Just insert the transaction - stock was already deducted during POS sale
    // The backend trigger will handle COGS calculation
    const { error } = await supabase
      .from('pos_transactions')
      .insert({
        id: transaction.id,
        store_id: transaction.storeId,
        cashier_id: transaction.cashierId,
        customer_id: transaction.customerId || null,
        subtotal: transaction.subtotal,
        tax: 0,
        discount: transaction.discount || 0,
        total: transaction.total,
        payment_method: transaction.paymentMethod,
        payment_details: [{ method: transaction.paymentMethod, amount: transaction.total }],
        notes: transaction.notes || '',
        items: transaction.items,
        amount_paid: transaction.total,
        created_at: transaction.timestamp
      });

    if (error) {
      console.error('❌ Database insert error:', error);
      throw error;
    }
    
    console.log('✅ Transaction synced successfully');
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
