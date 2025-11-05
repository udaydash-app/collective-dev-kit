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
    // Calculate COGS for the transaction using FIFO
    let totalCogs = 0;
    const cogsDetails: any[] = [];

    for (const item of transaction.items) {
      try {
        const variantId = item.variantId || item.id; // Handle both field names
        const productId = item.productId;
        
        // Use FIFO to deduct stock and calculate COGS
        const { data: cogsLayers, error: cogsError } = await supabase
          .rpc('deduct_stock_fifo', {
            p_product_id: productId,
            p_variant_id: variantId || null,
            p_quantity: item.quantity
          });

        if (cogsError) {
          console.warn(`COGS calculation failed for item ${productId}:`, cogsError);
          // Continue without COGS if calculation fails
        } else if (cogsLayers && cogsLayers.length > 0) {
          const itemCogs = cogsLayers.reduce((sum: number, layer: any) => sum + parseFloat(layer.total_cogs || 0), 0);
          totalCogs += itemCogs;
          cogsDetails.push({
            productId,
            variantId,
            quantity: item.quantity,
            cogs: itemCogs,
            layers: cogsLayers
          });
        }

        // Update stock for variant or product
        if (variantId) {
          const { data: variant } = await supabase
            .from('product_variants')
            .select('stock_quantity')
            .eq('id', variantId)
            .single();

          if (variant) {
            const newStock = Math.max(0, (variant.stock_quantity || 0) - item.quantity);
            await supabase
              .from('product_variants')
              .update({ stock_quantity: newStock })
              .eq('id', variantId);
          }
        } else {
          const { data: product } = await supabase
            .from('products')
            .select('stock_quantity')
            .eq('id', productId)
            .single();

          if (product) {
            const newStock = Math.max(0, (product.stock_quantity || 0) - item.quantity);
            await supabase
              .from('products')
              .update({ stock_quantity: newStock })
              .eq('id', productId);
          }
        }
      } catch (error) {
        console.error(`Error processing item:`, error);
      }
    }

    // Insert the transaction with COGS metadata
    const { error } = await supabase
      .from('pos_transactions')
      .insert({
        id: transaction.id,
        store_id: transaction.storeId,
        cashier_id: transaction.cashierId,
        customer_id: transaction.customerId,
        subtotal: transaction.subtotal,
        tax: 0, // Default tax to 0 if not provided
        discount: transaction.discount,
        total: transaction.total,
        payment_method: transaction.paymentMethod,
        notes: transaction.notes,
        items: transaction.items,
        created_at: transaction.timestamp,
        metadata: {
          total_cogs: totalCogs,
          cogs_details: cogsDetails,
          synced_from_offline: true
        }
      });

    if (error) {
      throw error;
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
