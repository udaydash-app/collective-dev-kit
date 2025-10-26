import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Download } from 'lucide-react';
import { usePageView } from '@/hooks/useAnalytics';
import { formatCurrency } from '@/lib/utils';

export default function GeneralLedger() {
  usePageView('Admin - General Ledger');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: accounts } = useQuery({
    queryKey: ['accounts-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true)
        .order('account_code');
      if (error) throw error;
      return data;
    },
  });

  const { data: ledgerData, isLoading } = useQuery({
    queryKey: ['general-ledger', selectedAccount, startDate, endDate],
    queryFn: async () => {
      if (!selectedAccount) return null;

      // Get journal entry lines for the selected account
      const { data: lines, error } = await supabase
        .from('journal_entry_lines')
        .select(`
          *,
          journal_entries!inner (
            entry_number,
            entry_date,
            description,
            reference,
            status
          )
        `)
        .eq('account_id', selectedAccount)
        .eq('journal_entries.status', 'posted')
        .gte('journal_entries.entry_date', startDate)
        .lte('journal_entries.entry_date', endDate)
        .order('journal_entries.entry_date', { ascending: true });

      if (error) throw error;

      // Get account details
      const { data: account } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', selectedAccount)
        .single();

      return { lines, account };
    },
    enabled: !!selectedAccount,
  });

  const calculateRunningBalance = () => {
    if (!ledgerData?.lines || !ledgerData?.account) return [];

    let balance = 0;
    const accountType = ledgerData.account.account_type;
    
    return ledgerData.lines.map((line: any) => {
      // For assets and expenses: debit increases, credit decreases
      // For liabilities, equity, and revenue: credit increases, debit decreases
      if (['asset', 'expense'].includes(accountType)) {
        balance += line.debit_amount - line.credit_amount;
      } else {
        balance += line.credit_amount - line.debit_amount;
      }

      return {
        ...line,
        running_balance: balance,
      };
    });
  };

  const ledgerEntries = calculateRunningBalance();

  const totalDebit = ledgerData?.lines?.reduce(
    (sum: number, line: any) => sum + line.debit_amount,
    0
  ) || 0;

  const totalCredit = ledgerData?.lines?.reduce(
    (sum: number, line: any) => sum + line.credit_amount,
    0
  ) || 0;

  const netChange = totalDebit - totalCredit;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BookOpen className="h-8 w-8" />
            General Ledger
          </h1>
          <p className="text-muted-foreground">
            View detailed transaction history by account
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <Label htmlFor="account">Account *</Label>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger id="account">
                <SelectValue placeholder="Select an account" />
              </SelectTrigger>
              <SelectContent>
                {accounts?.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.account_code} - {account.account_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="start-date">Start Date</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="end-date">End Date</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Account Summary */}
      {ledgerData?.account && (
        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Account</p>
              <p className="text-lg font-bold">
                {ledgerData.account.account_code} - {ledgerData.account.account_name}
              </p>
              <Badge className="mt-1">
                {ledgerData.account.account_type}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Debits</p>
              <p className="text-lg font-bold font-mono">
                {formatCurrency(totalDebit)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Credits</p>
              <p className="text-lg font-bold font-mono">
                {formatCurrency(totalCredit)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Net Change</p>
              <p
                className={`text-lg font-bold font-mono ${
                  netChange >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {formatCurrency(Math.abs(netChange))}
                {netChange < 0 && ' CR'}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Ledger Entries */}
      {selectedAccount ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Entry #</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : ledgerEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    No transactions found for this period
                  </TableCell>
                </TableRow>
              ) : (
                ledgerEntries.map((entry: any) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      {new Date(entry.journal_entries.entry_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-mono">
                      {entry.journal_entries.entry_number}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p>{entry.journal_entries.description}</p>
                        {entry.description && (
                          <p className="text-sm text-muted-foreground">
                            {entry.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{entry.journal_entries.reference || '-'}</TableCell>
                    <TableCell className="text-right font-mono">
                      {entry.debit_amount > 0
                        ? formatCurrency(entry.debit_amount)
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {entry.credit_amount > 0
                        ? formatCurrency(entry.credit_amount)
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      {formatCurrency(Math.abs(entry.running_balance))}
                      {entry.running_balance < 0 && ' CR'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold mb-2">Select an Account</h3>
          <p className="text-muted-foreground">
            Choose an account from the dropdown above to view its ledger
          </p>
        </Card>
      )}
    </div>
  );
}
