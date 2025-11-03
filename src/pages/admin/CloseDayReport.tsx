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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { FileText, DollarSign, CreditCard, Smartphone, ShoppingBag, TrendingDown, TrendingUp, Printer, ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ReturnToPOSButton } from '@/components/layout/ReturnToPOSButton';

type ReportType = 
  | 'daily-summary'
  | 'sales-by-category' 
  | 'sales-by-product'
  | 'sales-by-customer'
  | 'purchases-by-category'
  | 'purchases-by-supplier'
  | 'purchases-by-product';

export default function CloseDayReport() {
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportType, setReportType] = useState<ReportType>('daily-summary');
  const [showReport, setShowReport] = useState(false);
  const [expandedCustomers, setExpandedCustomers] = useState<Set<number>>(new Set());

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
    queryKey: ['close-day-report', selectedStoreId, startDate, endDate, reportType],
    queryFn: async () => {
      if (!selectedStoreId || !startDate || !endDate) return null;

      // Sales by Category Report
      if (reportType === 'sales-by-category') {
        const { data: transactions } = await supabase
          .from('pos_transactions')
          .select('items, total, created_at')
          .eq('store_id', selectedStoreId)
          .gte('created_at', `${startDate}T00:00:00`)
          .lte('created_at', `${endDate}T23:59:59`);

        const categoryMap = new Map<string, { quantity: number; revenue: number; transactions: number }>();
        
        transactions?.forEach((t: any) => {
          const items = t.items || [];
          items.forEach((item: any) => {
            const category = item.category || 'Uncategorized';
            const current = categoryMap.get(category) || { quantity: 0, revenue: 0, transactions: 0 };
            categoryMap.set(category, {
              quantity: current.quantity + (item.quantity || 0),
              revenue: current.revenue + (item.total || 0),
              transactions: current.transactions + 1,
            });
          });
        });

        return {
          type: 'sales-by-category',
          data: Array.from(categoryMap.entries()).map(([category, stats]) => ({
            category,
            ...stats,
          })).sort((a, b) => b.revenue - a.revenue),
        };
      }

      // Sales by Product Report
      if (reportType === 'sales-by-product') {
        const { data: transactions } = await supabase
          .from('pos_transactions')
          .select('items, total, created_at')
          .eq('store_id', selectedStoreId)
          .gte('created_at', `${startDate}T00:00:00`)
          .lte('created_at', `${endDate}T23:59:59`);

        const productMap = new Map<string, { name: string; quantity: number; revenue: number; transactions: number }>();
        
        transactions?.forEach((t: any) => {
          const items = t.items || [];
          items.forEach((item: any) => {
            const productId = item.product_id || item.name;
            const current = productMap.get(productId) || { name: item.name, quantity: 0, revenue: 0, transactions: 0 };
            productMap.set(productId, {
              name: item.name,
              quantity: current.quantity + (item.quantity || 0),
              revenue: current.revenue + (item.total || 0),
              transactions: current.transactions + 1,
            });
          });
        });

        return {
          type: 'sales-by-product',
          data: Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue),
        };
      }

      // Sales by Customer Report
      if (reportType === 'sales-by-customer') {
        const { data: transactions } = await supabase
          .from('pos_transactions')
          .select('id, total, notes, items, created_at')
          .eq('store_id', selectedStoreId)
          .gte('created_at', `${startDate}T00:00:00`)
          .lte('created_at', `${endDate}T23:59:59`);

        const customerMap = new Map<string, { name: string; totalSpent: number; orderCount: number; orders: any[] }>();
        
        transactions?.forEach((t: any) => {
          // Extract customer info from notes field
          let customerName = 'Walk-in Customer';
          let customerId = 'walk-in';
          
          if (t.notes?.includes('customer:')) {
            const customerMatch = t.notes.match(/customer:([^,]+),([^)]+)/);
            if (customerMatch) {
              customerId = customerMatch[1];
              customerName = customerMatch[2];
            }
          }
          
          const current = customerMap.get(customerId) || { name: customerName, totalSpent: 0, orderCount: 0, orders: [] };
          customerMap.set(customerId, {
            name: customerName,
            totalSpent: current.totalSpent + parseFloat(t.total?.toString() || '0'),
            orderCount: current.orderCount + 1,
            orders: [...current.orders, { id: t.id, total: t.total, items: t.items, created_at: t.created_at }],
          });
        });

        return {
          type: 'sales-by-customer',
          data: Array.from(customerMap.values()).sort((a, b) => b.totalSpent - a.totalSpent),
        };
      }

      // Purchases by Category Report
      if (reportType === 'purchases-by-category') {
        const { data: purchaseItems } = await supabase
          .from('purchase_items')
          .select(`
            *,
            purchases!inner(store_id, purchased_at),
            products(name, category_id),
            categories:products(category_id(name))
          `)
          .eq('purchases.store_id', selectedStoreId)
          .gte('purchases.purchased_at', `${startDate}T00:00:00`)
          .lte('purchases.purchased_at', `${endDate}T23:59:59`);

        const categoryMap = new Map<string, { quantity: number; cost: number; items: number }>();
        
        purchaseItems?.forEach((item: any) => {
          const categoryName = item.products?.categories?.name || 'Uncategorized';
          const current = categoryMap.get(categoryName) || { quantity: 0, cost: 0, items: 0 };
          categoryMap.set(categoryName, {
            quantity: current.quantity + (item.quantity || 0),
            cost: current.cost + parseFloat(item.total_cost?.toString() || '0'),
            items: current.items + 1,
          });
        });

        return {
          type: 'purchases-by-category',
          data: Array.from(categoryMap.entries()).map(([category, stats]) => ({
            category,
            ...stats,
          })).sort((a, b) => b.cost - a.cost),
        };
      }

      // Purchases by Supplier Report
      if (reportType === 'purchases-by-supplier') {
        const { data: purchases } = await supabase
          .from('purchases')
          .select('supplier_name, total_amount, purchased_at')
          .eq('store_id', selectedStoreId)
          .gte('purchased_at', `${startDate}T00:00:00`)
          .lte('purchased_at', `${endDate}T23:59:59`);

        const supplierMap = new Map<string, { totalCost: number; purchaseCount: number }>();
        
        purchases?.forEach((p: any) => {
          const supplier = p.supplier_name || 'Unknown';
          const current = supplierMap.get(supplier) || { totalCost: 0, purchaseCount: 0 };
          supplierMap.set(supplier, {
            totalCost: current.totalCost + parseFloat(p.total_amount?.toString() || '0'),
            purchaseCount: current.purchaseCount + 1,
          });
        });

        return {
          type: 'purchases-by-supplier',
          data: Array.from(supplierMap.entries()).map(([supplier, stats]) => ({
            supplier,
            ...stats,
          })).sort((a, b) => b.totalCost - a.totalCost),
        };
      }

      // Purchases by Product Report
      if (reportType === 'purchases-by-product') {
        const { data: purchaseItems } = await supabase
          .from('purchase_items')
          .select(`
            *,
            purchases!inner(store_id, purchased_at),
            products(name)
          `)
          .eq('purchases.store_id', selectedStoreId)
          .gte('purchases.purchased_at', `${startDate}T00:00:00`)
          .lte('purchases.purchased_at', `${endDate}T23:59:59`);

        const productMap = new Map<string, { name: string; quantity: number; cost: number; purchaseCount: number }>();
        
        purchaseItems?.forEach((item: any) => {
          const productId = item.product_id;
          const productName = item.products?.name || 'Unknown Product';
          const current = productMap.get(productId) || { name: productName, quantity: 0, cost: 0, purchaseCount: 0 };
          productMap.set(productId, {
            name: productName,
            quantity: current.quantity + (item.quantity || 0),
            cost: current.cost + parseFloat(item.total_cost?.toString() || '0'),
            purchaseCount: current.purchaseCount + 1,
          });
        });

        return {
          type: 'purchases-by-product',
          data: Array.from(productMap.values()).sort((a, b) => b.cost - a.cost),
        };
      }

      // Default: Daily Summary Report

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
          const sessionStart = session.opened_at;
          const sessionEnd = session.closed_at || `${endDate}T23:59:59`;

          // Get cash sales from ALL users during this period
          const { data: sessionTransactions } = await supabase
            .from('pos_transactions')
            .select('total, payment_method')
            .eq('store_id', session.store_id)
            .gte('created_at', sessionStart)
            .lte('created_at', sessionEnd);

          const cashSales = sessionTransactions
            ?.filter(t => t.payment_method === 'cash')
            .reduce((sum, t) => sum + parseFloat(t.total.toString()), 0) || 0;

          // Get cash payment receipts from ALL users during this period
          const { data: sessionReceipts } = await supabase
            .from('payment_receipts')
            .select('amount, payment_method')
            .eq('store_id', session.store_id)
            .gte('created_at', sessionStart)
            .lte('created_at', sessionEnd);

          const cashPaymentsReceived = sessionReceipts
            ?.filter(r => r.payment_method === 'cash')
            .reduce((sum, r) => sum + parseFloat(r.amount.toString()), 0) || 0;

          // Get cash purchases from ALL users during this period
          const { data: sessionPurchases } = await supabase
            .from('purchases')
            .select('total_amount, payment_method')
            .eq('store_id', session.store_id)
            .gte('purchased_at', sessionStart)
            .lte('purchased_at', sessionEnd);

          const cashPurchases = sessionPurchases
            ?.filter(p => p.payment_method === 'cash')
            .reduce((sum, p) => sum + parseFloat(p.total_amount.toString()), 0) || 0;

          // Get cash expenses from ALL users during this period
          const { data: sessionExpenses } = await supabase
            .from('expenses')
            .select('amount, payment_method, expense_date, created_at')
            .eq('store_id', session.store_id)
            .gte('created_at', sessionStart)
            .lte('created_at', sessionEnd);

          const cashExpenses = sessionExpenses
            ?.filter(e => e.payment_method === 'cash')
            .reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0) || 0;

          const openingCash = parseFloat(session.opening_cash?.toString() || '0');
          const calculatedExpectedCash = openingCash + cashSales + cashPaymentsReceived - cashPurchases - cashExpenses;
          const actualClosingCash = session.closing_cash ? parseFloat(session.closing_cash.toString()) : null;
          const calculatedDifference = actualClosingCash !== null ? actualClosingCash - calculatedExpectedCash : null;

          return {
            ...session,
            calculated_expected_cash: calculatedExpectedCash,
            calculated_difference: calculatedDifference,
            cash_sales: cashSales,
            cash_payments_received: cashPaymentsReceived,
            cash_purchases: cashPurchases,
            cash_expenses: cashExpenses,
            transaction_count: sessionTransactions?.length || 0,
          };
        })
      );

      return {
        type: 'daily-summary',
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
    if (!reportData || reportData.type !== 'daily-summary') return [];

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

  const renderReportContent = () => {
    if (!reportData) return null;

    // Sales by Category Report
    if (reportData.type === 'sales-by-category') {
      const data = reportData.data as Array<{ category: string; quantity: number; revenue: number; transactions: number }>;
      const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
      const totalQuantity = data.reduce((sum, item) => sum + item.quantity, 0);

      return (
        <Card>
          <CardHeader>
            <CardTitle>Sales by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-4 bg-primary/10 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Items Sold</p>
                  <p className="text-2xl font-bold">{totalQuantity}</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-4 font-semibold text-sm border-b pb-2">
                <div>Category</div>
                <div className="text-right">Quantity</div>
                <div className="text-right">Revenue</div>
                <div className="text-right">% of Total</div>
              </div>
              {data.map((item) => (
                <div key={item.category} className="grid grid-cols-4 gap-4 py-2 border-b">
                  <div className="font-medium">{item.category}</div>
                  <div className="text-right">{item.quantity}</div>
                  <div className="text-right font-semibold">{formatCurrency(item.revenue)}</div>
                  <div className="text-right text-muted-foreground">
                    {((item.revenue / totalRevenue) * 100).toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      );
    }

    // Sales by Product Report
    if (reportData.type === 'sales-by-product') {
      const data = reportData.data as Array<{ name: string; quantity: number; revenue: number; transactions: number }>;
      const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
      const totalQuantity = data.reduce((sum, item) => sum + item.quantity, 0);

      return (
        <Card>
          <CardHeader>
            <CardTitle>Sales by Product</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-4 bg-primary/10 rounded-lg">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Items Sold</p>
                  <p className="text-2xl font-bold">{totalQuantity}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Products</p>
                  <p className="text-2xl font-bold">{data.length}</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-5 gap-4 font-semibold text-sm border-b pb-2">
                <div className="col-span-2">Product</div>
                <div className="text-right">Quantity</div>
                <div className="text-right">Revenue</div>
                <div className="text-right">% of Total</div>
              </div>
              {data.map((item, index) => (
                <div key={index} className="grid grid-cols-5 gap-4 py-2 border-b">
                  <div className="col-span-2 font-medium">{item.name}</div>
                  <div className="text-right">{item.quantity}</div>
                  <div className="text-right font-semibold">{formatCurrency(item.revenue)}</div>
                  <div className="text-right text-muted-foreground">
                    {((item.revenue / totalRevenue) * 100).toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      );
    }

    // Sales by Customer Report
    if (reportData.type === 'sales-by-customer') {
      const data = reportData.data as Array<{ name: string; totalSpent: number; orderCount: number; orders: any[] }>;
      const totalRevenue = data.reduce((sum, item) => sum + item.totalSpent, 0);
      const totalOrders = data.reduce((sum, item) => sum + item.orderCount, 0);

      const toggleCustomer = (index: number) => {
        const newExpanded = new Set(expandedCustomers);
        if (newExpanded.has(index)) {
          newExpanded.delete(index);
        } else {
          newExpanded.add(index);
        }
        setExpandedCustomers(newExpanded);
      };

      return (
        <Card>
          <CardHeader>
            <CardTitle>Sales by Customer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-4 bg-primary/10 rounded-lg">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                  <p className="text-2xl font-bold">{totalOrders}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Customers</p>
                  <p className="text-2xl font-bold">{data.length}</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-5 gap-4 font-semibold text-sm border-b pb-2">
                <div className="col-span-2">Customer Name</div>
                <div className="text-right">Orders</div>
                <div className="text-right">Total Spent</div>
                <div className="text-right">% of Total</div>
              </div>
              {data.map((item, index) => (
                <Collapsible key={index} open={expandedCustomers.has(index)} onOpenChange={() => toggleCustomer(index)}>
                  <CollapsibleTrigger asChild>
                    <div className="grid grid-cols-5 gap-4 py-2 border-b cursor-pointer hover:bg-muted/50">
                      <div className="col-span-2 font-medium flex items-center gap-2">
                        {expandedCustomers.has(index) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        {item.name}
                      </div>
                      <div className="text-right">{item.orderCount}</div>
                      <div className="text-right font-semibold">{formatCurrency(item.totalSpent)}</div>
                      <div className="text-right text-muted-foreground">
                        {((item.totalSpent / totalRevenue) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-8 mt-2 mb-4 space-y-2">
                      {item.orders.map((order: any, orderIndex: number) => (
                        <div key={orderIndex} className="border rounded-lg p-3 bg-muted/20">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium">
                              Order #{orderIndex + 1} - {format(new Date(order.created_at), 'MMM dd, yyyy HH:mm')}
                            </span>
                            <span className="text-sm font-bold">{formatCurrency(order.total)}</span>
                          </div>
                          <div className="space-y-1">
                            {order.items?.map((item: any, itemIndex: number) => (
                              <div key={itemIndex} className="flex justify-between text-sm text-muted-foreground pl-4">
                                <span>
                                  {item.quantity}x {item.name} {item.variant && `(${item.variant})`}
                                </span>
                                <span>{formatCurrency(item.total)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </CardContent>
        </Card>
      );
    }

    // Purchases by Category Report
    if (reportData.type === 'purchases-by-category') {
      const data = reportData.data as Array<{ category: string; quantity: number; cost: number; items: number }>;
      const totalCost = data.reduce((sum, item) => sum + item.cost, 0);
      const totalQuantity = data.reduce((sum, item) => sum + item.quantity, 0);

      return (
        <Card>
          <CardHeader>
            <CardTitle>Purchases by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Cost</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalCost)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Items</p>
                  <p className="text-2xl font-bold">{totalQuantity}</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-4 font-semibold text-sm border-b pb-2">
                <div>Category</div>
                <div className="text-right">Quantity</div>
                <div className="text-right">Total Cost</div>
                <div className="text-right">% of Total</div>
              </div>
              {data.map((item) => (
                <div key={item.category} className="grid grid-cols-4 gap-4 py-2 border-b">
                  <div className="font-medium">{item.category}</div>
                  <div className="text-right">{item.quantity}</div>
                  <div className="text-right font-semibold">{formatCurrency(item.cost)}</div>
                  <div className="text-right text-muted-foreground">
                    {((item.cost / totalCost) * 100).toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      );
    }

    // Purchases by Supplier Report
    if (reportData.type === 'purchases-by-supplier') {
      const data = reportData.data as Array<{ supplier: string; totalCost: number; purchaseCount: number }>;
      const totalCost = data.reduce((sum, item) => sum + item.totalCost, 0);
      const totalPurchases = data.reduce((sum, item) => sum + item.purchaseCount, 0);

      return (
        <Card>
          <CardHeader>
            <CardTitle>Purchases by Supplier</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Cost</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalCost)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Purchases</p>
                  <p className="text-2xl font-bold">{totalPurchases}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Suppliers</p>
                  <p className="text-2xl font-bold">{data.length}</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-4 font-semibold text-sm border-b pb-2">
                <div className="col-span-2">Supplier</div>
                <div className="text-right">Purchases</div>
                <div className="text-right">Total Cost</div>
              </div>
              {data.map((item, index) => (
                <div key={index} className="grid grid-cols-4 gap-4 py-2 border-b">
                  <div className="col-span-2 font-medium">{item.supplier}</div>
                  <div className="text-right">{item.purchaseCount}</div>
                  <div className="text-right font-semibold">{formatCurrency(item.totalCost)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      );
    }

    // Purchases by Product Report
    if (reportData.type === 'purchases-by-product') {
      const data = reportData.data as Array<{ name: string; quantity: number; cost: number; purchaseCount: number }>;
      const totalCost = data.reduce((sum, item) => sum + item.cost, 0);
      const totalQuantity = data.reduce((sum, item) => sum + item.quantity, 0);

      return (
        <Card>
          <CardHeader>
            <CardTitle>Purchases by Product</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Cost</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalCost)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Items Purchased</p>
                  <p className="text-2xl font-bold">{totalQuantity}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Products</p>
                  <p className="text-2xl font-bold">{data.length}</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-5 gap-4 font-semibold text-sm border-b pb-2">
                <div className="col-span-2">Product</div>
                <div className="text-right">Quantity</div>
                <div className="text-right">Total Cost</div>
                <div className="text-right">Avg Cost</div>
              </div>
              {data.map((item, index) => (
                <div key={index} className="grid grid-cols-5 gap-4 py-2 border-b">
                  <div className="col-span-2 font-medium">{item.name}</div>
                  <div className="text-right">{item.quantity}</div>
                  <div className="text-right font-semibold">{formatCurrency(item.cost)}</div>
                  <div className="text-right text-muted-foreground">
                    {formatCurrency(item.cost / item.quantity)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      );
    }

    return null;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center no-print">
        <h1 className="text-3xl font-bold">Reports</h1>
        <div className="flex items-center gap-2">
          <ReturnToPOSButton />
          {showReport && (
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print Report
            </Button>
          )}
        </div>
      </div>

      {/* Report Parameters */}
      <Card className="no-print">
        <CardHeader>
          <CardTitle>Report Parameters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <Label htmlFor="reportType">Report Type *</Label>
              <Select value={reportType} onValueChange={(value) => setReportType(value as ReportType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily-summary">Daily Summary</SelectItem>
                  <SelectItem value="sales-by-category">Sales by Category</SelectItem>
                  <SelectItem value="sales-by-product">Sales by Product</SelectItem>
                  <SelectItem value="sales-by-customer">Sales by Customer</SelectItem>
                  <SelectItem value="purchases-by-category">Purchases by Category</SelectItem>
                  <SelectItem value="purchases-by-supplier">Purchases by Supplier</SelectItem>
                  <SelectItem value="purchases-by-product">Purchases by Product</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

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
            <h3 className="text-2xl">{reportType === 'daily-summary' ? 'End Of Day Report' : reportType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</h3>
            <p className="text-lg text-muted-foreground">
              {format(new Date(startDate), 'MMMM dd, yyyy')} {startDate !== endDate && `- ${format(new Date(endDate), 'MMMM dd, yyyy')}`}
            </p>
            <p className="text-sm text-muted-foreground">Generated on {format(new Date(), 'MMM dd, yyyy HH:mm')}</p>
          </div>

          <Separator className="print-separator" />

          {/* Render report based on type */}
          {reportType !== 'daily-summary' ? (
            renderReportContent()
          ) : dailyBreakdown.length === 0 ? (
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
