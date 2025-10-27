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

      // Fetch cash sessions
      const { data: cashSessions } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('store_id', selectedStoreId)
        .gte('opened_at', `${startDate}T00:00:00`)
        .lte('opened_at', `${endDate}T23:59:59`)
        .order('opened_at', { ascending: false });

      return {
        transactions: transactions || [],
        purchases: purchases || [],
        expenses: expenses || [],
        cashSessions: cashSessions || [],
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

  // Calculate totals
  const salesData = {
    cash: reportData?.transactions?.filter(t => t.payment_method === 'cash').reduce((sum, t) => sum + parseFloat(t.total.toString()), 0) || 0,
    credit: reportData?.transactions?.filter(t => t.payment_method === 'credit').reduce((sum, t) => sum + parseFloat(t.total.toString()), 0) || 0,
    mobileMoney: reportData?.transactions?.filter(t => t.payment_method === 'mobile_money').reduce((sum, t) => sum + parseFloat(t.total.toString()), 0) || 0,
    total: reportData?.transactions?.reduce((sum, t) => sum + parseFloat(t.total.toString()), 0) || 0,
    count: reportData?.transactions?.length || 0,
  };

  const purchasesData = {
    cash: reportData?.purchases?.filter(p => p.payment_method === 'cash').reduce((sum, p) => sum + parseFloat(p.total_amount.toString()), 0) || 0,
    credit: reportData?.purchases?.filter(p => p.payment_method === 'credit').reduce((sum, p) => sum + parseFloat(p.total_amount.toString()), 0) || 0,
    mobileMoney: reportData?.purchases?.filter(p => p.payment_method === 'mobile_money').reduce((sum, p) => sum + parseFloat(p.total_amount.toString()), 0) || 0,
    total: reportData?.purchases?.reduce((sum, p) => sum + parseFloat(p.total_amount.toString()), 0) || 0,
  };

  const expensesData = {
    cash: reportData?.expenses?.filter(e => e.payment_method === 'cash').reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0) || 0,
    credit: reportData?.expenses?.filter(e => e.payment_method === 'credit').reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0) || 0,
    mobileMoney: reportData?.expenses?.filter(e => e.payment_method === 'mobile_money').reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0) || 0,
    total: reportData?.expenses?.reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0) || 0,
  };

  const netCashFlow = salesData.total - purchasesData.total - expensesData.total;
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
            <h2 className="text-2xl font-bold">{storeName}</h2>
            <h3 className="text-xl">Close Day Report</h3>
            <p className="text-muted-foreground">
              {format(new Date(startDate), 'MMM dd, yyyy')} - {format(new Date(endDate), 'MMM dd, yyyy')}
            </p>
          </div>

          <Separator />

          {/* Sales Summary */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Sales Summary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Cash Sales</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    <p className="text-2xl font-bold">{formatCurrency(salesData.cash)}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Credit Sales</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    <p className="text-2xl font-bold">{formatCurrency(salesData.credit)}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Mobile Money</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5 text-purple-600" />
                    <p className="text-2xl font-bold">{formatCurrency(salesData.mobileMoney)}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-green-50 dark:bg-green-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Sales</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(salesData.total)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{salesData.count} transactions</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <Separator />

          {/* Purchases Summary */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-orange-600" />
              Purchases Summary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Cash</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    <p className="text-xl font-bold">{formatCurrency(purchasesData.cash)}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Credit</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    <p className="text-xl font-bold">{formatCurrency(purchasesData.credit)}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Mobile Money</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5 text-purple-600" />
                    <p className="text-xl font-bold">{formatCurrency(purchasesData.mobileMoney)}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-orange-50 dark:bg-orange-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Purchases</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold text-orange-600">{formatCurrency(purchasesData.total)}</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <Separator />

          {/* Expenses Summary */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
              Expenses Summary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Cash</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    <p className="text-xl font-bold">{formatCurrency(expensesData.cash)}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Credit</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    <p className="text-xl font-bold">{formatCurrency(expensesData.credit)}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Mobile Money</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5 text-purple-600" />
                    <p className="text-xl font-bold">{formatCurrency(expensesData.mobileMoney)}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-red-50 dark:bg-red-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold text-red-600">{formatCurrency(expensesData.total)}</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <Separator />

          {/* Net Cash Flow */}
          <Card className={netCashFlow >= 0 ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'}>
            <CardHeader>
              <CardTitle className="text-xl">Net Cash Flow</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Sales - Purchases - Expenses</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(salesData.total)} - {formatCurrency(purchasesData.total)} - {formatCurrency(expensesData.total)}
                  </p>
                </div>
                <p className={`text-4xl font-bold ${netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(netCashFlow)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Cash Sessions Summary */}
          {reportData.cashSessions && reportData.cashSessions.length > 0 && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">Cash Sessions</h3>
                <div className="space-y-2">
                  {reportData.cashSessions.map((session) => (
                    <Card key={session.id}>
                      <CardContent className="p-4">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Opened</p>
                            <p className="font-medium">{format(new Date(session.opened_at), 'MMM dd, HH:mm')}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Opening Cash</p>
                            <p className="font-medium">{formatCurrency(parseFloat(session.opening_cash?.toString() || '0'))}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Expected Cash</p>
                            <p className="font-medium">{formatCurrency(parseFloat(session.expected_cash?.toString() || '0'))}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Closing Cash</p>
                            <p className="font-medium">{formatCurrency(parseFloat(session.closing_cash?.toString() || '0'))}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Difference</p>
                            <p className={`font-medium ${parseFloat(session.cash_difference?.toString() || '0') >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(parseFloat(session.cash_difference?.toString() || '0'))}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
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
          }
          .print-header {
            margin-bottom: 30px;
          }
        }
      `}</style>
    </div>
  );
}
