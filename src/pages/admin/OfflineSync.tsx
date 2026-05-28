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
import {
  ArrowLeft,
  RefreshCw,
  Database,
  Trash2,
  ShoppingCart,
  Package,
  BookOpen,
  Receipt,
  Wallet,
  Truck,
  ClipboardList,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { offlineDB, OfflineTransaction } from "@/lib/offlineDB";
import { syncService } from "@/lib/syncService";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type EntityKey =
  | "pos_transactions"
  | "orders"
  | "products"
  | "journal_entries"
  | "expenses"
  | "payment_receipts"
  | "supplier_payments"
  | "purchases";

interface EntitySection {
  key: EntityKey;
  title: string;
  description: string;
  icon: typeof Database;
  pendingCount: number;
  supportsQueue: boolean;
}

export default function OfflineSync() {
  const [transactions, setTransactions] = useState<OfflineTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeDialog, setActiveDialog] = useState<EntityKey | null>(null);

  const loadOfflineTransactions = async () => {
    setLoading(true);
    try {
      const unsyncedTxs = await offlineDB.getUnsyncedTransactions();
      setTransactions(unsyncedTxs);
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
    if (!confirm('Clear ALL offline cache + queued transactions? This cannot be undone.')) {
      return;
    }
    try {
      await offlineDB.clearAll();
      setTransactions([]);
      toast.success('Offline storage cleared');
    } catch (error) {
      console.error('Error clearing offline data:', error);
      toast.error('Failed to clear offline data');
    }
  };

  const sections: EntitySection[] = [
    {
      key: "pos_transactions",
      title: "POS Transactions",
      description: "Sales rung up while offline waiting to post to the server.",
      icon: ShoppingCart,
      pendingCount: transactions.length,
      supportsQueue: true,
    },
    {
      key: "orders",
      title: "Online Orders",
      description: "Online orders edited or accepted offline.",
      icon: ClipboardList,
      pendingCount: 0,
      supportsQueue: false,
    },
    {
      key: "products",
      title: "Products",
      description: "New products / variants created offline.",
      icon: Package,
      pendingCount: 0,
      supportsQueue: false,
    },
    {
      key: "journal_entries",
      title: "Journal Entries",
      description: "Manual journal entries created offline.",
      icon: BookOpen,
      pendingCount: 0,
      supportsQueue: false,
    },
    {
      key: "expenses",
      title: "Expenses",
      description: "Expenses recorded offline.",
      icon: Wallet,
      pendingCount: 0,
      supportsQueue: false,
    },
    {
      key: "payment_receipts",
      title: "Payment Receipts",
      description: "Customer payments collected offline.",
      icon: Receipt,
      pendingCount: 0,
      supportsQueue: false,
    },
    {
      key: "supplier_payments",
      title: "Supplier Payments",
      description: "Supplier payments recorded offline.",
      icon: Truck,
      pendingCount: 0,
      supportsQueue: false,
    },
    {
      key: "purchases",
      title: "Purchases / Stock Adjustments",
      description: "Purchases or stock adjustments saved offline.",
      icon: Database,
      pendingCount: 0,
      supportsQueue: false,
    },
  ];

  const totalPending = sections.reduce((sum, s) => sum + s.pendingCount, 0);

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
              <h1 className="text-2xl font-bold">Pending Sync</h1>
              <p className="text-sm text-muted-foreground">
                {totalPending > 0
                  ? `${totalPending} item${totalPending === 1 ? '' : 's'} waiting to upload`
                  : 'Everything is in sync with the server'}
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
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Cache
            </Button>
          </div>
        </div>

        {/* Entity grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {sections.map((s) => {
            const Icon = s.icon;
            const hasPending = s.pendingCount > 0;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setActiveDialog(s.key)}
                className="text-left rounded-lg border bg-card p-4 hover:border-primary hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-md ${hasPending ? 'bg-amber-500/10 text-amber-600' : 'bg-muted text-muted-foreground'}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-semibold flex items-center gap-2">
                        {s.title}
                        {!s.supportsQueue && (
                          <Badge variant="outline" className="text-[10px]">read-only</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {s.description}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  {hasPending ? (
                    <Badge variant="secondary">{s.pendingCount} pending</Badge>
                  ) : (
                    <Badge variant="outline" className="text-green-600 border-green-600/40">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> All synced
                    </Badge>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* POS Transactions detail card (always rendered for compatibility) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> POS Transactions</span>
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
              <Table fixedScroll>
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
            )}
          </CardContent>
        </Card>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h3 className="font-semibold mb-2">How offline sync works</h3>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>POS sales rung up offline are queued in this device's local storage and uploaded automatically when the internet returns.</li>
            <li>Other modules (orders, products, journals, expenses, payments, supplier payments, purchases) currently require an active connection to write — those tiles are placeholders for the upcoming offline write queue.</li>
            <li>Click any tile to see what is pending for that module.</li>
            <li>"Sync All" forces an immediate sync attempt for everything currently queued.</li>
          </ul>
        </div>
      </main>

      {/* Per-entity drill-in dialog */}
      <Dialog open={activeDialog !== null} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent className="max-w-2xl">
          {(() => {
            const section = sections.find((s) => s.key === activeDialog);
            if (!section) return null;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <section.icon className="h-5 w-5" />
                    {section.title}
                  </DialogTitle>
                  <DialogDescription>{section.description}</DialogDescription>
                </DialogHeader>

                {section.key === 'pos_transactions' ? (
                  transactions.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-600" />
                      No pending POS transactions.
                    </div>
                  ) : (
                    <div className="max-h-[60vh] overflow-y-auto space-y-2">
                      {transactions.map((tx) => (
                        <div key={tx.id} className="border rounded-md p-3 text-sm">
                          <div className="flex items-center justify-between">
                            <div className="font-mono text-xs text-muted-foreground">{tx.id.slice(0, 8)}…</div>
                            <div className="font-semibold">{formatCurrency(tx.total)}</div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(tx.timestamp), 'dd/MM/yyyy HH:mm')} · {tx.items.length} item(s) · {tx.paymentMethod}
                          </div>
                          {tx.syncError && (
                            <div className="mt-2 text-xs text-destructive">⚠ {tx.syncError}</div>
                          )}
                          <div className="mt-2 flex justify-end">
                            <Button size="sm" variant="outline" disabled={syncing} onClick={() => handleSyncSingle(tx.id)}>
                              <RefreshCw className={`h-3 w-3 mr-1 ${syncing ? 'animate-spin' : ''}`} /> Retry
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="py-6 space-y-3 text-sm">
                    <div className="flex items-center justify-center gap-2 text-green-600">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-medium">Nothing pending for this module</span>
                    </div>
                    <p className="text-muted-foreground text-center">
                      This module currently writes directly to the server. Anything you create here
                      while offline will fail at the time of saving instead of being queued. A
                      generic offline write‑queue for {section.title.toLowerCase()} is on the roadmap —
                      once shipped, pending items will appear in this dialog with retry/cancel actions.
                    </p>
                  </div>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
