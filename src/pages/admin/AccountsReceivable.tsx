import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchReceivablesLocal } from "@/db/queries/accounting";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer, Search } from "lucide-react";
import { ReturnToPOSButton } from "@/components/layout/ReturnToPOSButton";
import { formatCurrency } from "@/lib/utils";
import { useFiscalPeriod } from "@/contexts/FiscalPeriodContext";

export default function AccountsReceivable() {
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();
  const fiscalPeriod = useFiscalPeriod();
  const asOfDate = fiscalPeriod.effectiveTo ?? new Date().toISOString().split('T')[0];

  const { data: receivables, isLoading } = useQuery({
    queryKey: ['accounts-receivable', asOfDate],
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    queryFn: async () => {
      try {
        return await fetchReceivablesLocal({ asOf: asOfDate });
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
    </div>
  );
}
