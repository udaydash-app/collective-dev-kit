import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAccountBalanceFromJournal } from "@/db/queries/accounting";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer, Search } from "lucide-react";
import { ReturnToPOSButton } from "@/components/layout/ReturnToPOSButton";
import { formatCurrency } from "@/lib/utils";
import { usePriceMasking } from "@/hooks/usePriceMasking";

export default function AccountsPayable() {
  const [searchTerm, setSearchTerm] = useState("");
  // F12 flips balances between masked (default) and real ledger, matching
  // the General Ledger so AR/AP figures agree with the supplier ledger.
  const { revealRealPrice, maskingEnabled } = usePriceMasking();
  const isRealLedger = revealRealPrice && maskingEnabled;

  const { data: payables, isLoading } = useQuery({
    queryKey: ['accounts-payable', isRealLedger],
    queryFn: async () => {
      const { data: contacts, error } = await supabase
        .from('contacts')
        .select(`
          id,
          name,
          phone,
          email,
          is_customer,
          is_supplier,
          customer_ledger_account_id,
          supplier_ledger_account_id
        `)
        .eq('is_supplier', true)
        .order('name');

      if (error) throw error;

      // Balances come from posted journal_entry_lines filtered by
      // is_real_ledger so AP totals stay in step with the General Ledger.
      const contactsWithBalance = await Promise.all(
        contacts.map(async (contact) => {
          // Supplier ledger is credit-normal; negate journal balance so a
          // positive number here means "we owe them".
          let totalBalance = 0;
          if (contact.supplier_ledger_account_id) {
            const supplierJournalBal = await fetchAccountBalanceFromJournal(
              contact.supplier_ledger_account_id,
              isRealLedger,
            );
            totalBalance += -supplierJournalBal;
          }
          if (contact.is_customer && contact.customer_ledger_account_id) {
            // Customer owes us (positive) reduces net payable.
            const customerJournalBal = await fetchAccountBalanceFromJournal(
              contact.customer_ledger_account_id,
              isRealLedger,
            );
            totalBalance -= customerJournalBal;
          }

          return {
            id: contact.id,
            name: contact.name,
            phone: contact.phone,
            email: contact.email,
            balance: totalBalance,
            isUnified: contact.is_customer
          };
        })
      );

      return contactsWithBalance.filter(c => c.balance > 0); // Positive balance in liability account means we owe them
    }
  });

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
