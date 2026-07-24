import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchPayablesLocal } from "@/db/queries/accounting";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer, Search } from "lucide-react";
import { ReturnToPOSButton } from "@/components/layout/ReturnToPOSButton";
import { formatCurrency } from "@/lib/utils";

export default function AccountsPayable() {
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();

  const { data: payables, isLoading } = useQuery({
    queryKey: ['accounts-payable', 'till-date'],
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    queryFn: async () => {
      try {
        // Always till-date — outstanding payables are cumulative and must
        // ignore the active fiscal period filter.
        return await fetchPayablesLocal({ asOf: null });
      } catch (e) {
        console.warn('[payables] balance fetch failed', e);
        throw e;
      }
    }
  });

  useEffect(() => {
    const channel = supabase
      .channel('ap-ledger-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'journal_entry_lines' }, () => {
        queryClient.invalidateQueries({ queryKey: ['accounts-payable'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'journal_entries' }, () => {
        queryClient.invalidateQueries({ queryKey: ['accounts-payable'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => {
        queryClient.invalidateQueries({ queryKey: ['accounts-payable'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const filteredPayables = payables?.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalOutstanding = payables?.reduce((sum, p) => sum + Number(p.balance), 0) || 0;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center no-print">
        <div>
          <h1 className="text-3xl font-bold">Accounts Payable</h1>
          <p className="text-muted-foreground">Supplier outstanding balances</p>
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
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Total Suppliers with Outstanding</p>
              <p className="text-2xl font-bold">{payables?.length || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Outstanding Amount</p>
              <p className="text-2xl font-bold text-destructive">{formatCurrency(totalOutstanding)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between no-print">
            <CardTitle>Supplier Balances</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search suppliers..."
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
          ) : filteredPayables && filteredPayables.length > 0 ? (
            <Table fixedScroll>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Outstanding Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayables.map((payable) => (
                  <TableRow key={payable.id}>
                    <TableCell className="font-medium">
                      {payable.name}
                      {payable.isUnified && (
                        <span className="ml-2 text-xs text-muted-foreground">(Unified)</span>
                      )}
                    </TableCell>
                    <TableCell>{payable.phone || '-'}</TableCell>
                    <TableCell>{payable.email || '-'}</TableCell>
                    <TableCell className="text-right font-semibold text-destructive">
                      {formatCurrency(payable.balance)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold">
                  <TableCell colSpan={3} className="text-right">Total Outstanding:</TableCell>
                  <TableCell className="text-right text-destructive">
                    {formatCurrency(totalOutstanding)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No outstanding payables found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
