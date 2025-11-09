import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign, AlertCircle, CreditCard, Smartphone, ShoppingBag, TrendingDown, BookOpen, ChevronDown, ChevronUp, Receipt, Wallet, ArrowDownCircle, ArrowUpCircle, Package } from 'lucide-react';
import { formatCurrency, cn, formatDateTime } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent } from '@/components/ui/card';

interface Transaction {
  id: string;
  total: number;
  payment_method: string;
  created_at: string;
}

interface Purchase {
  id: string;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  purchased_at: string;
  supplier_name?: string;
}

interface Expense {
  id: string;
  amount: number;
  payment_method: string;
  description: string;
  created_at: string;
  category?: string;
}

interface PaymentReceipt {
  id: string;
  amount: number;
  payment_method: string;
  created_at: string;
  contact_name?: string;
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
  transactions?: Transaction[];
  purchases?: Purchase[];
  expenses?: Expense[];
  paymentReceipts?: PaymentReceipt[];
  journalEntries?: JournalEntry[];
  journalCashEffect?: number;
  mobileMoneyJournalEntries?: JournalEntry[];
  journalMobileMoneyEffect?: number;
}

export const CashOutDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  openingCash, 
  expectedCash, 
  expectedMobileMoney, 
  transactions = [],
  purchases = [],
  expenses = [],
  paymentReceipts = [],
  journalEntries = [], 
  journalCashEffect = 0, 
  mobileMoneyJournalEntries = [], 
  journalMobileMoneyEffect = 0 
}: CashOutDialogProps) => {
  const [closingCash, setClosingCash] = useState('');
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    sales: false,
    purchases: false,
    expenses: false,
    receipts: false,
    journals: false
  });

  const actualClosing = parseFloat(closingCash);
  const difference = !isNaN(actualClosing) ? actualClosing - expectedCash : 0;
  const hasDifference = !isNaN(actualClosing) && Math.abs(difference) > 0.01;

  // Calculate sales by payment method
  const cashSales = transactions.filter(t => t.payment_method === 'cash').reduce((sum, t) => sum + t.total, 0);
  const creditSales = transactions.filter(t => t.payment_method === 'credit').reduce((sum, t) => sum + t.total, 0);
  const mobileMoneySales = transactions.filter(t => t.payment_method === 'mobile_money').reduce((sum, t) => sum + t.total, 0);
  const totalSales = cashSales + creditSales + mobileMoneySales;

  // Calculate purchases by payment method
  const cashPurchases = purchases.filter(p => p.payment_status === 'paid' && p.payment_method === 'cash').reduce((sum, p) => sum + p.total_amount, 0);
  const creditPurchases = purchases.filter(p => p.payment_status === 'pending' || p.payment_status === 'partial' || p.payment_method === 'credit').reduce((sum, p) => sum + p.total_amount, 0);
  const mobileMoneyPurchases = purchases.filter(p => p.payment_status === 'paid' && p.payment_method === 'mobile_money').reduce((sum, p) => sum + p.total_amount, 0);
  const totalPurchases = cashPurchases + creditPurchases + mobileMoneyPurchases;

  // Calculate expenses by payment method
  const cashExpenses = expenses.filter(e => e.payment_method === 'cash').reduce((sum, e) => sum + e.amount, 0);
  const creditExpenses = expenses.filter(e => e.payment_method === 'credit').reduce((sum, e) => sum + e.amount, 0);
  const mobileMoneyExpenses = expenses.filter(e => e.payment_method === 'mobile_money').reduce((sum, e) => sum + e.amount, 0);
  const totalExpenses = cashExpenses + creditExpenses + mobileMoneyExpenses;

  // Calculate payment receipts by method
  const cashPayments = paymentReceipts.filter(p => p.payment_method === 'cash').reduce((sum, p) => sum + p.amount, 0);
  const mobileMoneyPayments = paymentReceipts.filter(p => p.payment_method === 'mobile_money').reduce((sum, p) => sum + p.amount, 0);
  const totalPayments = cashPayments + mobileMoneyPayments;

  // Calculate journal effects
  const journalCashIn = journalEntries.filter(e => (e.debit_amount - e.credit_amount) > 0).reduce((sum, e) => sum + (e.debit_amount - e.credit_amount), 0);
  const journalCashOut = Math.abs(journalEntries.filter(e => (e.debit_amount - e.credit_amount) < 0).reduce((sum, e) => sum + (e.debit_amount - e.credit_amount), 0));
  
  const journalMobileMoneyIn = mobileMoneyJournalEntries.filter(e => (e.debit_amount - e.credit_amount) > 0).reduce((sum, e) => sum + (e.debit_amount - e.credit_amount), 0);
  const journalMobileMoneyOut = Math.abs(mobileMoneyJournalEntries.filter(e => (e.debit_amount - e.credit_amount) < 0).reduce((sum, e) => sum + (e.debit_amount - e.credit_amount), 0));

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

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
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-primary/5 to-primary/10">
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Receipt className="h-6 w-6 text-primary" />
            </div>
            End of Day Summary
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)]">
          <div className="p-6 space-y-6">
            {/* Opening Balance */}
            <Card className="border-2 border-primary/20 bg-gradient-to-br from-background to-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-full">
                      <Wallet className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Opening Balance</p>
                      <p className="text-xs text-muted-foreground/60">Cash in register at start</p>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(openingCash)}</p>
                </div>
              </CardContent>
            </Card>

            {/* Sales Section */}
            <div className="space-y-3">
              <Collapsible open={openSections.sales} onOpenChange={() => toggleSection('sales')}>
                <Card className="border-l-4 border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <CardContent className="p-4">
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center justify-between hover:opacity-80 transition-opacity">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-emerald-500/10 rounded-lg">
                            <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div className="text-left">
                            <h3 className="font-semibold">Sales Revenue</h3>
                            <p className="text-xs text-muted-foreground">{transactions.length} transaction{transactions.length !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalSales)}</p>
                          {openSections.sales ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent className="pt-4 space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-background/80 rounded-lg border">
                          <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="h-4 w-4 text-emerald-600" />
                            <p className="text-xs font-medium text-muted-foreground">Cash</p>
                          </div>
                          <p className="text-lg font-bold">{formatCurrency(cashSales)}</p>
                          <p className="text-xs text-muted-foreground">{transactions.filter(t => t.payment_method === 'cash').length} txn</p>
                        </div>
                        <div className="p-3 bg-background/80 rounded-lg border">
                          <div className="flex items-center gap-2 mb-2">
                            <CreditCard className="h-4 w-4 text-blue-600" />
                            <p className="text-xs font-medium text-muted-foreground">Credit</p>
                          </div>
                          <p className="text-lg font-bold">{formatCurrency(creditSales)}</p>
                          <p className="text-xs text-muted-foreground">{transactions.filter(t => t.payment_method === 'credit').length} txn</p>
                        </div>
                        <div className="p-3 bg-background/80 rounded-lg border">
                          <div className="flex items-center gap-2 mb-2">
                            <Smartphone className="h-4 w-4 text-purple-600" />
                            <p className="text-xs font-medium text-muted-foreground">Mobile Money</p>
                          </div>
                          <p className="text-lg font-bold">{formatCurrency(mobileMoneySales)}</p>
                          <p className="text-xs text-muted-foreground">{transactions.filter(t => t.payment_method === 'mobile_money').length} txn</p>
                        </div>
                      </div>
                      
                      {transactions.length > 0 && (
                        <div className="mt-3 max-h-[200px] overflow-y-auto">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Transaction Details</p>
                          <div className="space-y-1">
                            {transactions.map((txn) => (
                              <div key={txn.id} className="flex items-center justify-between text-xs p-2 bg-background/50 rounded border">
                                <div className="flex items-center gap-2">
                                  {txn.payment_method === 'cash' && <DollarSign className="h-3 w-3 text-emerald-600" />}
                                  {txn.payment_method === 'credit' && <CreditCard className="h-3 w-3 text-blue-600" />}
                                  {txn.payment_method === 'mobile_money' && <Smartphone className="h-3 w-3 text-purple-600" />}
                                  <span className="text-muted-foreground">{formatDateTime(txn.created_at)}</span>
                                </div>
                                <span className="font-semibold">{formatCurrency(txn.total)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CollapsibleContent>
                  </CardContent>
                </Card>
              </Collapsible>
            </div>

            {/* Purchases Section */}
            {purchases.length > 0 && (
              <div className="space-y-3">
                <Collapsible open={openSections.purchases} onOpenChange={() => toggleSection('purchases')}>
                  <Card className="border-l-4 border-l-orange-500 bg-orange-50/50 dark:bg-orange-950/20">
                    <CardContent className="p-4">
                      <CollapsibleTrigger asChild>
                        <button className="w-full flex items-center justify-between hover:opacity-80 transition-opacity">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-500/10 rounded-lg">
                              <ShoppingBag className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                            </div>
                            <div className="text-left">
                              <h3 className="font-semibold">Purchases</h3>
                              <p className="text-xs text-muted-foreground">{purchases.length} purchase{purchases.length !== 1 ? 's' : ''}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatCurrency(totalPurchases)}</p>
                            {openSections.purchases ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                          </div>
                        </button>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent className="pt-4 space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                          <div className="p-3 bg-background/80 rounded-lg border">
                            <div className="flex items-center gap-2 mb-2">
                              <DollarSign className="h-4 w-4 text-orange-600" />
                              <p className="text-xs font-medium text-muted-foreground">Cash</p>
                            </div>
                            <p className="text-lg font-bold">{formatCurrency(cashPurchases)}</p>
                            <p className="text-xs text-muted-foreground">{purchases.filter(p => p.payment_status === 'paid' && p.payment_method === 'cash').length} purch</p>
                          </div>
                          <div className="p-3 bg-background/80 rounded-lg border">
                            <div className="flex items-center gap-2 mb-2">
                              <CreditCard className="h-4 w-4 text-blue-600" />
                              <p className="text-xs font-medium text-muted-foreground">Credit</p>
                            </div>
                            <p className="text-lg font-bold">{formatCurrency(creditPurchases)}</p>
                            <p className="text-xs text-muted-foreground">{purchases.filter(p => p.payment_status === 'pending' || p.payment_status === 'partial' || p.payment_method === 'credit').length} purch</p>
                          </div>
                          <div className="p-3 bg-background/80 rounded-lg border">
                            <div className="flex items-center gap-2 mb-2">
                              <Smartphone className="h-4 w-4 text-purple-600" />
                              <p className="text-xs font-medium text-muted-foreground">Mobile Money</p>
                            </div>
                            <p className="text-lg font-bold">{formatCurrency(mobileMoneyPurchases)}</p>
                            <p className="text-xs text-muted-foreground">{purchases.filter(p => p.payment_status === 'paid' && p.payment_method === 'mobile_money').length} purch</p>
                          </div>
                        </div>
                        
                        <div className="mt-3 max-h-[200px] overflow-y-auto">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Purchase Details</p>
                          <div className="space-y-1">
                            {purchases.map((purch) => (
                              <div key={purch.id} className="flex items-center justify-between text-xs p-2 bg-background/50 rounded border">
                                <div className="flex items-center gap-2">
                                  {purch.payment_method === 'cash' && <DollarSign className="h-3 w-3 text-orange-600" />}
                                  {purch.payment_method === 'credit' && <CreditCard className="h-3 w-3 text-blue-600" />}
                                  {purch.payment_method === 'mobile_money' && <Smartphone className="h-3 w-3 text-purple-600" />}
                                  <span className="text-muted-foreground">{formatDateTime(purch.purchased_at)}</span>
                                  {purch.supplier_name && <span className="text-muted-foreground">• {purch.supplier_name}</span>}
                                </div>
                                <span className="font-semibold">{formatCurrency(purch.total_amount)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </CardContent>
                  </Card>
                </Collapsible>
              </div>
            )}

            {/* Expenses Section */}
            {expenses.length > 0 && (
              <div className="space-y-3">
                <Collapsible open={openSections.expenses} onOpenChange={() => toggleSection('expenses')}>
                  <Card className="border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-950/20">
                    <CardContent className="p-4">
                      <CollapsibleTrigger asChild>
                        <button className="w-full flex items-center justify-between hover:opacity-80 transition-opacity">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-500/10 rounded-lg">
                              <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                            </div>
                            <div className="text-left">
                              <h3 className="font-semibold">Expenses</h3>
                              <p className="text-xs text-muted-foreground">{expenses.length} expense{expenses.length !== 1 ? 's' : ''}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(totalExpenses)}</p>
                            {openSections.expenses ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                          </div>
                        </button>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent className="pt-4 space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                          <div className="p-3 bg-background/80 rounded-lg border">
                            <div className="flex items-center gap-2 mb-2">
                              <DollarSign className="h-4 w-4 text-red-600" />
                              <p className="text-xs font-medium text-muted-foreground">Cash</p>
                            </div>
                            <p className="text-lg font-bold">{formatCurrency(cashExpenses)}</p>
                            <p className="text-xs text-muted-foreground">{expenses.filter(e => e.payment_method === 'cash').length} exp</p>
                          </div>
                          <div className="p-3 bg-background/80 rounded-lg border">
                            <div className="flex items-center gap-2 mb-2">
                              <CreditCard className="h-4 w-4 text-blue-600" />
                              <p className="text-xs font-medium text-muted-foreground">Credit</p>
                            </div>
                            <p className="text-lg font-bold">{formatCurrency(creditExpenses)}</p>
                            <p className="text-xs text-muted-foreground">{expenses.filter(e => e.payment_method === 'credit').length} exp</p>
                          </div>
                          <div className="p-3 bg-background/80 rounded-lg border">
                            <div className="flex items-center gap-2 mb-2">
                              <Smartphone className="h-4 w-4 text-purple-600" />
                              <p className="text-xs font-medium text-muted-foreground">Mobile Money</p>
                            </div>
                            <p className="text-lg font-bold">{formatCurrency(mobileMoneyExpenses)}</p>
                            <p className="text-xs text-muted-foreground">{expenses.filter(e => e.payment_method === 'mobile_money').length} exp</p>
                          </div>
                        </div>
                        
                        <div className="mt-3 max-h-[200px] overflow-y-auto">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Expense Details</p>
                          <div className="space-y-1">
                            {expenses.map((exp) => (
                              <div key={exp.id} className="flex items-center justify-between text-xs p-2 bg-background/50 rounded border">
                                <div className="flex items-center gap-2 flex-1">
                                  {exp.payment_method === 'cash' && <DollarSign className="h-3 w-3 text-red-600" />}
                                  {exp.payment_method === 'credit' && <CreditCard className="h-3 w-3 text-blue-600" />}
                                  {exp.payment_method === 'mobile_money' && <Smartphone className="h-3 w-3 text-purple-600" />}
                                  <div className="flex-1">
                                    <span className="text-foreground">{exp.description}</span>
                                    <span className="text-muted-foreground ml-2">• {formatDateTime(exp.created_at)}</span>
                                  </div>
                                </div>
                                <span className="font-semibold">{formatCurrency(exp.amount)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </CardContent>
                  </Card>
                </Collapsible>
              </div>
            )}

            {/* Payment Receipts Section */}
            {paymentReceipts.length > 0 && (
              <div className="space-y-3">
                <Collapsible open={openSections.receipts} onOpenChange={() => toggleSection('receipts')}>
                  <Card className="border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20">
                    <CardContent className="p-4">
                      <CollapsibleTrigger asChild>
                        <button className="w-full flex items-center justify-between hover:opacity-80 transition-opacity">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/10 rounded-lg">
                              <ArrowDownCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="text-left">
                              <h3 className="font-semibold">Payment Receipts</h3>
                              <p className="text-xs text-muted-foreground">Customer payments received</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(totalPayments)}</p>
                            {openSections.receipts ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                          </div>
                        </button>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent className="pt-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-background/80 rounded-lg border">
                            <div className="flex items-center gap-2 mb-2">
                              <DollarSign className="h-4 w-4 text-blue-600" />
                              <p className="text-xs font-medium text-muted-foreground">Cash</p>
                            </div>
                            <p className="text-lg font-bold">{formatCurrency(cashPayments)}</p>
                          </div>
                          <div className="p-3 bg-background/80 rounded-lg border">
                            <div className="flex items-center gap-2 mb-2">
                              <Smartphone className="h-4 w-4 text-purple-600" />
                              <p className="text-xs font-medium text-muted-foreground">Mobile Money</p>
                            </div>
                            <p className="text-lg font-bold">{formatCurrency(mobileMoneyPayments)}</p>
                          </div>
                        </div>
                        
                        <div className="mt-3 max-h-[200px] overflow-y-auto">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Receipt Details</p>
                          <div className="space-y-1">
                            {paymentReceipts.map((receipt) => (
                              <div key={receipt.id} className="flex items-center justify-between text-xs p-2 bg-background/50 rounded border">
                                <div className="flex items-center gap-2">
                                  {receipt.payment_method === 'cash' && <DollarSign className="h-3 w-3 text-blue-600" />}
                                  {receipt.payment_method === 'mobile_money' && <Smartphone className="h-3 w-3 text-purple-600" />}
                                  <span className="text-muted-foreground">{formatDateTime(receipt.created_at)}</span>
                                  {receipt.contact_name && <span className="text-muted-foreground">• {receipt.contact_name}</span>}
                                </div>
                                <span className="font-semibold">{formatCurrency(receipt.amount)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </CardContent>
                  </Card>
                </Collapsible>
              </div>
            )}

            {/* Manual Journal Entries */}
            {(journalEntries.length > 0 || mobileMoneyJournalEntries.length > 0) && (
              <div className="space-y-3">
                <Collapsible open={openSections.journals} onOpenChange={() => toggleSection('journals')}>
                  <Card className="border-l-4 border-l-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20">
                    <CardContent className="p-4">
                      <CollapsibleTrigger asChild>
                        <button className="w-full flex items-center justify-between hover:opacity-80 transition-opacity">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/10 rounded-lg">
                              <BookOpen className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div className="text-left">
                              <h3 className="font-semibold">Manual Journal Entries</h3>
                              <p className="text-xs text-muted-foreground">Fund transfers and adjustments</p>
                            </div>
                          </div>
                          {openSections.journals ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </button>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent className="pt-4 space-y-4">
                        {journalEntries.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-3 p-2 bg-background/80 rounded-lg border">
                              <p className="text-sm font-medium">Cash Account</p>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p className="text-xs text-emerald-600 dark:text-emerald-400">In: {formatCurrency(journalCashIn)}</p>
                                  <p className="text-xs text-red-600 dark:text-red-400">Out: {formatCurrency(journalCashOut)}</p>
                                </div>
                                <p className={cn("text-lg font-bold", journalCashEffect >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                                  {journalCashEffect >= 0 ? '+' : ''}{formatCurrency(Math.abs(journalCashEffect))}
                                </p>
                              </div>
                            </div>
                            <div className="max-h-[150px] overflow-y-auto space-y-1">
                              {journalEntries.map((entry, index) => {
                                const netEffect = entry.debit_amount - entry.credit_amount;
                                return (
                                  <div key={index} className="flex items-center justify-between text-xs p-2 bg-background/50 rounded border-l-2 border-l-indigo-200">
                                    <div className="flex items-center gap-2 flex-1">
                                      {netEffect >= 0 ? <ArrowDownCircle className="h-3 w-3 text-emerald-600" /> : <ArrowUpCircle className="h-3 w-3 text-red-600" />}
                                      <div>
                                        <p className="font-medium">{entry.journal_entries.reference}</p>
                                        <p className="text-muted-foreground">{entry.journal_entries.description}</p>
                                      </div>
                                    </div>
                                    <span className={cn("font-semibold", netEffect >= 0 ? "text-emerald-600" : "text-red-600")}>
                                      {netEffect >= 0 ? '+' : ''}{formatCurrency(Math.abs(netEffect))}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        
                        {mobileMoneyJournalEntries.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-3 p-2 bg-background/80 rounded-lg border">
                              <p className="text-sm font-medium">Mobile Money Account</p>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p className="text-xs text-emerald-600 dark:text-emerald-400">In: {formatCurrency(journalMobileMoneyIn)}</p>
                                  <p className="text-xs text-red-600 dark:text-red-400">Out: {formatCurrency(journalMobileMoneyOut)}</p>
                                </div>
                                <p className={cn("text-lg font-bold", journalMobileMoneyEffect >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                                  {journalMobileMoneyEffect >= 0 ? '+' : ''}{formatCurrency(Math.abs(journalMobileMoneyEffect))}
                                </p>
                              </div>
                            </div>
                            <div className="max-h-[150px] overflow-y-auto space-y-1">
                              {mobileMoneyJournalEntries.map((entry, index) => {
                                const netEffect = entry.debit_amount - entry.credit_amount;
                                return (
                                  <div key={index} className="flex items-center justify-between text-xs p-2 bg-background/50 rounded border-l-2 border-l-purple-200">
                                    <div className="flex items-center gap-2 flex-1">
                                      {netEffect >= 0 ? <ArrowDownCircle className="h-3 w-3 text-emerald-600" /> : <ArrowUpCircle className="h-3 w-3 text-red-600" />}
                                      <div>
                                        <p className="font-medium">{entry.journal_entries.reference}</p>
                                        <p className="text-muted-foreground">{entry.journal_entries.description}</p>
                                      </div>
                                    </div>
                                    <span className={cn("font-semibold", netEffect >= 0 ? "text-emerald-600" : "text-red-600")}>
                                      {netEffect >= 0 ? '+' : ''}{formatCurrency(Math.abs(netEffect))}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </CollapsibleContent>
                    </CardContent>
                  </Card>
                </Collapsible>
              </div>
            )}

            <Separator className="my-6" />

            {/* Expected Cash & Mobile Money */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-50/50 to-emerald-100/30 dark:from-emerald-950/20 dark:to-emerald-900/20">
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-emerald-600" />
                      <p className="text-sm font-medium">Expected Cash</p>
                    </div>
                    <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(expectedCash)}</p>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p>= Opening ({formatCurrency(openingCash)})</p>
                      <p>+ Sales ({formatCurrency(cashSales)})</p>
                      {cashPayments > 0 && <p>+ Receipts ({formatCurrency(cashPayments)})</p>}
                      {cashPurchases > 0 && <p>- Purchases ({formatCurrency(cashPurchases)})</p>}
                      {cashExpenses > 0 && <p>- Expenses ({formatCurrency(cashExpenses)})</p>}
                      {journalCashEffect !== 0 && <p>{journalCashEffect >= 0 ? '+' : '-'} Journals ({formatCurrency(Math.abs(journalCashEffect))})</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-purple-500/30 bg-gradient-to-br from-purple-50/50 to-purple-100/30 dark:from-purple-950/20 dark:to-purple-900/20">
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-5 w-5 text-purple-600" />
                      <p className="text-sm font-medium">Expected Mobile Money</p>
                    </div>
                    <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{formatCurrency(expectedMobileMoney)}</p>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p>= Sales ({formatCurrency(mobileMoneySales)})</p>
                      {mobileMoneyPayments > 0 && <p>+ Receipts ({formatCurrency(mobileMoneyPayments)})</p>}
                      {mobileMoneyPurchases > 0 && <p>- Purchases ({formatCurrency(mobileMoneyPurchases)})</p>}
                      {mobileMoneyExpenses > 0 && <p>- Expenses ({formatCurrency(mobileMoneyExpenses)})</p>}
                      {journalMobileMoneyEffect !== 0 && <p>{journalMobileMoneyEffect >= 0 ? '+' : '-'} Journals ({formatCurrency(Math.abs(journalMobileMoneyEffect))})</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Actual Closing Cash Input */}
            <Card className="border-2 border-primary/50">
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="closingCash" className="text-base font-semibold">Actual Closing Cash Count</Label>
                  <Input
                    id="closingCash"
                    type="number"
                    placeholder="Enter physical cash in register"
                    value={closingCash}
                    onChange={(e) => setClosingCash(e.target.value)}
                    step="0.01"
                    min="0"
                    autoFocus
                    className="text-lg h-12"
                  />
                </div>

                {hasDifference && (
                  <Card className={cn(
                    "border-2",
                    difference > 0 ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/50" : "bg-red-50/50 dark:bg-red-950/20 border-red-500/50"
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className={cn("h-6 w-6 mt-0.5", difference > 0 ? "text-emerald-600" : "text-red-600")} />
                        <div className="flex-1">
                          <p className="font-semibold text-lg">
                            {difference > 0 ? '💰 Cash Over' : '⚠️ Cash Short'}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Difference: <span className={cn("font-bold text-base", difference > 0 ? "text-emerald-600" : "text-red-600")}>
                              {difference > 0 ? '+' : ''}{formatCurrency(Math.abs(difference))}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {difference > 0 
                              ? "The physical cash in the register is more than expected. This will be recorded as a cash overage."
                              : "The physical cash in the register is less than expected. Please verify the count and provide notes below."}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-sm font-medium">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add any notes about discrepancies, issues, or observations..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        <div className="flex gap-3 p-6 border-t bg-muted/30">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
            className="flex-1 h-12"
            size="lg"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isProcessing || !closingCash || isNaN(parseFloat(closingCash)) || parseFloat(closingCash) < 0}
            className="flex-1 h-12"
            size="lg"
          >
            {isProcessing ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                Closing Day...
              </>
            ) : (
              <>
                <Receipt className="mr-2 h-5 w-5" />
                End Of Day
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
