import { useEffect, useState, Fragment } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchReceivablesLocal } from "@/db/queries/accounting";
import { fetchReceivablesAging, BUCKET_LABELS, type BucketKey } from "@/db/queries/arAging";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight, FileSpreadsheet, Printer, Search } from "lucide-react";
import { ReturnToPOSButton } from "@/components/layout/ReturnToPOSButton";
import { formatCurrency, formatDate } from "@/lib/utils";
import * as XLSX from "xlsx";
import { toast } from "sonner";

const BUCKET_KEYS: BucketKey[] = ["current", "b30", "b60", "b90", "b90plus"];

export default function AccountsReceivable() {
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();

  const { data: receivables, isLoading } = useQuery({
    queryKey: ['accounts-receivable', 'till-date'],
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    queryFn: async () => {
      try {
        // Always till-date — outstanding receivables are cumulative and
        // must ignore the active fiscal period filter.
        return await fetchReceivablesLocal({ asOf: null });
      } catch (e) {
        console.warn('[receivables] balance fetch failed', e);
        throw e;
      }
    }
  });

  // Keep AR in sync with General Ledger in real time: any change to
  // journal_entry_lines, journal_entries, or contacts invalidates the query.
  useEffect(() => {
    const channel = supabase
      .channel('ar-ledger-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'journal_entry_lines' }, () => {
        queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'journal_entries' }, () => {
        queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => {
        queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const filteredReceivables = receivables?.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalReceivable = receivables?.filter(r => r.balance > 0).reduce((sum, r) => sum + Number(r.balance), 0) || 0;
  const totalPayable = Math.abs(receivables?.filter(r => r.balance < 0).reduce((sum, r) => sum + Number(r.balance), 0) || 0);
  const netBalance = totalReceivable - totalPayable;

  const handlePrint = () => {
    window.print();
  };

  // ----- Aging -----
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [agingSearch, setAgingSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: aging, isLoading: agingLoading } = useQuery({
    queryKey: ['ar-aging', asOf],
    staleTime: 0,
    queryFn: () => fetchReceivablesAging(asOf),
  });

  const agingRows = (aging?.rows ?? []).filter(r =>
    r.name.toLowerCase().includes(agingSearch.toLowerCase()) ||
    (r.phone ?? '').toLowerCase().includes(agingSearch.toLowerCase())
  );

  const exportAging = () => {
    if (!aging || aging.rows.length === 0) return;
    const summary = aging.rows.map(r => ({
      Customer: r.name,
      Phone: r.phone || '',
      'Last Bill Date': r.lastBillDate ? formatDate(r.lastBillDate) : '',
      'Days Since Last Bill': r.daysSinceLastBill ?? '',
      'Last Payment Date': r.lastPaymentDate ? formatDate(r.lastPaymentDate) : 'No payment',
      'Days Since Last Payment': r.daysSinceLastPayment ?? '',
      Current: r.buckets.current,
      '1-30 days': r.buckets.b30,
      '31-60 days': r.buckets.b60,
      '61-90 days': r.buckets.b90,
      '90+ days': r.buckets.b90plus,
      Total: r.total,
    }));
    const detail = aging.rows.flatMap(r =>
      r.docs.map(d => ({
        Customer: r.name,
        Date: d.date ? formatDate(d.date) : 'Opening balance',
        Reference: d.reference,
        Description: d.description,
        Days: d.date ? d.days : '',
        Bucket: BUCKET_LABELS[d.bucket],
        Balance: d.amount,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Aging Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), 'Aging Detail');
    XLSX.writeFile(wb, `ar-aging-${asOf}.xlsx`);
    toast.success('Aging report exported');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center no-print">
        <div>
          <h1 className="text-3xl font-bold">Accounts Receivable</h1>
          <p className="text-muted-foreground">Customer outstanding balances</p>
        </div>
        <div className="flex items-center gap-2">
          <ReturnToPOSButton />
          <Button onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print Report
          </Button>
        </div>
      </div>

      <Tabs defaultValue="balances" className="space-y-6">
        <TabsList className="no-print">
          <TabsTrigger value="balances">Balances</TabsTrigger>
          <TabsTrigger value="aging">Aging</TabsTrigger>
        </TabsList>

        <TabsContent value="balances" className="space-y-6">
      <Card className="no-print">
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Customers</p>
              <p className="text-2xl font-bold">{receivables?.length || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Receivable (They Owe Us)</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalReceivable)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Payable (We Owe Them)</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(totalPayable)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Net Balance</p>
              <p className={`text-2xl font-bold ${netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(netBalance)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between no-print">
            <CardTitle>Customer Balances</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredReceivables && filteredReceivables.length > 0 ? (
            <Table fixedScroll>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Credit Limit</TableHead>
                  <TableHead className="text-right">Outstanding Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReceivables.map((receivable) => (
                  <TableRow key={receivable.id}>
                    <TableCell className="font-medium">
                      {receivable.name}
                      {receivable.isUnified && (
                        <span className="ml-2 text-xs text-muted-foreground">(Dual Role)</span>
                      )}
                    </TableCell>
                    <TableCell>{receivable.phone || '-'}</TableCell>
                    <TableCell>{receivable.email || '-'}</TableCell>
                    <TableCell className="text-right">{formatCurrency(receivable.credit_limit)}</TableCell>
                    <TableCell className={`text-right font-semibold ${receivable.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {receivable.balance >= 0 ? formatCurrency(receivable.balance) : `(${formatCurrency(Math.abs(receivable.balance))})`}
                      <span className="ml-1 text-xs text-muted-foreground block">
                        {receivable.balance >= 0 ? 'Receivable' : 'Payable'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold">
                  <TableCell colSpan={4} className="text-right">Net Balance:</TableCell>
                  <TableCell className={`text-right ${netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(netBalance)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No outstanding receivables found
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="aging" className="space-y-6">
          <Card className="no-print">
            <CardContent className="p-5 grid gap-4 md:grid-cols-3 items-end">
              <div className="space-y-2">
                <Label>As of</Label>
                <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Search customer</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search customers..."
                    value={agingSearch}
                    onChange={(e) => setAgingSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={exportAging} disabled={!aging || aging.rows.length === 0}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
                <Button variant="outline" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 grid-cols-2 md:grid-cols-6">
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total outstanding</p>
              <p className="text-lg font-bold">{formatCurrency(aging?.totals.total ?? 0)}</p>
            </CardContent></Card>
            {BUCKET_KEYS.map((k) => (
              <Card key={k}><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{BUCKET_LABELS[k]}</p>
                <p className={`text-lg font-bold ${k === 'b90plus' ? 'text-red-600' : k === 'b60' || k === 'b90' ? 'text-amber-600' : ''}`}>
                  {formatCurrency(aging?.totals[k] ?? 0)}
                </p>
              </CardContent></Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Aging by customer</CardTitle>
            </CardHeader>
            <CardContent>
              {agingLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : agingRows.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No outstanding receivables as of {formatDate(asOf)}</div>
              ) : (
                <Table fixedScroll>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead className="whitespace-nowrap">Last Bill</TableHead>
                      <TableHead className="whitespace-nowrap">Last Payment</TableHead>
                      {BUCKET_KEYS.map((k) => (
                        <TableHead key={k} className="text-right">{BUCKET_LABELS[k]}</TableHead>
                      ))}
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agingRows.map((r) => (
                      <Fragment key={r.contact_id}>
                        <TableRow
                          className="cursor-pointer"
                          onClick={() => setExpanded((p) => ({ ...p, [r.contact_id]: !p[r.contact_id] }))}
                        >
                          <TableCell className="font-medium">
                            <span className="inline-flex items-center gap-1">
                              {expanded[r.contact_id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              {r.name}
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {r.lastBillDate ? formatDate(r.lastBillDate) : '-'}
                            {r.daysSinceLastBill !== null && (
                              <span className="block text-xs text-muted-foreground">
                                {r.daysSinceLastBill <= 0 ? 'Today' : `${r.daysSinceLastBill} days ago`}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {r.lastPaymentDate ? formatDate(r.lastPaymentDate) : <span className="text-red-600">No payment</span>}
                            {r.daysSinceLastPayment !== null && (
                              <span className="block text-xs text-muted-foreground">
                                {r.daysSinceLastPayment <= 0 ? 'Today' : `${r.daysSinceLastPayment} days ago`}
                              </span>
                            )}
                          </TableCell>
                          {BUCKET_KEYS.map((k) => (
                            <TableCell key={k} className="text-right">
                              {r.buckets[k] > 0 ? formatCurrency(r.buckets[k]) : '-'}
                            </TableCell>
                          ))}
                          <TableCell className="text-right font-semibold">{formatCurrency(r.total)}</TableCell>
                        </TableRow>
                        {expanded[r.contact_id] && r.docs.map((d) => (
                          <TableRow key={d.id} className="text-sm bg-muted/30">
                            <TableCell className="pl-10">
                              {d.reference}
                              <span className="block text-xs text-muted-foreground">
                                {d.date ? `${formatDate(d.date)} · ${d.days <= 0 ? 'Current' : `${d.days} days`}` : 'Opening balance'}
                              </span>
                            </TableCell>
                            <TableCell colSpan={6} className="text-muted-foreground">{d.description}</TableCell>
                            <TableCell className="text-right">{BUCKET_LABELS[d.bucket]}</TableCell>
                            <TableCell className="text-right">{formatCurrency(d.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </Fragment>
                    ))}
                    <TableRow className="font-bold">
                      <TableCell colSpan={3}>Total</TableCell>
                      {BUCKET_KEYS.map((k) => (
                        <TableCell key={k} className="text-right">{formatCurrency(aging?.totals[k] ?? 0)}</TableCell>
                      ))}
                      <TableCell className="text-right">{formatCurrency(aging?.totals.total ?? 0)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
