import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, ArrowLeft, FileSpreadsheet, FileText, TrendingUp, TrendingDown } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfYear, subMonths } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
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
        .select('id, purchased_at, total_amount, payment_status')
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
        .select('id, total, subtotal, discount, created_at')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) throw error;
      return data || [];
    },
  });

  // Calculate totals
  const totalPurchases = purchasesData?.reduce((sum, p) => sum + (p.total_amount || 0), 0) || 0;
  const totalSales = salesData?.reduce((sum, s) => sum + (s.total || 0), 0) || 0;
  const totalDiscount = salesData?.reduce((sum, s) => sum + (s.discount || 0), 0) || 0;
  const netSales = totalSales;

  // P/L Calculation
  const profitOrLoss = netSales - totalPurchases;
  const profitLossPercentage = netSales > 0 ? (profitOrLoss / netSales) * 100 : 0;

  const isLoading = isLoadingPurchases || isLoadingSales;

  const exportToExcel = () => {
    const data = [
      ['TRADING ACCOUNT'],
      [`For the period ${format(startDate, 'dd/MM/yyyy')} to ${format(endDate, 'dd/MM/yyyy')}`],
      [],
      ['DEBIT (Dr.)', '', 'CREDIT (Cr.)', ''],
      ['Particulars', 'Amount (FCFA)', 'Particulars', 'Amount (FCFA)'],
      ['To Purchases', totalPurchases, 'By Sales', totalSales],
      totalDiscount > 0 ? ['', '', 'Less: Discount', totalDiscount] : [],
      totalDiscount > 0 ? ['', '', 'Net Sales', netSales] : [],
      profitOrLoss > 0 
        ? ['To Gross Profit', profitOrLoss, '', '']
        : ['', '', 'To Gross Loss', Math.abs(profitOrLoss)],
      [],
      ['Total', totalPurchases + (profitOrLoss > 0 ? profitOrLoss : 0), 'Total', netSales + (profitOrLoss < 0 ? Math.abs(profitOrLoss) : 0)],
      [],
      ['SUMMARY'],
      ['Profit/Loss %', `${profitLossPercentage.toFixed(2)}%`],
    ].filter(row => row.length > 0);

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

    const tableData = [
      ['To Purchases', formatCurrency(totalPurchases), 'By Sales', formatCurrency(totalSales)],
      totalDiscount > 0 ? ['', '', 'Less: Discount', formatCurrency(totalDiscount)] : ['', '', '', ''],
      totalDiscount > 0 ? ['', '', 'Net Sales', formatCurrency(netSales)] : ['', '', '', ''],
      profitOrLoss > 0
        ? ['To Gross Profit', formatCurrency(profitOrLoss), '', '']
        : ['', '', 'To Gross Loss', formatCurrency(Math.abs(profitOrLoss))],
      ['TOTAL', formatCurrency(totalPurchases + (profitOrLoss > 0 ? profitOrLoss : 0)), 'TOTAL', formatCurrency(netSales + (profitOrLoss < 0 ? Math.abs(profitOrLoss) : 0))],
    ].filter(row => row.some(cell => cell !== ''));

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
    doc.text(`${profitOrLoss >= 0 ? 'Profit' : 'Loss'}: ${formatCurrency(Math.abs(profitOrLoss))} (${Math.abs(profitLossPercentage).toFixed(2)}%)`, 14, finalY + 15);

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

  // Calculate totals for balancing
  const leftTotal = totalPurchases + (profitOrLoss > 0 ? profitOrLoss : 0);
  const rightTotal = netSales + (profitOrLoss < 0 ? Math.abs(profitOrLoss) : 0);

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
              <p className="text-muted-foreground text-sm">Purchases vs Sales Report</p>
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
                          <td className="py-3">To Purchases</td>
                          <td className="text-right py-3">{formatCurrency(totalPurchases)}</td>
                        </tr>
                        {profitOrLoss > 0 && (
                          <tr className="border-b bg-green-50 dark:bg-green-900/20">
                            <td className="py-3 font-semibold text-green-700 dark:text-green-400">
                              To Gross Profit
                            </td>
                            <td className="text-right py-3 font-semibold text-green-700 dark:text-green-400">
                              {formatCurrency(profitOrLoss)}
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
                          <td className="py-3">By Sales</td>
                          <td className="text-right py-3">{formatCurrency(totalSales)}</td>
                        </tr>
                        {totalDiscount > 0 && (
                          <>
                            <tr className="border-b text-muted-foreground">
                              <td className="py-2 pl-4">Less: Discount</td>
                              <td className="text-right py-2">({formatCurrency(totalDiscount)})</td>
                            </tr>
                            <tr className="border-b">
                              <td className="py-2 font-medium">Net Sales</td>
                              <td className="text-right py-2 font-medium">{formatCurrency(netSales)}</td>
                            </tr>
                          </>
                        )}
                        {profitOrLoss < 0 && (
                          <tr className="border-b bg-red-50 dark:bg-red-900/20">
                            <td className="py-3 font-semibold text-red-700 dark:text-red-400">
                              To Gross Loss
                            </td>
                            <td className="text-right py-3 font-semibold text-red-700 dark:text-red-400">
                              {formatCurrency(Math.abs(profitOrLoss))}
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

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">Total Purchases</div>
                  <div className="text-2xl font-bold text-orange-600">{formatCurrency(totalPurchases)}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">Total Sales</div>
                  <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalSales)}</div>
                </CardContent>
              </Card>
              
              <Card className={profitOrLoss >= 0 ? 'border-green-200 bg-green-50/50 dark:bg-green-900/10' : 'border-red-200 bg-red-50/50 dark:bg-red-900/10'}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    {profitOrLoss >= 0 ? (
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-600" />
                    )}
                    <div className="text-sm text-muted-foreground">
                      {profitOrLoss >= 0 ? 'Gross Profit' : 'Gross Loss'}
                    </div>
                  </div>
                  <div className={`text-2xl font-bold ${profitOrLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(Math.abs(profitOrLoss))}
                  </div>
                  <div className={`text-sm ${profitOrLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {Math.abs(profitLossPercentage).toFixed(2)}% of Sales
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
