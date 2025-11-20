import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer, Search } from "lucide-react";
import { ReturnToPOSButton } from "@/components/layout/ReturnToPOSButton";
import { formatCurrency } from "@/lib/utils";

export default function AccountsReceivable() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: receivables, isLoading } = useQuery({
    queryKey: ['accounts-receivable'],
    queryFn: async () => {
      const { data: contacts, error } = await supabase
        .from('contacts')
        .select(`
          id,
          name,
          phone,
          email,
          credit_limit,
          is_customer,
          is_supplier,
          customer_ledger_account_id,
          supplier_ledger_account_id
        `)
        .eq('is_customer', true)
        .order('name');

      if (error) throw error;

      // Calculate unified balance for each contact
      const contactsWithBalance = await Promise.all(
        contacts.map(async (contact) => {
          let totalBalance = 0;

          // Get customer ledger account balance directly
          if (contact.customer_ledger_account_id) {
            const { data: customerAccount } = await supabase
              .from('accounts')
              .select('current_balance')
              .eq('id', contact.customer_ledger_account_id)
              .single();

            if (customerAccount) {
              totalBalance = customerAccount.current_balance;
            }
          }

          // If also a supplier, subtract their supplier balance (we owe them)
          if (contact.is_supplier && contact.supplier_ledger_account_id) {
            const { data: supplierAccount } = await supabase
              .from('accounts')
              .select('current_balance')
              .eq('id', contact.supplier_ledger_account_id)
              .single();

            if (supplierAccount) {
              totalBalance -= supplierAccount.current_balance;
            }
          }

          return {
            id: contact.id,
            name: contact.name,
            phone: contact.phone,
            email: contact.email,
            credit_limit: contact.credit_limit || 0,
            balance: totalBalance,
            isUnified: contact.is_supplier
          };
        })
      );

      // Show all customers with non-zero balances (positive = they owe us, negative = we owe them)
      return contactsWithBalance.filter(c => c.balance !== 0);
    }
  });

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
            <Table>
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
