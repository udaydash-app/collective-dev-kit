import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, TrendingUp, TrendingDown, FileSpreadsheet, FileText } from 'lucide-react';
import { format, startOfYear, endOfYear } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type GroupBy = 'customer' | 'month' | 'year';

interface Row {
  key: string;
  label: string;
  sales: number;
  cost: number;
  profit: number;
  margin: number;
  units: number;
}

export default function ProfitLossAnalysis() {
  const navigate = useNavigate();
  const [groupBy, setGroupBy] = useState<GroupBy>('customer');
  const [startDate, setStartDate] = useState(format(startOfYear(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfYear(new Date()), 'yyyy-MM-dd'));

  const { data: rows, isLoading } = useQuery({
    queryKey: ['pl-analysis', groupBy, startDate, endDate],
    queryFn: async () => {
      const { data: txns, error } = await supabase
        .from('pos_transactions')
        .select('customer_id, items, created_at')
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59');
      if (error) throw error;

      // Collect product ids
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const productIds = new Set<string>();
      const customerIds = new Set<string>();
      for (const t of txns || []) {
        if (t.customer_id) customerIds.add(t.customer_id);
        const items = (t.items as any[]) || [];
        for (const it of items) {
          const pid = it.product_id || it.productId || it.id;
          if (pid && uuidRe.test(pid)) productIds.add(pid);
        }
      }

      const costMap: Record<string, number> = {};
      if (productIds.size > 0) {
        const { data: products } = await supabase
          .from('products')
          .select('id, cost_price')
          .in('id', Array.from(productIds));
        for (const p of products || []) costMap[p.id] = Number(p.cost_price) || 0;
      }

      const nameMap: Record<string, string> = {};
      if (customerIds.size > 0) {
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id, name')
          .in('id', Array.from(customerIds));
        for (const c of contacts || []) nameMap[c.id] = c.name;
      }

      const groups: Record<string, Row> = {};
      for (const t of txns || []) {
        const items = (t.items as any[]) || [];
        let txnSales = 0;
        let txnCost = 0;
        let txnUnits = 0;
        for (const it of items) {
          const pid = it.product_id || it.productId || it.id;
          const qty = Number(it.quantity) || 1;
          const unitPrice = Number(it.customPrice ?? it.price ?? it.unit_price ?? 0);
          const itemDiscount = Number(it.itemDiscount || it.discount || 0);
          const sale = (unitPrice - itemDiscount) * qty;
          const cost = (pid && uuidRe.test(pid) ? (costMap[pid] || 0) : 0) * qty;
          txnSales += sale;
          txnCost += cost;
          txnUnits += qty;
        }

        let key = '';
        let label = '';
        if (groupBy === 'customer') {
          key = t.customer_id || 'walkin';
          label = t.customer_id ? (nameMap[t.customer_id] || 'Unknown') : 'Walk-in Customer';
        } else if (groupBy === 'month') {
          key = format(new Date(t.created_at), 'yyyy-MM');
          label = format(new Date(t.created_at), 'MMMM yyyy');
        } else {
          key = format(new Date(t.created_at), 'yyyy');
          label = key;
        }

        if (!groups[key]) {
          groups[key] = { key, label, sales: 0, cost: 0, profit: 0, margin: 0, units: 0 };
        }
        groups[key].sales += txnSales;
        groups[key].cost += txnCost;
        groups[key].units += txnUnits;
      }

      const result = Object.values(groups).map((r) => {
        r.profit = r.sales - r.cost;
        r.margin = r.sales > 0 ? (r.profit / r.sales) * 100 : 0;
        return r;
      });

      result.sort((a, b) => {
        if (groupBy === 'customer') return b.profit - a.profit;
        return a.key.localeCompare(b.key);
      });
      return result;
    },
  });

  const totals = useMemo(() => {
    const t = (rows || []).reduce(
      (acc, r) => ({
        sales: acc.sales + r.sales,
        cost: acc.cost + r.cost,
        profit: acc.profit + r.profit,
        units: acc.units + r.units,
      }),
      { sales: 0, cost: 0, profit: 0, units: 0 },
    );
    return { ...t, margin: t.sales > 0 ? (t.profit / t.sales) * 100 : 0 };
  }, [rows]);

  const groupLabel = groupBy === 'customer' ? 'Customer' : groupBy === 'month' ? 'Month' : 'Year';

  const exportExcel = () => {
    const data = [
      ['PROFIT & LOSS ANALYSIS - BY ' + groupLabel.toUpperCase()],
      [`Period: ${format(new Date(startDate), 'dd/MM/yyyy')} to ${format(new Date(endDate), 'dd/MM/yyyy')}`],
      [],
      [groupLabel, 'Units Sold', 'Total Sales', 'Total Cost', 'Profit/Loss', 'Margin %'],
      ...((rows || []).map((r) => [r.label, r.units, r.sales, r.cost, r.profit, `${r.margin.toFixed(2)}%`])),
      [],
      ['TOTAL', totals.units, totals.sales, totals.cost, totals.profit, `${totals.margin.toFixed(2)}%`],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'P&L Analysis');
    XLSX.writeFile(wb, `PL_Analysis_${groupBy}_${startDate}_${endDate}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Profit & Loss Analysis - by ${groupLabel}`, 105, 15, { align: 'center' });
    doc.setFontSize(11);
    doc.text(
      `Period: ${format(new Date(startDate), 'dd/MM/yyyy')} to ${format(new Date(endDate), 'dd/MM/yyyy')}`,
      105, 23, { align: 'center' },
    );
    autoTable(doc, {
      startY: 30,
      head: [[groupLabel, 'Units', 'Sales', 'Cost', 'Profit/Loss', 'Margin %']],
      body: (rows || []).map((r) => [
        r.label,
        r.units.toString(),
        formatCurrency(r.sales),
        formatCurrency(r.cost),
        formatCurrency(r.profit),
        `${r.margin.toFixed(2)}%`,
      ]),
      foot: [[
        'TOTAL',
        totals.units.toString(),
        formatCurrency(totals.sales),
        formatCurrency(totals.cost),
        formatCurrency(totals.profit),
        `${totals.margin.toFixed(2)}%`,
      ]],
      theme: 'striped',
      headStyles: { fillColor: [34, 197, 94] },
      footStyles: { fillColor: [34, 197, 94], textColor: [255, 255, 255] },
      styles: { fontSize: 9 },
    });
    doc.save(`PL_Analysis_${groupBy}_${startDate}_${endDate}.pdf`);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Profit & Loss Analysis</h1>
            <p className="text-muted-foreground text-sm">
              Group profitability by customer, month, or year
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-2">
                <Label>Group By</Label>
                <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                    <SelectItem value="year">Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportExcel}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
                </Button>
                <Button variant="outline" size="sm" onClick={exportPDF}>
                  <FileText className="h-4 w-4 mr-2" /> PDF
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Sales</div>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(totals.sales)}</div>
          </CardContent></Card>
          <Card><CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Cost</div>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(totals.cost)}</div>
          </CardContent></Card>
          <Card className={totals.profit >= 0 ? 'border-green-200' : 'border-red-200'}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                {totals.profit >= 0 ? <TrendingUp className="h-4 w-4 text-green-600" /> : <TrendingDown className="h-4 w-4 text-red-600" />}
                <span className="text-sm text-muted-foreground">{totals.profit >= 0 ? 'Profit' : 'Loss'}</span>
              </div>
              <div className={`text-2xl font-bold ${totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(Math.abs(totals.profit))}
              </div>
            </CardContent>
          </Card>
          <Card><CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Margin</div>
            <div className={`text-2xl font-bold ${totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totals.margin.toFixed(2)}%
            </div>
          </CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Breakdown by {groupLabel}</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : rows && rows.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{groupLabel}</TableHead>
                      <TableHead className="text-right">Units</TableHead>
                      <TableHead className="text-right">Sales</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Profit/Loss</TableHead>
                      <TableHead className="text-right">Margin %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.key}>
                        <TableCell className="font-medium">{r.label}</TableCell>
                        <TableCell className="text-right">{r.units}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.sales)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.cost)}</TableCell>
                        <TableCell className={`text-right font-medium ${r.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(r.profit)}
                        </TableCell>
                        <TableCell className={`text-right ${r.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {r.margin.toFixed(2)}%
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell>TOTAL</TableCell>
                      <TableCell className="text-right">{totals.units}</TableCell>
                      <TableCell className="text-right">{formatCurrency(totals.sales)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(totals.cost)}</TableCell>
                      <TableCell className={`text-right ${totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(totals.profit)}
                      </TableCell>
                      <TableCell className={`text-right ${totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {totals.margin.toFixed(2)}%
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                No sales data for the selected period.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}