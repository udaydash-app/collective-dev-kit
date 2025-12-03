import { useState } from 'react';
import React from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Scale, Download, Calendar } from 'lucide-react';
import { usePageView } from '@/hooks/useAnalytics';
import { formatCurrency } from '@/lib/utils';
import { ReturnToPOSButton } from '@/components/layout/ReturnToPOSButton';

export default function TrialBalance() {
  usePageView('Admin - Trial Balance');
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: trialBalanceData, isLoading } = useQuery({
    queryKey: ['trial-balance', asOfDate],
    queryFn: async () => {
      // Get all accounts with their balances
      const { data: accounts, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true)
        .order('account_code');

      if (error) throw error;

      // Calculate balances based on posted journal entries up to the date
      const accountsWithBalances = await Promise.all(
        accounts.map(async (account) => {
          const { data: lines } = await supabase
            .from('journal_entry_lines')
            .select(`
              debit_amount,
              credit_amount,
              journal_entries!inner (
                status,
                entry_date
              )
            `)
            .eq('account_id', account.id)
            .eq('journal_entries.status', 'posted')
            .lte('journal_entries.entry_date', asOfDate);

          const totalDebit = lines?.reduce((sum, line) => sum + line.debit_amount, 0) || 0;
          const totalCredit = lines?.reduce((sum, line) => sum + line.credit_amount, 0) || 0;

          // Calculate net balance for each account based on its natural balance
          // Assets and Expenses have natural debit balances (debit - credit)
          // Liabilities, Equity, and Revenue have natural credit balances (credit - debit)
          let debit_balance = 0;
          let credit_balance = 0;

          if (['asset', 'expense'].includes(account.account_type)) {
            // Natural debit balance accounts
            const netBalance = totalDebit - totalCredit;
            if (netBalance > 0) {
              debit_balance = netBalance;
            } else {
              credit_balance = Math.abs(netBalance);
            }
          } else {
            // Natural credit balance accounts (liability, equity, revenue)
            const netBalance = totalCredit - totalDebit;
            if (netBalance > 0) {
              credit_balance = netBalance;
            } else {
              debit_balance = Math.abs(netBalance);
            }
          }

          return {
            ...account,
            debit_balance,
            credit_balance,
            total_debit: totalDebit,
            total_credit: totalCredit,
          };
        })
      );

      // Filter out accounts with zero balances
      const activeAccounts = accountsWithBalances.filter(
        (acc) => acc.debit_balance !== 0 || acc.credit_balance !== 0
      );

      // Group by account type
      const groupedAccounts = {
        asset: activeAccounts.filter((a) => a.account_type === 'asset'),
        liability: activeAccounts.filter((a) => a.account_type === 'liability'),
        equity: activeAccounts.filter((a) => a.account_type === 'equity'),
        revenue: activeAccounts.filter((a) => a.account_type === 'revenue'),
        expense: activeAccounts.filter((a) => a.account_type === 'expense'),
      };

      const totalDebits = activeAccounts.reduce((sum, acc) => sum + acc.debit_balance, 0);
      const totalCredits = activeAccounts.reduce((sum, acc) => sum + acc.credit_balance, 0);

      return {
        accounts: activeAccounts,
        groupedAccounts,
        totalDebits,
        totalCredits,
        isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
      };
    },
  });

  const accountTypeLabels = {
    asset: 'Assets',
    liability: 'Liabilities',
    equity: 'Equity',
    revenue: 'Revenue',
    expense: 'Expenses',
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Scale className="h-8 w-8" />
            Trial Balance
          </h1>
          <p className="text-muted-foreground">
            Verify that total debits equal total credits
          </p>
        </div>
        <div className="flex gap-2">
          <ReturnToPOSButton inline />
          <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export PDF
        </Button>
        </div>
      </div>

      {/* Date Filter */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1 max-w-xs">
            <Label htmlFor="as-of-date">As of Date</Label>
            <Input
              id="as-of-date"
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Balance Status */}
      {trialBalanceData && (
        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Total Debits</p>
              <p className="text-2xl font-bold font-mono">
                {formatCurrency(trialBalanceData.totalDebits)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Credits</p>
              <p className="text-2xl font-bold font-mono">
                {formatCurrency(trialBalanceData.totalCredits)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge
                variant={trialBalanceData.isBalanced ? 'default' : 'destructive'}
                className="text-lg px-3 py-1"
              >
                {trialBalanceData.isBalanced ? '✓ Balanced' : '✗ Out of Balance'}
              </Badge>
            </div>
          </div>
        </Card>
      )}

      {/* Trial Balance Table */}
      <Card>
        <Table fixedScroll>
          <TableHeader>
            <TableRow>
              <TableHead>Account Code</TableHead>
              <TableHead>Account Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : !trialBalanceData?.accounts.length ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  No transactions found for this period
                </TableCell>
              </TableRow>
            ) : (
              <>
                {/* Group accounts by type */}
                {Object.entries(trialBalanceData.groupedAccounts).map(
                  ([type, accounts]: [string, any[]]) =>
                    accounts.length > 0 && (
                      <React.Fragment key={type}>
                        <TableRow className="bg-muted/50">
                          <TableCell colSpan={5} className="font-bold">
                            {accountTypeLabels[type as keyof typeof accountTypeLabels]}
                          </TableCell>
                        </TableRow>
                        {accounts.map((account) => (
                          <TableRow key={account.id}>
                            <TableCell className="font-mono">
                              {account.account_code}
                            </TableCell>
                            <TableCell>{account.account_name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{account.account_type}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {account.debit_balance > 0
                                ? formatCurrency(account.debit_balance)
                                : '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {account.credit_balance > 0
                                ? formatCurrency(account.credit_balance)
                                : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </React.Fragment>
                    )
                )}

                {/* Totals Row */}
                <TableRow className="font-bold bg-primary/10">
                  <TableCell colSpan={3}>TOTAL</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(trialBalanceData.totalDebits)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(trialBalanceData.totalCredits)}
                  </TableCell>
                </TableRow>

                {/* Difference Row if not balanced */}
                {!trialBalanceData.isBalanced && (
                  <TableRow className="bg-destructive/10">
                    <TableCell colSpan={3} className="text-destructive font-bold">
                      DIFFERENCE (Out of Balance)
                    </TableCell>
                    <TableCell
                      colSpan={2}
                      className="text-right font-mono text-destructive font-bold"
                    >
                      {formatCurrency(
                        Math.abs(trialBalanceData.totalDebits - trialBalanceData.totalCredits)
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Report Footer */}
      <Card className="p-4 text-center text-sm text-muted-foreground">
        <p>
          Report generated on {new Date().toLocaleDateString()} at{' '}
          {new Date().toLocaleTimeString()}
        </p>
        <p>As of {new Date(asOfDate).toLocaleDateString()}</p>
      </Card>
    </div>
  );
}
