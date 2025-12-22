import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarIcon, ArrowLeft, FileSpreadsheet, FileText, TrendingUp, TrendingDown } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfYear, subMonths } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SalesReportItem {
  productId: string;
  productName: string;
  unitsSold: number;
  costPrice: number;
  salePrice: number;
  profitLoss: number;
  profitLossPercentage: number;
}

export default function TradingAccount() {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));

  // Fetch sales data with product details
  const { data: salesReport, isLoading } = useQuery({
    queryKey: ['sales-report', startDate, endDate],
    queryFn: async () => {
      // Fetch all POS transactions in the date range
      const { data: transactions, error } = await supabase
        .from('pos_transactions')
        .select('items')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) throw error;

      // Aggregate sales by product
      const productSales: Record<string, { 
        productId: string;
        productName: string; 
        unitsSold: number; 
        totalSaleAmount: number;
      }> = {};

      for (const transaction of transactions || []) {
        const items = transaction.items as any[];
        if (Array.isArray(items)) {
          for (const item of items) {
            const productId = item.product_id || item.productId || item.id;
            const productName = item.name || item.product_name || 'Unknown Product';
            const quantity = item.quantity || 1;
            const unitPrice = item.price || item.unit_price || 0;

            if (!productSales[productId]) {
              productSales[productId] = {
                productId,
                productName,
                unitsSold: 0,
                totalSaleAmount: 0,
              };
            }

            productSales[productId].unitsSold += quantity;
            productSales[productId].totalSaleAmount += unitPrice * quantity;
          }
        }
      }

      // Fetch cost prices from products table
      // Filter out invalid UUIDs (like "cart-discount")
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const validProductIds = Object.keys(productSales).filter(id => uuidRegex.test(id));
      
      if (validProductIds.length === 0) return [];

      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, cost_price')
        .in('id', validProductIds);

      if (productsError) throw productsError;

      // Create a map of product id to cost price
      const costPriceMap: Record<string, number> = {};
      for (const product of products || []) {
        costPriceMap[product.id] = product.cost_price || 0;
      }

      // Convert to array and calculate profit/loss
      const reportItems: SalesReportItem[] = Object.values(productSales).map(item => {
        const costPrice = costPriceMap[item.productId] || 0;
        const totalCost = costPrice * item.unitsSold;
        const profitLoss = item.totalSaleAmount - totalCost;
        const profitLossPercentage = totalCost > 0 ? (profitLoss / totalCost) * 100 : 0;

        return {
          productId: item.productId,
          productName: item.productName,
          unitsSold: item.unitsSold,
          costPrice: costPrice,
          salePrice: item.unitsSold > 0 ? item.totalSaleAmount / item.unitsSold : 0,
          profitLoss,
          profitLossPercentage,
        };
      });

      // Sort by units sold descending
      return reportItems.sort((a, b) => b.unitsSold - a.unitsSold);
    },
  });

  // Calculate totals
  const totals = salesReport?.reduce(
    (acc, item) => ({
      totalUnits: acc.totalUnits + item.unitsSold,
      totalCost: acc.totalCost + (item.costPrice * item.unitsSold),
      totalSales: acc.totalSales + (item.salePrice * item.unitsSold),
      totalProfitLoss: acc.totalProfitLoss + item.profitLoss,
    }),
    { totalUnits: 0, totalCost: 0, totalSales: 0, totalProfitLoss: 0 }
  ) || { totalUnits: 0, totalCost: 0, totalSales: 0, totalProfitLoss: 0 };

  const overallProfitLossPercentage = totals.totalCost > 0 
    ? (totals.totalProfitLoss / totals.totalCost) * 100 
    : 0;

  const exportToExcel = () => {
    const data = [
      ['SALES REPORT'],
      [`Period: ${format(startDate, 'dd/MM/yyyy')} to ${format(endDate, 'dd/MM/yyyy')}`],
      [],
      ['Product Name', 'Units Sold', 'Cost Price', 'Sale Price', 'Profit/Loss', 'P/L %'],
      ...(salesReport?.map(item => [
        item.productName,
        item.unitsSold,
        item.costPrice,
        item.salePrice,
        item.profitLoss,
        `${item.profitLossPercentage.toFixed(2)}%`,
      ]) || []),
      [],
      ['TOTAL', totals.totalUnits, '', '', totals.totalProfitLoss, `${overallProfitLossPercentage.toFixed(2)}%`],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Report');
    XLSX.writeFile(wb, `Sales_Report_${format(startDate, 'yyyyMMdd')}_${format(endDate, 'yyyyMMdd')}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('SALES REPORT', 105, 15, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Period: ${format(startDate, 'dd/MM/yyyy')} to ${format(endDate, 'dd/MM/yyyy')}`, 105, 25, { align: 'center' });

    const tableData = salesReport?.map(item => [
      item.productName,
      item.unitsSold.toString(),
      formatCurrency(item.costPrice),
      formatCurrency(item.salePrice),
      formatCurrency(item.profitLoss),
      `${item.profitLossPercentage.toFixed(2)}%`,
    ]) || [];

    autoTable(doc, {
      startY: 35,
      head: [['Product Name', 'Units Sold', 'Cost Price', 'Sale Price', 'Profit/Loss', 'P/L %']],
      body: tableData,
      foot: [['TOTAL', totals.totalUnits.toString(), '', '', formatCurrency(totals.totalProfitLoss), `${overallProfitLossPercentage.toFixed(2)}%`]],
      theme: 'striped',
      headStyles: { fillColor: [34, 197, 94] },
      footStyles: { fillColor: [34, 197, 94], textColor: [255, 255, 255] },
      styles: { fontSize: 9 },
    });

    doc.save(`Sales_Report_${format(startDate, 'yyyyMMdd')}_${format(endDate, 'yyyyMMdd')}.pdf`);
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
              <h1 className="text-2xl font-bold">Sales Report</h1>
              <p className="text-muted-foreground text-sm">Product-wise sales and profit analysis</p>
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

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Total Units Sold</div>
              <div className="text-2xl font-bold">{totals.totalUnits}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Total Cost</div>
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(totals.totalCost)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Total Sales</div>
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(totals.totalSales)}</div>
            </CardContent>
          </Card>
          <Card className={totals.totalProfitLoss >= 0 ? 'border-green-200 bg-green-50/50 dark:bg-green-900/10' : 'border-red-200 bg-red-50/50 dark:bg-red-900/10'}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                {totals.totalProfitLoss >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm text-muted-foreground">
                  {totals.totalProfitLoss >= 0 ? 'Profit' : 'Loss'}
                </span>
              </div>
              <div className={`text-2xl font-bold ${totals.totalProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(Math.abs(totals.totalProfitLoss))}
              </div>
              <div className={`text-sm ${totals.totalProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {Math.abs(overallProfitLossPercentage).toFixed(2)}%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sales Report Table */}
        <Card>
          <CardHeader>
            <CardTitle>Product Sales Details</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : salesReport && salesReport.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product Name</TableHead>
                      <TableHead className="text-right">Units Sold</TableHead>
                      <TableHead className="text-right">Cost Price</TableHead>
                      <TableHead className="text-right">Sale Price</TableHead>
                      <TableHead className="text-right">Profit/Loss</TableHead>
                      <TableHead className="text-right">P/L %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesReport.map((item) => (
                      <TableRow key={item.productId}>
                        <TableCell className="font-medium">{item.productName}</TableCell>
                        <TableCell className="text-right">{item.unitsSold}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.costPrice)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.salePrice)}</TableCell>
                        <TableCell className={`text-right font-medium ${item.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(item.profitLoss)}
                        </TableCell>
                        <TableCell className={`text-right ${item.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {item.profitLossPercentage.toFixed(2)}%
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totals Row */}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell>TOTAL</TableCell>
                      <TableCell className="text-right">{totals.totalUnits}</TableCell>
                      <TableCell className="text-right"></TableCell>
                      <TableCell className="text-right"></TableCell>
                      <TableCell className={`text-right ${totals.totalProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(totals.totalProfitLoss)}
                      </TableCell>
                      <TableCell className={`text-right ${totals.totalProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {overallProfitLossPercentage.toFixed(2)}%
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                No sales data found for the selected period.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
