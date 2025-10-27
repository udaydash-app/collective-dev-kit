import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { FileText, DollarSign, CreditCard, Smartphone, ShoppingBag, TrendingDown, TrendingUp, Printer } from 'lucide-react';
import { format } from 'date-fns';

export default function CloseDayReport() {
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showReport, setShowReport] = useState(false);

  const { data: stores } = useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const { data } = await supabase
        .from('stores')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
  });

  const { data: reportData, isLoading, refetch } = useQuery({
    queryKey: ['close-day-report', selectedStoreId, startDate, endDate],
    queryFn: async () => {
      if (!selectedStoreId || !startDate || !endDate) return null;

      // Fetch POS transactions
      const { data: transactions } = await supabase
        .from('pos_transactions')
        .select('total, payment_method, created_at')
        .eq('store_id', selectedStoreId)
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`)
        .order('created_at', { ascending: false });

      // Fetch purchases
      const { data: purchases } = await supabase
        .from('purchases')
        .select('total_amount, payment_method, purchased_at')
        .eq('store_id', selectedStoreId)
        .gte('purchased_at', `${startDate}T00:00:00`)
        .lte('purchased_at', `${endDate}T23:59:59`)
        .order('purchased_at', { ascending: false });

      // Fetch expenses
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount, payment_method, expense_date')
        .eq('store_id', selectedStoreId)
        .gte('expense_date', startDate)
        .lte('expense_date', endDate)
        .order('expense_date', { ascending: false });

      // Fetch cash sessions with cashier details
      const { data: cashSessions } = await supabase
        .from('cash_sessions')
        .select(`
          *,
          profiles:cashier_id (
            full_name
          )
        `)
        .eq('store_id', selectedStoreId)
        .gte('opened_at', `${startDate}T00:00:00`)
        .lte('opened_at', `${endDate}T23:59:59`)
        .order('opened_at', { ascending: false });

      // Calculate expected cash for each session
      const sessionsWithCalculations = await Promise.all(
        (cashSessions || []).map(async (session) => {
          const { data: sessionTransactions } = await supabase
            .from('pos_transactions')
            .select('total, payment_method')
            .eq('cashier_id', session.cashier_id)
            .eq('store_id', session.store_id)
            .gte('created_at', session.opened_at)
            .lte('created_at', session.closed_at || `${endDate}T23:59:59`);

          const cashSales = sessionTransactions
            ?.filter(t => t.payment_method === 'cash')
            .reduce((sum, t) => sum + parseFloat(t.total.toString()), 0) || 0;

          const openingCash = parseFloat(session.opening_cash?.toString() || '0');
          const calculatedExpectedCash = openingCash + cashSales;
          const actualClosingCash = session.closing_cash ? parseFloat(session.closing_cash.toString()) : null;
          const calculatedDifference = actualClosingCash !== null ? actualClosingCash - calculatedExpectedCash : null;

          return {
            ...session,
            calculated_expected_cash: calculatedExpectedCash,
            calculated_difference: calculatedDifference,
            cash_sales: cashSales,
            transaction_count: sessionTransactions?.length || 0,
          };
        })
      );

      return {
        transactions: transactions || [],
        purchases: purchases || [],
        expenses: expenses || [],
        cashSessions: sessionsWithCalculations || [],
      };
    },
    enabled: false,
  });

  const handleGenerateReport = () => {
    if (!selectedStoreId) {
      toast.error('Please select a store');
      return;
    }
    if (!startDate || !endDate) {
      toast.error('Please select date range');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast.error('Start date must be before end date');
      return;
    }
    setShowReport(true);
    refetch();
  };

  const handlePrint = () => {
    window.print();
  };

  // Calculate totals by date
  const getDailyBreakdown = () => {
    if (!reportData) return [];

    const dateMap = new Map();

    // Group transactions by date
    reportData.transactions?.forEach((t: any) => {
      const date = format(new Date(t.created_at), 'yyyy-MM-dd');
      if (!dateMap.has(date)) {
        dateMap.set(date, {
          date,
          sales: { cash: 0, credit: 0, mobileMoney: 0, total: 0, count: 0 },
          purchases: { cash: 0, credit: 0, mobileMoney: 0, total: 0 },
          expenses: { cash: 0, credit: 0, mobileMoney: 0, total: 0 },
          cashSessions: [],
        });
      }
      const dayData = dateMap.get(date);
      const amount = parseFloat(t.total.toString());
      dayData.sales.total += amount;
      dayData.sales.count += 1;
      if (t.payment_method === 'cash') dayData.sales.cash += amount;
      else if (t.payment_method === 'credit') dayData.sales.credit += amount;
      else if (t.payment_method === 'mobile_money') dayData.sales.mobileMoney += amount;
    });

    // Group purchases by date
    reportData.purchases?.forEach((p: any) => {
      const date = format(new Date(p.purchased_at), 'yyyy-MM-dd');
      if (!dateMap.has(date)) {
        dateMap.set(date, {
          date,
          sales: { cash: 0, credit: 0, mobileMoney: 0, total: 0, count: 0 },
          purchases: { cash: 0, credit: 0, mobileMoney: 0, total: 0 },
          expenses: { cash: 0, credit: 0, mobileMoney: 0, total: 0 },
          cashSessions: [],
        });
      }
      const dayData = dateMap.get(date);
      const amount = parseFloat(p.total_amount.toString());
      dayData.purchases.total += amount;
      if (p.payment_method === 'cash') dayData.purchases.cash += amount;
      else if (p.payment_method === 'credit') dayData.purchases.credit += amount;
      else if (p.payment_method === 'mobile_money') dayData.purchases.mobileMoney += amount;
    });

    // Group expenses by date
    reportData.expenses?.forEach((e: any) => {
      const date = e.expense_date;
      if (!dateMap.has(date)) {
        dateMap.set(date, {
          date,
          sales: { cash: 0, credit: 0, mobileMoney: 0, total: 0, count: 0 },
          purchases: { cash: 0, credit: 0, mobileMoney: 0, total: 0 },
          expenses: { cash: 0, credit: 0, mobileMoney: 0, total: 0 },
          cashSessions: [],
        });
      }
      const dayData = dateMap.get(date);
      const amount = parseFloat(e.amount.toString());
      dayData.expenses.total += amount;
      if (e.payment_method === 'cash') dayData.expenses.cash += amount;
      else if (e.payment_method === 'credit') dayData.expenses.credit += amount;
      else if (e.payment_method === 'mobile_money') dayData.expenses.mobileMoney += amount;
    });

    // Group cash sessions by date
    reportData.cashSessions?.forEach((session: any) => {
      const date = format(new Date(session.opened_at), 'yyyy-MM-dd');
      if (!dateMap.has(date)) {
        dateMap.set(date, {
          date,
          sales: { cash: 0, credit: 0, mobileMoney: 0, total: 0, count: 0 },
          purchases: { cash: 0, credit: 0, mobileMoney: 0, total: 0 },
          expenses: { cash: 0, credit: 0, mobileMoney: 0, total: 0 },
          cashSessions: [],
        });
      }
      dateMap.get(date).cashSessions.push(session);
    });

    return Array.from(dateMap.values()).sort((a, b) => b.date.localeCompare(a.date));
  };

  const dailyBreakdown = getDailyBreakdown();
  const storeName = stores?.find(s => s.id === selectedStoreId)?.name || 'Store';

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center no-print">
        <h1 className="text-3xl font-bold">Close Day Report</h1>
        {showReport && (
          <Button onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print Report
          </Button>
        )}
      </div>

      {/* Report Parameters */}
      <Card className="no-print">
        <CardHeader>
          <CardTitle>Report Parameters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="store">Store *</Label>
              <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent>
                  {stores?.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date *</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <Button onClick={handleGenerateReport} disabled={isLoading} className="w-full">
            <FileText className="h-4 w-4 mr-2" />
            {isLoading ? 'Generating...' : 'Generate Report'}
          </Button>
        </CardContent>
      </Card>

      {/* Report Content */}
      {showReport && reportData && (
        <div className="space-y-6 print-area">
          {/* Report Header */}
          <div className="text-center space-y-2 print-header">
            <h2 className="text-3xl font-bold">{storeName}</h2>
            <h3 className="text-2xl">Close Day Report</h3>
            <p className="text-lg text-muted-foreground">
              {format(new Date(startDate), 'MMMM dd, yyyy')} {startDate !== endDate && `- ${format(new Date(endDate), 'MMMM dd, yyyy')}`}
            </p>
            <p className="text-sm text-muted-foreground">Generated on {format(new Date(), 'MMM dd, yyyy HH:mm')}</p>
          </div>

          <Separator className="print-separator" />

          {/* Show message if no data */}
          {dailyBreakdown.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">No transactions, purchases, or expenses found for the selected date range.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Daily Breakdown */}
              {dailyBreakdown.map((dayData, index) => {
            const netDaily = dayData.sales.total - dayData.purchases.total - dayData.expenses.total;
            
            return (
              <div key={dayData.date} className="space-y-4 print-page-break">
                {/* Date Header */}
                <div className="bg-primary/10 p-4 rounded-lg print-date-header">
                  <h3 className="text-2xl font-bold">{format(new Date(dayData.date), 'EEEE, MMMM dd, yyyy')}</h3>
                </div>

                {/* Daily Sales */}
                <div className="space-y-3">
                  <h4 className="text-lg font-semibold flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    Sales
                  </h4>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg print-cell">
                      <p className="text-xs text-muted-foreground mb-1">Cash</p>
                      <p className="text-lg font-bold">{formatCurrency(dayData.sales.cash)}</p>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg print-cell">
                      <p className="text-xs text-muted-foreground mb-1">Credit</p>
                      <p className="text-lg font-bold">{formatCurrency(dayData.sales.credit)}</p>
                    </div>
                    <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg print-cell">
                      <p className="text-xs text-muted-foreground mb-1">Mobile Money</p>
                      <p className="text-lg font-bold">{formatCurrency(dayData.sales.mobileMoney)}</p>
                    </div>
                    <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg print-cell">
                      <p className="text-xs text-muted-foreground mb-1">Total</p>
                      <p className="text-xl font-bold text-green-600">{formatCurrency(dayData.sales.total)}</p>
                      <p className="text-xs text-muted-foreground">{dayData.sales.count} trans.</p>
                    </div>
                  </div>
                </div>

                {/* Daily Purchases */}
                {dayData.purchases.total > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-lg font-semibold flex items-center gap-2">
                      <ShoppingBag className="h-5 w-5 text-orange-600" />
                      Purchases
                    </h4>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg print-cell">
                        <p className="text-xs text-muted-foreground mb-1">Cash</p>
                        <p className="text-lg font-bold">{formatCurrency(dayData.purchases.cash)}</p>
                      </div>
                      <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg print-cell">
                        <p className="text-xs text-muted-foreground mb-1">Credit</p>
                        <p className="text-lg font-bold">{formatCurrency(dayData.purchases.credit)}</p>
                      </div>
                      <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg print-cell">
                        <p className="text-xs text-muted-foreground mb-1">Mobile Money</p>
                        <p className="text-lg font-bold">{formatCurrency(dayData.purchases.mobileMoney)}</p>
                      </div>
                      <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg print-cell">
                        <p className="text-xs text-muted-foreground mb-1">Total</p>
                        <p className="text-xl font-bold text-orange-600">{formatCurrency(dayData.purchases.total)}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Daily Expenses */}
                {dayData.expenses.total > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-lg font-semibold flex items-center gap-2">
                      <TrendingDown className="h-5 w-5 text-red-600" />
                      Expenses
                    </h4>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg print-cell">
                        <p className="text-xs text-muted-foreground mb-1">Cash</p>
                        <p className="text-lg font-bold">{formatCurrency(dayData.expenses.cash)}</p>
                      </div>
                      <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg print-cell">
                        <p className="text-xs text-muted-foreground mb-1">Credit</p>
                        <p className="text-lg font-bold">{formatCurrency(dayData.expenses.credit)}</p>
                      </div>
                      <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg print-cell">
                        <p className="text-xs text-muted-foreground mb-1">Mobile Money</p>
                        <p className="text-lg font-bold">{formatCurrency(dayData.expenses.mobileMoney)}</p>
                      </div>
                      <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg print-cell">
                        <p className="text-xs text-muted-foreground mb-1">Total</p>
                        <p className="text-xl font-bold text-red-600">{formatCurrency(dayData.expenses.total)}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Daily Net */}
                <div className={`p-4 rounded-lg ${netDaily >= 0 ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'} print-cell`}>
                  <div className="flex justify-between items-center">
                    <p className="font-semibold">Daily Net Cash Flow</p>
                    <p className={`text-2xl font-bold ${netDaily >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(netDaily)}
                    </p>
                  </div>
                </div>

                {/* Cash Sessions for this day */}
                {dayData.cashSessions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-lg font-semibold">Cash Sessions</h4>
                    {dayData.cashSessions.map((session: any) => {
                      const isOpen = session.status === 'open';
                      const expectedCash = session.calculated_expected_cash;
                      const closingCash = session.closing_cash ? parseFloat(session.closing_cash.toString()) : null;
                      const difference = session.calculated_difference;
                      const cashierName = session.profiles?.full_name || 'Unknown';

                      return (
                        <div key={session.id} className="p-3 border rounded-lg print-cell">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-medium">Cashier: {cashierName}</p>
                            <span className={`px-2 py-1 text-xs rounded ${isOpen ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                              {isOpen ? 'Open' : 'Closed'}
                            </span>
                          </div>
                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground text-xs">Opening</p>
                              <p className="font-semibold">{formatCurrency(parseFloat(session.opening_cash?.toString() || '0'))}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Cash Sales</p>
                              <p className="font-semibold text-green-600">{formatCurrency(session.cash_sales || 0)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Expected</p>
                              <p className="font-semibold text-blue-600">{formatCurrency(expectedCash || 0)}</p>
                            </div>
                            {closingCash !== null && (
                              <div>
                                <p className="text-muted-foreground text-xs">Difference</p>
                                <p className={`font-bold ${difference !== null && difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {difference !== null ? `${difference >= 0 ? '+' : ''}${formatCurrency(Math.abs(difference))}` : '—'}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {index < dailyBreakdown.length - 1 && <Separator className="my-6 print-separator" />}
              </div>
            );
          })}
            </>
          )}
        </div>
      )}

      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-area {
            padding: 20px;
            max-width: 100%;
          }
          .print-header {
            margin-bottom: 30px;
            page-break-after: avoid;
          }
          .print-date-header {
            background-color: #f3f4f6 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            page-break-after: avoid;
          }
          .print-page-break {
            page-break-inside: avoid;
            margin-bottom: 30px;
          }
          .print-separator {
            border-top: 2px solid #000;
            margin: 20px 0;
          }
          .print-cell {
            background-color: #f9fafb !important;
            border: 1px solid #e5e7eb !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
        @page {
          size: A4;
          margin: 15mm;
        }
      `}</style>
    </div>
  );
}
