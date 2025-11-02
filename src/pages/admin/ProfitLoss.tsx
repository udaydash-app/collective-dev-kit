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
import { TrendingUp, Download, Calendar } from 'lucide-react';
import { usePageView } from '@/hooks/useAnalytics';
import { formatCurrency } from '@/lib/utils';
import { ReturnToPOSButton } from '@/components/layout/ReturnToPOSButton';

export default function ProfitLoss() {
  usePageView('Admin - Profit & Loss');
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: plData, isLoading } = useQuery({
    queryKey: ['profit-loss', startDate, endDate],
    queryFn: async () => {
      // Get revenue and expense accounts
      const { data: accounts, error } = await supabase
        .from('accounts')
        .select('*')
        .in('account_type', ['revenue', 'expense'])
        .eq('is_active', true)
        .order('account_code');

      if (error) throw error;

      // Calculate balances for the period
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
            .gte('journal_entries.entry_date', startDate)
            .lte('journal_entries.entry_date', endDate);

          if (!lines || lines.length === 0) return null;

          const totalDebit = lines.reduce((sum, line) => sum + line.debit_amount, 0);
          const totalCredit = lines.reduce((sum, line) => sum + line.credit_amount, 0);

          // For revenue: credit increases (credit - debit)
          // For expense: debit increases (debit - credit)
          const balance =
            account.account_type === 'revenue'
              ? totalCredit - totalDebit
              : totalDebit - totalCredit;

          return {
            ...account,
            balance: Math.abs(balance),
            isCredit: balance > 0,
          };
        })
      );

      const activeAccounts = accountsWithBalances.filter((acc) => acc !== null && acc.balance > 0);

      const revenueAccounts = activeAccounts.filter((a) => a.account_type === 'revenue');
      const expenseAccounts = activeAccounts.filter((a) => a.account_type === 'expense');

      const totalRevenue = revenueAccounts.reduce((sum, acc) => sum + acc.balance, 0);
      const totalExpenses = expenseAccounts.reduce((sum, acc) => sum + acc.balance, 0);
      const netIncome = totalRevenue - totalExpenses;

      return {
        revenueAccounts,
        expenseAccounts,
        totalRevenue,
        totalExpenses,
        netIncome,
        isProfit: netIncome >= 0,
      };
    },
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="h-8 w-8" />
            Profit & Loss Statement
          </h1>
          <p className="text-muted-foreground">Income statement for the period</p>
        </div>
        <div className="flex gap-2">
          <ReturnToPOSButton inline />
          <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export PDF
        </Button>
        </div>
      </div>

      {/* Date Range Filter */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1 grid grid-cols-2 gap-4 max-w-md">
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
        </div>
      </Card>

      {/* Summary Cards */}
      {plData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Total Revenue</p>
            <p className="text-2xl font-bold font-mono text-green-600">
              {formatCurrency(plData.totalRevenue)}
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Total Expenses</p>
            <p className="text-2xl font-bold font-mono text-red-600">
              {formatCurrency(plData.totalExpenses)}
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Net Income</p>
            <p
              className={`text-2xl font-bold font-mono ${
                plData.isProfit ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {formatCurrency(Math.abs(plData.netIncome))}
              {!plData.isProfit && ' (Loss)'}
            </p>
          </Card>
        </div>
      )}

      {/* P&L Statement */}
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Income Statement</h2>
          <p className="text-sm text-muted-foreground mb-6">
            For the period {new Date(startDate).toLocaleDateString()} to{' '}
            {new Date(endDate).toLocaleDateString()}
          </p>

          <Table>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : !plData ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center py-8">
                    No data available for this period
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {/* Revenue Section */}
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={2} className="font-bold text-lg">
                      REVENUE
                    </TableCell>
                  </TableRow>
                  {plData.revenueAccounts.length > 0 ? (
                    plData.revenueAccounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell className="pl-8">
                          {account.account_code} - {account.account_name}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(account.balance)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell className="pl-8 text-muted-foreground" colSpan={2}>
                        No revenue recorded
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow className="font-bold bg-green-50">
                    <TableCell>Total Revenue</TableCell>
                    <TableCell className="text-right font-mono text-green-600">
                      {formatCurrency(plData.totalRevenue)}
                    </TableCell>
                  </TableRow>

                  {/* Spacing */}
                  <TableRow>
                    <TableCell colSpan={2} className="h-4"></TableCell>
                  </TableRow>

                  {/* Expenses Section */}
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={2} className="font-bold text-lg">
                      EXPENSES
                    </TableCell>
                  </TableRow>
                  {plData.expenseAccounts.length > 0 ? (
                    plData.expenseAccounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell className="pl-8">
                          {account.account_code} - {account.account_name}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(account.balance)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell className="pl-8 text-muted-foreground" colSpan={2}>
                        No expenses recorded
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow className="font-bold bg-red-50">
                    <TableCell>Total Expenses</TableCell>
                    <TableCell className="text-right font-mono text-red-600">
                      ({formatCurrency(plData.totalExpenses)})
                    </TableCell>
                  </TableRow>

                  {/* Net Income */}
                  <TableRow className="border-t-2 border-primary">
                    <TableCell className="font-bold text-lg">
                      NET {plData.isProfit ? 'INCOME' : 'LOSS'}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono font-bold text-lg ${
                        plData.isProfit ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {plData.isProfit ? '' : '('}
                      {formatCurrency(Math.abs(plData.netIncome))}
                      {!plData.isProfit && ')'}
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Report Footer */}
      <Card className="p-4 text-center text-sm text-muted-foreground">
        <p>
          Report generated on {new Date().toLocaleDateString()} at{' '}
          {new Date().toLocaleTimeString()}
        </p>
      </Card>
    </div>
  );
}
