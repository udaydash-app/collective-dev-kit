import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, startOfDay, endOfDay } from 'date-fns';
import { CalendarIcon, Search, FileSpreadsheet, AlertTriangle, Package, ExternalLink, X, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { usePageView } from '@/hooks/useAnalytics';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

interface DamageRecord {
  id: string;
  reference: string;
  created_at: string;
  quantity_change: number;
  unit_cost: number;
  total_value: number;
  reason: string | null;
  product_id: string | null;
  variant_id: string | null;
  store_id: string | null;
  adjusted_by: string | null;
  product_name: string | null;
  variant_label: string | null;
  store_name: string | null;
}

export default function DamageRecords() {
  usePageView('Admin - Damage Records');
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  const { data: stores } = useQuery({
    queryKey: ['damage-stores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: damageRecords, isLoading } = useQuery({
    queryKey: ['damage-records', selectedStoreId, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('stock_adjustments')
        .select(`
          id,
          created_at,
          quantity_change,
          unit_cost,
          total_value,
          reason,
          product_id,
          variant_id,
          store_id,
          adjusted_by,
          products!inner(name),
          product_variants(label),
          stores!inner(name)
        `)
        .eq('adjustment_type', 'damage')
        .order('created_at', { ascending: false });

      if (selectedStoreId && selectedStoreId !== 'all') {
        query = query.eq('store_id', selectedStoreId);
      }
      if (startDate) {
        query = query.gte('created_at', startOfDay(startDate).toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', endOfDay(endDate).toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((row: any): DamageRecord => ({
        id: row.id,
        reference: `DMG-${row.id.replace(/-/g, '').substring(0, 10).toUpperCase()}`,
        created_at: row.created_at,
        quantity_change: row.quantity_change,
        unit_cost: row.unit_cost,
        total_value: row.total_value,
        reason: row.reason,
        product_id: row.product_id,
        variant_id: row.variant_id,
        store_id: row.store_id,
        adjusted_by: row.adjusted_by,
        product_name: row.products?.name || null,
        variant_label: row.product_variants?.label || null,
        store_name: row.stores?.name || null,
      }));
    },
  });

  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return damageRecords || [];
    const q = searchQuery.trim().toLowerCase();
    return (damageRecords || []).filter(
      (r) =>
        r.reference.toLowerCase().includes(q) ||
        (r.product_name || '').toLowerCase().includes(q) ||
        (r.variant_label || '').toLowerCase().includes(q) ||
        (r.reason || '').toLowerCase().includes(q) ||
        (r.store_name || '').toLowerCase().includes(q)
    );
  }, [damageRecords, searchQuery]);

  const totalValue = useMemo(
    () => filteredRecords.reduce((sum, r) => sum + (r.total_value || 0), 0),
    [filteredRecords]
  );

  const exportToExcel = () => {
    if (!filteredRecords.length) {
      toast.warning('No damage records to export');
      return;
    }

    const rows = filteredRecords.map((r) => ({
      Reference: r.reference,
      Date: formatDate(new Date(r.created_at)),
      Store: r.store_name || '',
      Product: r.product_name || '',
      Variant: r.variant_label || '',
      Quantity: Math.abs(r.quantity_change),
      'Unit Cost': r.unit_cost,
      'Total Value': r.total_value,
      Reason: r.reason || '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Damage Records');
    XLSX.writeFile(wb, `damage-records-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Damage records exported to Excel');
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedStoreId('all');
    setStartDate(undefined);
    setEndDate(undefined);
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
              Damage Records
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              View all stock damage adjustments and their linked journal entries.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={exportToExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
            <Button variant="outline" onClick={() => navigate('/admin/journal-entries')}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Journal Entries
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search reference, product, reason..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All stores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stores</SelectItem>
                {stores?.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-[160px] justify-start text-left font-normal', !startDate && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, 'PP') : 'Start date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-[160px] justify-start text-left font-normal', !endDate && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, 'PP') : 'End date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
              </PopoverContent>
            </Popover>

            {(searchQuery || selectedStoreId !== 'all' || startDate || endDate) && (
              <Button variant="ghost" onClick={clearFilters}>
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
            )}
          </div>

          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Total Records</p>
                <p className="text-2xl font-bold">{filteredRecords.length}</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Total Damage Value</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(totalValue)}</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Total Quantity</p>
                <p className="text-2xl font-bold">
                  {filteredRecords.reduce((sum, r) => sum + Math.abs(r.quantity_change), 0)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Table */}
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      Loading damage records...
                    </TableCell>
                  </TableRow>
                ) : filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      No damage records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.reference}</TableCell>
                      <TableCell>{formatDate(new Date(record.created_at))}</TableCell>
                      <TableCell>{record.store_name || '-'}</TableCell>
                      <TableCell>{record.product_name || '-'}</TableCell>
                      <TableCell>{record.variant_label || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="destructive">{Math.abs(record.quantity_change)}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(record.unit_cost)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(record.total_value)}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={record.reason || ''}>
                        {record.reason || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/admin/journal-entries?search=${record.reference}`)}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          JE
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate('/admin/general-ledger')}
                        >
                          <BookOpen className="h-4 w-4 mr-1" />
                          GL
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
