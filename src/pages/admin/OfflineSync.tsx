import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { ArrowLeft, RefreshCw, Database, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { offlineDB, OfflineTransaction } from "@/lib/offlineDB";
import { syncService } from "@/lib/syncService";
import { format } from "date-fns";

export default function OfflineSync() {
  const [transactions, setTransactions] = useState<OfflineTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const loadOfflineTransactions = async () => {
    setLoading(true);
    try {
      const unsyncedTxs = await offlineDB.getUnsyncedTransactions();
      setTransactions(unsyncedTxs);
      
      if (unsyncedTxs.length === 0) {
        toast.info('No offline transactions found');
      } else {
        toast.success(`Found ${unsyncedTxs.length} offline transaction(s)`);
      }
    } catch (error) {
      console.error('Error loading offline transactions:', error);
      toast.error('Failed to load offline transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOfflineTransactions();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncService.syncTransactions();
      
      if (result.success > 0 || result.failed > 0) {
        await loadOfflineTransactions();
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Failed to sync transactions');
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncSingle = async (txId: string) => {
    setSyncing(true);
    try {
      await syncService.syncTransactions();
      await loadOfflineTransactions();
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Failed to sync transaction');
    } finally {
      setSyncing(false);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear all offline transactions? This action cannot be undone.')) {
      return;
    }
    
    try {
      await offlineDB.clearAll();
      setTransactions([]);
      toast.success('All offline data cleared');
    } catch (error) {
      console.error('Error clearing offline data:', error);
      toast.error('Failed to clear offline data');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="max-w-screen-xl mx-auto px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin/orders">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Offline Transactions</h1>
              <p className="text-sm text-muted-foreground">
                View and sync transactions saved offline
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={loadOfflineTransactions}
              variant="outline"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              onClick={handleSync}
              disabled={syncing || transactions.length === 0}
            >
              <Database className={`h-4 w-4 mr-2 ${syncing ? 'animate-pulse' : ''}`} />
              Sync All
            </Button>
            <Button
              onClick={handleClearAll}
              variant="destructive"
              disabled={transactions.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Unsynced Transactions</span>
              <Badge variant="secondary">{transactions.length} items</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading offline transactions...
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No offline transactions found</p>
                <p className="text-sm mt-2">All transactions have been synced to the server</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transaction ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <>
                        <TableRow key={tx.id}>
                          <TableCell className="font-mono text-xs">
                            {tx.id.slice(0, 8)}...
                          </TableCell>
                          <TableCell>
                            {format(new Date(tx.timestamp), 'dd/MM/yyyy HH:mm')}
                          </TableCell>
                          <TableCell>
                            <div className="max-h-20 overflow-y-auto">
                              {tx.items.map((item: any, idx: number) => (
                                <div key={idx} className="text-xs text-muted-foreground">
                                  {item.name} x{item.quantity}
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(tx.total)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{tx.paymentMethod}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge variant={tx.synced ? "default" : tx.syncError ? "destructive" : "secondary"}>
                                {tx.synced ? 'Synced' : tx.syncError ? 'Failed' : 'Pending'}
                              </Badge>
                              {tx.syncAttempts && tx.syncAttempts > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  Attempts: {tx.syncAttempts}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {!tx.synced && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSyncSingle(tx.id)}
                                disabled={syncing}
                              >
                                <RefreshCw className={`h-3 w-3 mr-1 ${syncing ? 'animate-spin' : ''}`} />
                                Retry
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                        {tx.syncError && (
                          <TableRow key={`${tx.id}-error`}>
                            <TableCell colSpan={7} className="bg-destructive/10">
                              <div className="text-xs text-destructive">
                                <span className="font-semibold">Error: </span>
                                {tx.syncError}
                              </div>
                              {tx.lastSyncAttempt && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  Last attempt: {format(new Date(tx.lastSyncAttempt), 'dd/MM/yyyy HH:mm:ss')}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h3 className="font-semibold mb-2">How Offline Storage Works</h3>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Transactions are saved locally when internet connection is lost</li>
            <li>They automatically sync when connection is restored</li>
            <li>You can manually trigger sync using the "Sync All" button</li>
            <li>Synced transactions are removed from offline storage</li>
          </ul>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
