import { useState } from 'react';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Scale, Download, Calendar, FileSpreadsheet, CheckCircle, XCircle } from 'lucide-react';
import { usePageView } from '@/hooks/useAnalytics';
import { formatCurrency } from '@/lib/utils';
import { ReturnToPOSButton } from '@/components/layout/ReturnToPOSButton';

export default function TrialBalance() {
  usePageView('Admin - Trial Balance');
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [groupFilter, setGroupFilter] = useState('all');

  const { data: trialBalanceData, isLoading } = useQuery({
    queryKey: ['trial-balance', asOfDate],
    queryFn: async () => {
      const { data: accounts, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true)
        .order('account_code');

      if (error) throw error;

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

          let debit_balance = 0;
          let credit_balance = 0;

          if (['asset', 'expense'].includes(account.account_type)) {
            const netBalance = totalDebit - totalCredit;
            if (netBalance > 0) {
              debit_balance = netBalance;
            } else {
              credit_balance = Math.abs(netBalance);
            }
          } else {
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

      const activeAccounts = accountsWithBalances.filter(
        (acc) => acc.debit_balance !== 0 || acc.credit_balance !== 0
      );

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

  const accountTypeConfig: Record<string, { label: string; color: string; bgColor: string }> = {
    asset: { label: 'Assets', color: 'text-blue-700 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-950/30' },
    liability: { label: 'Liabilities', color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-950/30' },
    equity: { label: 'Equity', color: 'text-purple-700 dark:text-purple-400', bgColor: 'bg-purple-50 dark:bg-purple-950/30' },
    revenue: { label: 'Revenue', color: 'text-green-700 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-950/30' },
    expense: { label: 'Expenses', color: 'text-orange-700 dark:text-orange-400', bgColor: 'bg-orange-50 dark:bg-orange-950/30' },
  };

  const filteredGroups = groupFilter === 'all' 
    ? Object.entries(trialBalanceData?.groupedAccounts || {})
    : Object.entries(trialBalanceData?.groupedAccounts || {}).filter(([type]) => type === groupFilter);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Scale className="h-8 w-8" />
            Trial Balance
          </h1>
          <p className="text-muted-foreground">Verify debits equal credits</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ReturnToPOSButton inline />
          <Button variant="outline">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-4 flex-wrap">
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
          <div className="flex-1 max-w-xs">
            <Label>Ledger Group</Label>
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Groups" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groups</SelectItem>
                <SelectItem value="asset">Assets</SelectItem>
                <SelectItem value="liability">Liabilities</SelectItem>
                <SelectItem value="equity">Equity</SelectItem>
                <SelectItem value="revenue">Revenue</SelectItem>
                <SelectItem value="expense">Expenses</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Balance Status Card */}
      {trialBalanceData && (
        <Card className={`p-6 ${trialBalanceData.isBalanced ? 'bg-green-50 dark:bg-green-950/30 border-green-300' : 'bg-red-50 dark:bg-red-950/30 border-red-300'}`}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              {trialBalanceData.isBalanced ? (
                <CheckCircle className="h-10 w-10 text-green-600" />
              ) : (
                <XCircle className="h-10 w-10 text-red-600" />
              )}
              <div>
                <p className={`text-xl font-bold ${trialBalanceData.isBalanced ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                  {trialBalanceData.isBalanced ? 'Trial Balance is Balanced' : 'Trial Balance is Out of Balance'}
                </p>
                {!trialBalanceData.isBalanced && (
                  <p className="text-sm text-red-600">
                    Difference: {formatCurrency(Math.abs(trialBalanceData.totalDebits - trialBalanceData.totalCredits))}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-8">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total Debits</p>
                <p className="text-2xl font-bold font-mono">{formatCurrency(trialBalanceData.totalDebits)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total Credits</p>
                <p className="text-2xl font-bold font-mono">{formatCurrency(trialBalanceData.totalCredits)}</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Trial Balance Table */}
      <Card className="overflow-hidden">
        <div className="bg-primary/5 p-4 border-b">
          <h2 className="text-xl font-bold text-center">TRIAL BALANCE</h2>
          <p className="text-sm text-muted-foreground text-center">
            As at {new Date(asOfDate).toLocaleDateString()}
          </p>
        </div>
        
        <Table fixedScroll>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-24">Code</TableHead>
              <TableHead>Account Name</TableHead>
              <TableHead className="w-24 text-center">Type</TableHead>
              <TableHead className="w-40 text-right">Debit (Dr.)</TableHead>
              <TableHead className="w-40 text-right">Credit (Cr.)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  Loading...
                </TableCell>
              </TableRow>
            ) : !trialBalanceData?.accounts.length ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  No transactions found for this period
                </TableCell>
              </TableRow>
            ) : (
              <>
                {filteredGroups.map(([type, accounts]: [string, any[]]) =>
                  accounts.length > 0 && (
                    <React.Fragment key={type}>
                      <TableRow className={accountTypeConfig[type].bgColor}>
                        <TableCell colSpan={5} className={`font-bold ${accountTypeConfig[type].color}`}>
                          {accountTypeConfig[type].label}
                        </TableCell>
                      </TableRow>
                      {accounts.map((account) => (
                        <TableRow key={account.id} className="hover:bg-muted/30">
                          <TableCell className="font-mono text-sm">{account.account_code}</TableCell>
                          <TableCell>{account.account_name}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="text-xs">
                              {account.account_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {account.debit_balance > 0 ? formatCurrency(account.debit_balance) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {account.credit_balance > 0 ? formatCurrency(account.credit_balance) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Subtotal for each group */}
                      <TableRow className={`${accountTypeConfig[type].bgColor} font-semibold`}>
                        <TableCell colSpan={3} className={`text-right ${accountTypeConfig[type].color}`}>
                          Subtotal - {accountTypeConfig[type].label}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(accounts.reduce((sum, acc) => sum + acc.debit_balance, 0))}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(accounts.reduce((sum, acc) => sum + acc.credit_balance, 0))}
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  )
                )}

                {/* Grand Total */}
                <TableRow className="font-bold bg-primary/10 border-t-4 border-primary">
                  <TableCell colSpan={3} className="text-lg">GRAND TOTAL</TableCell>
                  <TableCell className="text-right font-mono text-lg">
                    {formatCurrency(trialBalanceData.totalDebits)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-lg">
                    {formatCurrency(trialBalanceData.totalCredits)}
                  </TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Report Footer */}
      <Card className="p-4 text-center text-sm text-muted-foreground">
        <p>Report generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
        <p>As at {new Date(asOfDate).toLocaleDateString()}</p>
      </Card>
    </div>
  );
}