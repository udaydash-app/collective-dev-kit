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

      // For trial balance, accounts with contra balances should show on opposite side
      // Assets/Expenses normally have debit balances, Liabilities/Equity/Revenue have credit balances
      // If an account has a balance on the "wrong" side, it stays there (shows where balance actually is)
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

  const accountTypeLabels: Record<string, string> = {
    asset: 'Assets',
    liability: 'Liabilities',
    equity: 'Equity',
    revenue: 'Revenue',
    expense: 'Expenses',
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
        <Card className={`p-4 ${trialBalanceData.isBalanced ? 'bg-green-50 dark:bg-green-950/30 border-green-300' : 'bg-red-50 dark:bg-red-950/30 border-red-300'}`}>
          <div className="flex items-center gap-3">
            {trialBalanceData.isBalanced ? (
              <CheckCircle className="h-8 w-8 text-green-600" />
            ) : (
              <XCircle className="h-8 w-8 text-red-600" />
            )}
            <div>
              <p className={`font-bold ${trialBalanceData.isBalanced ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                {trialBalanceData.isBalanced ? 'Trial Balance is Balanced' : 'Trial Balance is Out of Balance'}
              </p>
              {!trialBalanceData.isBalanced && (
                <p className="text-sm text-red-600">
                  Difference: {formatCurrency(Math.abs(trialBalanceData.totalDebits - trialBalanceData.totalCredits))}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Traditional Trial Balance T-Account Format */}
      <Card className="overflow-hidden">
        {/* Header */}
        <div className="bg-muted/50 p-4 border-b text-center">
          <h2 className="text-xl font-bold">TRIAL BALANCE</h2>
          <p className="text-sm text-muted-foreground">
            As at {new Date(asOfDate).toLocaleDateString()}
          </p>
        </div>

        {/* T-Account Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-muted/30 border-b-2 border-border">
                <th className="p-3 text-left font-bold border-r border-border w-16">S.No</th>
                <th className="p-3 text-left font-bold border-r border-border">Particulars</th>
                <th className="p-3 text-right font-bold border-r border-border w-40">Debit (Dr.)</th>
                <th className="p-3 text-right font-bold w-40">Credit (Cr.)</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="text-center py-12">Loading...</td>
                </tr>
              ) : !trialBalanceData?.accounts.length ? (
                <tr>
                  <td colSpan={4} className="text-center py-12">No transactions found for this period</td>
                </tr>
              ) : (
                <>
                  {filteredGroups.map(([type, accounts]: [string, any[]]) => {
                    if (accounts.length === 0) return null;
                    
                    const groupDebit = accounts.reduce((sum, acc) => sum + acc.debit_balance, 0);
                    const groupCredit = accounts.reduce((sum, acc) => sum + acc.credit_balance, 0);
                    
                    return (
                      <React.Fragment key={type}>
                        {/* Group Header */}
                        <tr className="bg-muted/20">
                          <td colSpan={4} className="p-2 font-bold border-b border-border">
                            {accountTypeLabels[type]}
                          </td>
                        </tr>
                        
                        {/* Account Rows */}
                        {accounts.map((account, index) => (
                          <tr key={account.id} className="border-b border-border/50 hover:bg-muted/10">
                            <td className="p-2 text-center border-r border-border/50 text-sm text-muted-foreground">
                              {index + 1}
                            </td>
                            <td className="p-2 border-r border-border/50">
                              <span className="font-mono text-xs text-muted-foreground mr-2">{account.account_code}</span>
                              {account.account_name}
                            </td>
                            <td className="p-2 text-right font-mono border-r border-border/50">
                              {account.debit_balance > 0 ? formatCurrency(account.debit_balance) : '-'}
                            </td>
                            <td className="p-2 text-right font-mono">
                              {account.credit_balance > 0 ? formatCurrency(account.credit_balance) : '-'}
                            </td>
                          </tr>
                        ))}
                        
                        {/* Group Subtotal */}
                        <tr className="bg-muted/30 font-semibold">
                          <td className="p-2 border-r border-border/50"></td>
                          <td className="p-2 text-right border-r border-border/50 text-sm">
                            Total {accountTypeLabels[type]}
                          </td>
                          <td className="p-2 text-right font-mono border-r border-border/50">
                            {groupDebit > 0 ? formatCurrency(groupDebit) : '-'}
                          </td>
                          <td className="p-2 text-right font-mono">
                            {groupCredit > 0 ? formatCurrency(groupCredit) : '-'}
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}

                  {/* Grand Total Row */}
                  <tr className="bg-primary/10 font-bold border-t-4 border-primary">
                    <td className="p-3 border-r border-border"></td>
                    <td className="p-3 text-right border-r border-border text-lg">TOTAL</td>
                    <td className="p-3 text-right font-mono text-lg border-r border-border">
                      {formatCurrency(trialBalanceData.totalDebits)}
                    </td>
                    <td className="p-3 text-right font-mono text-lg">
                      {formatCurrency(trialBalanceData.totalCredits)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Report Footer */}
      <Card className="p-4 text-center text-sm text-muted-foreground">
        <p>Report generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
        <p>As at {new Date(asOfDate).toLocaleDateString()}</p>
      </Card>
    </div>
  );
}
