import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import { FileText, Download, Printer, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { ReturnToPOSButton } from '@/components/layout/ReturnToPOSButton';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

export default function TaxCollectionReport() {
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
    queryKey: ['tax-collection-report', selectedStoreId, startDate, endDate],
    queryFn: async () => {
      if (!selectedStoreId || !startDate || !endDate) return null;

      // Fetch POS transactions with tax data
      const { data: transactions } = await supabase
        .from('pos_transactions')
        .select('id, transaction_number, total, tax, metadata, created_at')
        .eq('store_id', selectedStoreId)
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`)
        .order('created_at', { ascending: false });

      // Calculate totals
      let totalRegularTax = 0;
      let totalTimbreTax = 0;
      let transactionCount = 0;

      const taxDetails: {
        id: string;
        transaction_number: string;
        date: string;
        total: number;
        regularTax: number;
        timbreTax: number;
        totalTax: number;
      }[] = [];

      transactions?.forEach((t: any) => {
        const regularTax = parseFloat(t.tax?.toString() || '0');
        const metadata = t.metadata || {};
        const timbreTax = parseFloat(metadata.timbreTax?.toString() || '0');
        
        totalRegularTax += regularTax;
        totalTimbreTax += timbreTax;
        transactionCount++;

        if (regularTax > 0 || timbreTax > 0) {
          taxDetails.push({
            id: t.id,
            transaction_number: t.transaction_number,
            date: t.created_at,
            total: parseFloat(t.total?.toString() || '0'),
            regularTax,
            timbreTax,
            totalTax: regularTax + timbreTax,
          });
        }
      });

      return {
        totalRegularTax,
        totalTimbreTax,
        totalTax: totalRegularTax + totalTimbreTax,
        transactionCount,
        taxDetails,
      };
    },
    enabled: showReport && !!selectedStoreId,
  });

  const handleGenerateReport = () => {
    if (!selectedStoreId) {
      toast.error('Please select a store');
      return;
    }
    setShowReport(true);
    refetch();
  };

  const handleExport = () => {
    if (!reportData?.taxDetails) return;

    const exportData = reportData.taxDetails.map(item => ({
      'Transaction #': item.transaction_number,
      'Date': format(new Date(item.date), 'dd/MM/yyyy HH:mm'),
      'Bill Amount': item.total,
      'Regular Tax': item.regularTax,
      'Timbre Tax': item.timbreTax,
      'Total Tax': item.totalTax,
    }));

    // Add summary row
    exportData.push({
      'Transaction #': 'TOTAL',
      'Date': '',
      'Bill Amount': reportData.taxDetails.reduce((sum, d) => sum + d.total, 0),
      'Regular Tax': reportData.totalRegularTax,
      'Timbre Tax': reportData.totalTimbreTax,
      'Total Tax': reportData.totalTax,
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tax Collection');
    XLSX.writeFile(workbook, `Tax_Collection_Report_${startDate}_to_${endDate}.xlsx`);
    toast.success('Report exported successfully');
  };

  const handlePrint = () => {
    window.print();
  };

  const selectedStore = stores?.find(s => s.id === selectedStoreId);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 print:p-0">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <Receipt className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Tax Collection Report</h1>
              <p className="text-muted-foreground">View tax collected for a given period</p>
            </div>
          </div>
          <ReturnToPOSButton />
        </div>

        {/* Filters */}
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Report Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Store</Label>
                <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select store" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores?.map(store => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleGenerateReport} className="w-full">
                  Generate Report
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        {showReport && reportData && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Total Transactions</p>
                    <p className="text-2xl font-bold">{reportData.transactionCount}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Regular Tax (15%)</p>
                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(reportData.totalRegularTax)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Timbre Tax</p>
                    <p className="text-2xl font-bold text-orange-600">{formatCurrency(reportData.totalTimbreTax)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-primary/10">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Total Tax Collected</p>
                    <p className="text-2xl font-bold text-primary">{formatCurrency(reportData.totalTax)}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 print:hidden">
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export to Excel
              </Button>
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
            </div>

            {/* Print Header */}
            <div className="hidden print:block mb-6">
              <h1 className="text-2xl font-bold text-center">Tax Collection Report</h1>
              <p className="text-center text-muted-foreground">
                {selectedStore?.name} | {format(new Date(startDate), 'dd/MM/yyyy')} - {format(new Date(endDate), 'dd/MM/yyyy')}
              </p>
            </div>

            {/* Tax Details Table */}
            <Card>
              <CardHeader>
                <CardTitle>Transaction Details</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-center py-4">Loading...</p>
                ) : reportData.taxDetails.length === 0 ? (
                  <p className="text-center py-4 text-muted-foreground">No tax collected in this period</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Transaction #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Bill Amount</TableHead>
                        <TableHead className="text-right">Regular Tax</TableHead>
                        <TableHead className="text-right">Timbre Tax</TableHead>
                        <TableHead className="text-right">Total Tax</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.taxDetails.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.transaction_number}</TableCell>
                          <TableCell>{format(new Date(item.date), 'dd/MM/yyyy HH:mm')}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.regularTax)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.timbreTax)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(item.totalTax)}</TableCell>
                        </TableRow>
                      ))}
                      {/* Summary Row */}
                      <TableRow className="font-bold bg-muted/50">
                        <TableCell colSpan={2}>TOTAL</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(reportData.taxDetails.reduce((sum, d) => sum + d.total, 0))}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(reportData.totalRegularTax)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(reportData.totalTimbreTax)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(reportData.totalTax)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
