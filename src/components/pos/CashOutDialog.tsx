import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign, AlertCircle, CreditCard, Smartphone, ShoppingBag, TrendingDown, BookOpen } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DayActivity {
  cashSales: number;
  creditSales: number;
  mobileMoneySales: number;
  totalSales: number;
  totalTransactions: number;
  purchases: number;
  cashPurchases: number;
  creditPurchases: number;
  mobileMoneyPurchases: number;
  expenses: number;
  cashExpenses: number;
  creditExpenses: number;
  mobileMoneyExpenses: number;
}

interface PaymentReceipts {
  cashPayments: number;
  mobileMoneyPayments: number;
  bankPayments: number;
  totalPayments: number;
}

interface JournalEntry {
  debit_amount: number;
  credit_amount: number;
  journal_entries: {
    reference: string;
    description: string;
    entry_date: string;
  };
}

interface CashOutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (closingCash: number, notes?: string) => Promise<void>;
  openingCash: number;
  expectedCash: number;
  expectedMobileMoney: number;
  dayActivity: DayActivity;
  totalOpeningCash?: number;
  paymentReceipts?: PaymentReceipts;
  journalEntries?: JournalEntry[];
  journalCashEffect?: number;
  mobileMoneyJournalEntries?: JournalEntry[];
  journalMobileMoneyEffect?: number;
}

export const CashOutDialog = ({ isOpen, onClose, onConfirm, openingCash, expectedCash, expectedMobileMoney, dayActivity, totalOpeningCash, paymentReceipts, journalEntries = [], journalCashEffect = 0, mobileMoneyJournalEntries = [], journalMobileMoneyEffect = 0 }: CashOutDialogProps) => {
  const [closingCash, setClosingCash] = useState('');
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const actualClosing = parseFloat(closingCash);
  const difference = !isNaN(actualClosing) ? actualClosing - expectedCash : 0;
  const hasDifference = !isNaN(actualClosing) && Math.abs(difference) > 0.01;

  const salesActivities = [
    { icon: DollarSign, label: 'Cash Sales', value: dayActivity.cashSales, color: 'text-green-600' },
    { icon: CreditCard, label: 'Credit Sales', value: dayActivity.creditSales, color: 'text-blue-600' },
    { icon: Smartphone, label: 'Mobile Money', value: dayActivity.mobileMoneySales, color: 'text-purple-600' },
  ];

  const purchaseActivities = [
    { icon: DollarSign, label: 'Cash', value: dayActivity.cashPurchases, color: 'text-green-600' },
    { icon: CreditCard, label: 'Credit', value: dayActivity.creditPurchases, color: 'text-blue-600' },
    { icon: Smartphone, label: 'Mobile Money', value: dayActivity.mobileMoneyPurchases, color: 'text-purple-600' },
  ];

  const expenseActivities = [
    { icon: DollarSign, label: 'Cash', value: dayActivity.cashExpenses, color: 'text-green-600' },
    { icon: CreditCard, label: 'Credit', value: dayActivity.creditExpenses, color: 'text-blue-600' },
    { icon: Smartphone, label: 'Mobile Money', value: dayActivity.mobileMoneyExpenses, color: 'text-purple-600' },
  ];

  const handleConfirm = async () => {
    const amount = parseFloat(closingCash);
    if (isNaN(amount) || amount < 0) {
      return;
    }

    setIsProcessing(true);
    try {
      await onConfirm(amount, notes || undefined);
      setClosingCash('');
      setNotes('');
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Cash Out - End Of Day Summary</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <div className="space-y-6">
            {/* Day Activity Summary */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Day's Sales Activity</h3>
              <div className="grid grid-cols-3 gap-3">
                {salesActivities.map((activity, index) => (
                  <div key={index} className="p-3 bg-accent rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <activity.icon className={`h-4 w-4 ${activity.color}`} />
                      <p className="text-xs text-muted-foreground">{activity.label}</p>
                    </div>
                    <p className="text-base font-bold">{formatCurrency(activity.value)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Total Sales Summary */}
            <div className="p-4 bg-primary/10 rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted-foreground">Total Sales</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {dayActivity.totalTransactions} transaction{dayActivity.totalTransactions !== 1 ? 's' : ''}
                  </p>
                </div>
                <p className="text-2xl font-bold text-primary">{formatCurrency(dayActivity.totalSales)}</p>
              </div>
            </div>

            <Separator />

            {/* Purchases Breakdown */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Day's Purchases by Payment Method</h3>
              <div className="grid grid-cols-3 gap-3">
                {purchaseActivities.map((activity, index) => (
                  <div key={index} className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <activity.icon className={`h-4 w-4 ${activity.color}`} />
                      <p className="text-xs text-muted-foreground">{activity.label}</p>
                    </div>
                    <p className="text-base font-bold">{formatCurrency(activity.value)}</p>
                  </div>
                ))}
              </div>
              <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-orange-600" />
                    <p className="text-sm font-medium">Total Purchases</p>
                  </div>
                  <p className="text-lg font-bold text-orange-600">{formatCurrency(dayActivity.purchases)}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Expenses Breakdown */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Day's Expenses by Payment Method</h3>
              <div className="grid grid-cols-3 gap-3">
                {expenseActivities.map((activity, index) => (
                  <div key={index} className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <activity.icon className={`h-4 w-4 ${activity.color}`} />
                      <p className="text-xs text-muted-foreground">{activity.label}</p>
                    </div>
                    <p className="text-base font-bold">{formatCurrency(activity.value)}</p>
                  </div>
                ))}
              </div>
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-600" />
                    <p className="text-sm font-medium">Total Expenses</p>
                  </div>
                  <p className="text-lg font-bold text-red-600">{formatCurrency(dayActivity.expenses)}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Manual Journal Entries Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b pb-2">
                <BookOpen className="h-5 w-5 text-indigo-600" />
                <h3 className="font-semibold text-sm">Manual Journal Entries (Cash Account)</h3>
              </div>
              {journalEntries.length > 0 ? (
                <>
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-medium">Cash Account Impact</p>
                      <p className={cn(
                        "text-lg font-bold",
                        journalCashEffect >= 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {formatCurrency(Math.abs(journalCashEffect))}
                        {journalCashEffect >= 0 ? ' (In)' : ' (Out)'}
                      </p>
                    </div>
                  </div>
                  <ScrollArea className="h-[100px]">
                    <div className="space-y-2 pr-4">
                      {journalEntries.map((entry, index) => {
                        const netEffect = parseFloat(entry.debit_amount?.toString() || '0') - parseFloat(entry.credit_amount?.toString() || '0');
                        return (
                          <div key={index} className="flex items-start justify-between text-sm border-l-2 border-indigo-200 pl-3 py-1">
                            <div className="flex-1">
                              <p className="font-medium text-foreground">{entry.journal_entries.reference}</p>
                              <p className="text-xs text-muted-foreground">{entry.journal_entries.description}</p>
                            </div>
                            <div className="flex flex-col items-end ml-2">
                              <p className={cn(
                                "font-semibold",
                                netEffect >= 0 ? "text-green-600" : "text-red-600"
                              )}>
                                {formatCurrency(Math.abs(netEffect))}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {netEffect >= 0 ? 'In' : 'Out'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </>
              ) : (
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">No cash journal entries today</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Mobile Money Journal Entries Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b pb-2">
                <BookOpen className="h-5 w-5 text-purple-600" />
                <h3 className="font-semibold text-sm">Manual Journal Entries (Mobile Money)</h3>
              </div>
              {mobileMoneyJournalEntries.length > 0 ? (
                <>
                  <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-medium">Mobile Money Account Impact</p>
                      <p className={cn(
                        "text-lg font-bold",
                        journalMobileMoneyEffect >= 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {formatCurrency(Math.abs(journalMobileMoneyEffect))}
                        {journalMobileMoneyEffect >= 0 ? ' (In)' : ' (Out)'}
                      </p>
                    </div>
                  </div>
                  <ScrollArea className="h-[100px]">
                    <div className="space-y-2 pr-4">
                      {mobileMoneyJournalEntries.map((entry, index) => {
                        const netEffect = parseFloat(entry.debit_amount?.toString() || '0') - parseFloat(entry.credit_amount?.toString() || '0');
                        return (
                          <div key={index} className="flex items-start justify-between text-sm border-l-2 border-purple-200 pl-3 py-1">
                            <div className="flex-1">
                              <p className="font-medium text-foreground">{entry.journal_entries.reference}</p>
                              <p className="text-xs text-muted-foreground">{entry.journal_entries.description}</p>
                            </div>
                            <div className="flex flex-col items-end ml-2">
                              <p className={cn(
                                "font-semibold",
                                netEffect >= 0 ? "text-green-600" : "text-red-600"
                              )}>
                                {formatCurrency(Math.abs(netEffect))}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {netEffect >= 0 ? 'In' : 'Out'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </>
              ) : (
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">No mobile money journal entries today</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Payment Received Section */}
            {paymentReceipts && paymentReceipts.totalPayments > 0 && (
              <>
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">Customer Payments Received (Not from Today's Sales)</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <p className="text-xs text-muted-foreground">Cash</p>
                      </div>
                      <p className="text-base font-bold">{formatCurrency(paymentReceipts.cashPayments)}</p>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Smartphone className="h-4 w-4 text-purple-600" />
                        <p className="text-xs text-muted-foreground">Mobile Money</p>
                      </div>
                      <p className="text-base font-bold">{formatCurrency(paymentReceipts.mobileMoneyPayments)}</p>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <CreditCard className="h-4 w-4 text-blue-600" />
                        <p className="text-xs text-muted-foreground">Bank</p>
                      </div>
                      <p className="text-base font-bold">{formatCurrency(paymentReceipts.bankPayments)}</p>
                    </div>
                  </div>
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-blue-600" />
                        <p className="text-sm font-medium">Total Payments Received</p>
                      </div>
                      <p className="text-lg font-bold text-blue-600">{formatCurrency(paymentReceipts.totalPayments)}</p>
                    </div>
                  </div>
                </div>

                <Separator />
              </>
            )}

            {/* Cash Management */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Cash Management</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-accent rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Total Opening Cash</p>
                  <p className="text-lg font-bold">{formatCurrency(totalOpeningCash ?? openingCash)}</p>
                </div>
                <div className="p-3 bg-primary/10 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Expected Cash</p>
                  <p className="text-lg font-bold text-primary">{formatCurrency(expectedCash)}</p>
                </div>
              </div>

              <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg mt-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-purple-600" />
                    <p className="text-sm font-medium">Expected Mobile Money</p>
                  </div>
                  <p className="text-lg font-bold text-purple-600">{formatCurrency(expectedMobileMoney)}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Mobile Sales + Payments - Purchases - Expenses - Supplier Payments + Journal Entries
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="closingCash">Actual Closing Cash Count</Label>
                <Input
                  id="closingCash"
                  type="number"
                  placeholder="0.00"
                  value={closingCash}
                  onChange={(e) => setClosingCash(e.target.value)}
                  step="0.01"
                  min="0"
                  autoFocus
                />
              </div>

              {hasDifference && (
                <div className={`p-4 rounded-lg ${difference > 0 ? 'bg-green-500/10' : 'bg-destructive/10'}`}>
                  <div className="flex items-start gap-2">
                    <AlertCircle className={`h-5 w-5 mt-0.5 ${difference > 0 ? 'text-green-600' : 'text-destructive'}`} />
                    <div className="flex-1">
                      <p className="font-semibold">
                        {difference > 0 ? 'Cash Over' : 'Cash Short'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Difference: <span className={`font-bold ${difference > 0 ? 'text-green-600' : 'text-destructive'}`}>
                          {difference > 0 ? '+' : ''}{formatCurrency(Math.abs(difference))}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any notes about cash discrepancies or issues..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="flex gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isProcessing || !closingCash || isNaN(parseFloat(closingCash)) || parseFloat(closingCash) < 0}
            className="flex-1"
          >
            {isProcessing ? 'Closing...' : 'End Of Day'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
