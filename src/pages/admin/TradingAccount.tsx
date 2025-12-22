import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, ArrowLeft, FileSpreadsheet, FileText, TrendingUp, TrendingDown } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfYear, subMonths } from 'date-fns';
import { formatCurrency, cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function TradingAccount() {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));

  // Fetch purchases data
  const { data: purchasesData, isLoading: isLoadingPurchases } = useQuery({
    queryKey: ['trading-purchases', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchases')
        .select(`
          id,
          purchased_at,
          total_amount,
          payment_status,
          purchase_items (
            quantity,
            unit_cost,
            total_cost
          )
        `)
        .gte('purchased_at', startDate.toISOString())
        .lte('purchased_at', endDate.toISOString());

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch sales data from POS transactions
  const { data: salesData, isLoading: isLoadingSales } = useQuery({
    queryKey: ['trading-sales', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pos_transactions')
        .select('id, total, subtotal, discount, created_at, items')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch opening and closing stock values
  const { data: stockData, isLoading: isLoadingStock } = useQuery({
    queryKey: ['trading-stock', startDate, endDate],
    queryFn: async () => {
      // Get inventory layers for opening stock (before start date)
      const { data: openingLayers, error: openingError } = await supabase
        .from('inventory_layers')
        .select('quantity_remaining, unit_cost')
        .lt('purchased_at', startDate.toISOString());

      if (openingError) throw openingError;

      // Get inventory layers for closing stock (up to end date)
      const { data: closingLayers, error: closingError } = await supabase
        .from('inventory_layers')
        .select('quantity_remaining, unit_cost')
        .lte('purchased_at', endDate.toISOString());

      if (closingError) throw closingError;

      // Calculate opening stock value
      const openingStock = (openingLayers || []).reduce((sum, layer) => 
        sum + (layer.quantity_remaining * layer.unit_cost), 0);

      // Calculate closing stock value
      const closingStock = (closingLayers || []).reduce((sum, layer) => 
        sum + (layer.quantity_remaining * layer.unit_cost), 0);

      return { openingStock, closingStock };
    },
  });

  // Calculate totals
  const totalPurchases = purchasesData?.reduce((sum, p) => sum + (p.total_amount || 0), 0) || 0;
  const totalSales = salesData?.reduce((sum, s) => sum + (s.total || 0), 0) || 0;
  const totalDiscount = salesData?.reduce((sum, s) => sum + (s.discount || 0), 0) || 0;
  const netSales = totalSales;

  const openingStock = stockData?.openingStock || 0;
  const closingStock = stockData?.closingStock || 0;

  // Trading Account Calculations
  const costOfGoodsAvailable = openingStock + totalPurchases;
  const costOfGoodsSold = costOfGoodsAvailable - closingStock;
  const grossProfit = netSales - costOfGoodsSold;
  const grossProfitPercentage = netSales > 0 ? (grossProfit / netSales) * 100 : 0;
  const grossLoss = grossProfit < 0 ? Math.abs(grossProfit) : 0;
  const grossLossPercentage = netSales > 0 && grossProfit < 0 ? (Math.abs(grossProfit) / netSales) * 100 : 0;

  const isLoading = isLoadingPurchases || isLoadingSales || isLoadingStock;

  // Left side (Debit - Purchases side)
  const leftSideItems = [
    { label: 'To Opening Stock', amount: openingStock },
    { label: 'To Purchases', amount: totalPurchases },
  ];

  // Right side (Credit - Sales side)  
  const rightSideItems = [
    { label: 'By Sales', amount: totalSales },
    { label: 'Less: Discount', amount: -totalDiscount, isDeduction: true },
    { label: 'By Closing Stock', amount: closingStock },
  ];

  // Calculate totals for balancing
  const leftTotal = openingStock + totalPurchases + (grossProfit > 0 ? grossProfit : 0);
  const rightTotal = netSales + closingStock + (grossProfit < 0 ? Math.abs(grossProfit) : 0);

  const exportToExcel = () => {
    const data = [
      ['TRADING ACCOUNT'],
      [`For the period ${format(startDate, 'dd/MM/yyyy')} to ${format(endDate, 'dd/MM/yyyy')}`],
      [],
      ['DEBIT (Dr.)', '', 'CREDIT (Cr.)', ''],
      ['Particulars', 'Amount (FCFA)', 'Particulars', 'Amount (FCFA)'],
      ['To Opening Stock', openingStock, 'By Sales', totalSales],
      ['To Purchases', totalPurchases, 'Less: Discount', totalDiscount],
      ['', '', 'Net Sales', netSales],
      ['', '', 'By Closing Stock', closingStock],
      grossProfit > 0 
        ? ['To Gross Profit c/d', grossProfit, '', '']
        : ['', '', 'By Gross Loss c/d', Math.abs(grossProfit)],
      [],
      ['Total', leftTotal, 'Total', rightTotal],
      [],
      ['SUMMARY'],
      ['Gross Profit/Loss %', `${grossProfitPercentage.toFixed(2)}%`],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Trading Account');
    XLSX.writeFile(wb, `Trading_Account_${format(startDate, 'yyyyMMdd')}_${format(endDate, 'yyyyMMdd')}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('TRADING ACCOUNT', 105, 15, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`For the period ${format(startDate, 'dd/MM/yyyy')} to ${format(endDate, 'dd/MM/yyyy')}`, 105, 25, { align: 'center' });

    // Create two-column table
    const tableData = [
      ['To Opening Stock', formatCurrency(openingStock), 'By Sales', formatCurrency(totalSales)],
      ['To Purchases', formatCurrency(totalPurchases), 'Less: Discount', formatCurrency(totalDiscount)],
      ['', '', 'Net Sales', formatCurrency(netSales)],
      ['', '', 'By Closing Stock', formatCurrency(closingStock)],
      grossProfit > 0
        ? ['To Gross Profit c/d', formatCurrency(grossProfit), '', '']
        : ['', '', 'By Gross Loss c/d', formatCurrency(Math.abs(grossProfit))],
      ['TOTAL', formatCurrency(leftTotal), 'TOTAL', formatCurrency(rightTotal)],
    ];

    autoTable(doc, {
      startY: 35,
      head: [['DEBIT (Dr.)', 'Amount', 'CREDIT (Cr.)', 'Amount']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [34, 197, 94] },
      styles: { fontSize: 10 },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 100;
    
    doc.setFontSize(14);
    doc.text(`Gross ${grossProfit >= 0 ? 'Profit' : 'Loss'}: ${formatCurrency(Math.abs(grossProfit))} (${Math.abs(grossProfitPercentage).toFixed(2)}%)`, 14, finalY + 15);

    doc.save(`Trading_Account_${format(startDate, 'yyyyMMdd')}_${format(endDate, 'yyyyMMdd')}.pdf`);
  };

  const setQuickDateRange = (range: 'thisMonth' | 'lastMonth' | 'thisYear') => {
    const now = new Date();
    switch (range) {
      case 'thisMonth':
        setStartDate(startOfMonth(now));
        setEndDate(endOfMonth(now));
        break;
      case 'lastMonth':
        const lastMonth = subMonths(now, 1);
        setStartDate(startOfMonth(lastMonth));
        setEndDate(endOfMonth(lastMonth));
        break;
      case 'thisYear':
        setStartDate(startOfYear(now));
        setEndDate(now);
        break;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Trading Account</h1>
              <p className="text-muted-foreground text-sm">Traditional P/L format with Purchases & Sales</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setQuickDateRange('thisMonth')}>
              This Month
            </Button>
            <Button variant="outline" size="sm" onClick={() => setQuickDateRange('lastMonth')}>
              Last Month
            </Button>
            <Button variant="outline" size="sm" onClick={() => setQuickDateRange('thisYear')}>
              This Year
            </Button>
          </div>
        </div>

        {/* Date Range Selectors */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center gap-4 justify-between">
              <div className="flex items-center gap-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[180px] justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(startDate, 'dd/MM/yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => date && setStartDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-muted-foreground">to</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[180px] justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(endDate, 'dd/MM/yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => date && setEndDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={exportToExcel}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Excel
                </Button>
                <Button variant="outline" size="sm" onClick={exportToPDF}>
                  <FileText className="h-4 w-4 mr-2" />
                  PDF
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <Card>
            <CardContent className="py-10">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Trading Account - Traditional Format */}
            <Card>
              <CardHeader className="bg-primary/10 border-b">
                <CardTitle className="text-center text-lg">
                  TRADING ACCOUNT
                  <div className="text-sm font-normal text-muted-foreground mt-1">
                    For the period {format(startDate, 'dd/MM/yyyy')} to {format(endDate, 'dd/MM/yyyy')}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-2 divide-x">
                  {/* Left Side - Debit (Purchases) */}
                  <div className="p-4">
                    <h3 className="font-semibold text-center mb-4 text-destructive">DEBIT (Dr.)</h3>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 font-medium">Particulars</th>
                          <th className="text-right py-2 font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="py-2">To Opening Stock</td>
                          <td className="text-right py-2">{formatCurrency(openingStock)}</td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-2">To Purchases</td>
                          <td className="text-right py-2">{formatCurrency(totalPurchases)}</td>
                        </tr>
                        {grossProfit > 0 && (
                          <tr className="border-b bg-green-50 dark:bg-green-900/20">
                            <td className="py-2 font-semibold text-green-700 dark:text-green-400">
                              To Gross Profit c/d
                            </td>
                            <td className="text-right py-2 font-semibold text-green-700 dark:text-green-400">
                              {formatCurrency(grossProfit)}
                            </td>
                          </tr>
                        )}
                        <tr className="bg-muted/50 font-bold">
                          <td className="py-3">TOTAL</td>
                          <td className="text-right py-3">{formatCurrency(leftTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Right Side - Credit (Sales) */}
                  <div className="p-4">
                    <h3 className="font-semibold text-center mb-4 text-green-600 dark:text-green-400">CREDIT (Cr.)</h3>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 font-medium">Particulars</th>
                          <th className="text-right py-2 font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="py-2">By Sales</td>
                          <td className="text-right py-2">{formatCurrency(totalSales)}</td>
                        </tr>
                        {totalDiscount > 0 && (
                          <tr className="border-b text-muted-foreground">
                            <td className="py-2 pl-4">Less: Discount</td>
                            <td className="text-right py-2">({formatCurrency(totalDiscount)})</td>
                          </tr>
                        )}
                        <tr className="border-b">
                          <td className="py-2 font-medium">Net Sales</td>
                          <td className="text-right py-2 font-medium">{formatCurrency(netSales)}</td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-2">By Closing Stock</td>
                          <td className="text-right py-2">{formatCurrency(closingStock)}</td>
                        </tr>
                        {grossProfit < 0 && (
                          <tr className="border-b bg-red-50 dark:bg-red-900/20">
                            <td className="py-2 font-semibold text-red-700 dark:text-red-400">
                              By Gross Loss c/d
                            </td>
                            <td className="text-right py-2 font-semibold text-red-700 dark:text-red-400">
                              {formatCurrency(Math.abs(grossProfit))}
                            </td>
                          </tr>
                        )}
                        <tr className="bg-muted/50 font-bold">
                          <td className="py-3">TOTAL</td>
                          <td className="text-right py-3">{formatCurrency(rightTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary Card */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">Total Purchases</div>
                  <div className="text-2xl font-bold text-orange-600">{formatCurrency(totalPurchases)}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">Net Sales</div>
                  <div className="text-2xl font-bold text-blue-600">{formatCurrency(netSales)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">Cost of Goods Sold</div>
                  <div className="text-2xl font-bold">{formatCurrency(costOfGoodsSold)}</div>
                </CardContent>
              </Card>

              <Card className={cn(
                grossProfit >= 0 ? "border-green-500/50" : "border-red-500/50"
              )}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    {grossProfit >= 0 ? (
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-600" />
                    )}
                    <span className="text-sm text-muted-foreground">
                      Gross {grossProfit >= 0 ? 'Profit' : 'Loss'}
                    </span>
                  </div>
                  <div className={cn(
                    "text-2xl font-bold",
                    grossProfit >= 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {formatCurrency(Math.abs(grossProfit))}
                  </div>
                  <div className={cn(
                    "text-sm font-medium",
                    grossProfit >= 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {Math.abs(grossProfitPercentage).toFixed(2)}%
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Stock Movement */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Stock Movement</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="text-sm text-muted-foreground">Opening Stock</div>
                    <div className="text-xl font-bold">{formatCurrency(openingStock)}</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="text-sm text-muted-foreground">+ Purchases</div>
                    <div className="text-xl font-bold text-orange-600">+{formatCurrency(totalPurchases)}</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="text-sm text-muted-foreground">= Closing Stock</div>
                    <div className="text-xl font-bold">{formatCurrency(closingStock)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
