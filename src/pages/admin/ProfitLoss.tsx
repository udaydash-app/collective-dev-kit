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
            balance: balance,
            totalDebit,
            totalCredit,
          };
        })
      );

      // Include all accounts with non-zero balance
      const activeAccounts = accountsWithBalances.filter((acc) => acc !== null && acc.balance !== 0);

      const revenueAccounts = activeAccounts.filter((a) => a.account_type === 'revenue');
      
      // Separate COGS (account codes starting with 501) from operating expenses
      const cogsAccounts = activeAccounts.filter((a) => 
        a.account_type === 'expense' && 
        (a.account_code?.startsWith('501') || a.account_name?.toLowerCase().includes('cost of goods'))
      );
      const operatingExpenseAccounts = activeAccounts.filter((a) => 
        a.account_type === 'expense' && 
        !(a.account_code?.startsWith('501') || a.account_name?.toLowerCase().includes('cost of goods'))
      );

      const totalRevenue = revenueAccounts.reduce((sum, acc) => sum + acc.balance, 0);
      const totalCOGS = cogsAccounts.reduce((sum, acc) => sum + acc.balance, 0);
      const grossProfit = totalRevenue - totalCOGS;
      const totalOperatingExpenses = operatingExpenseAccounts.reduce((sum, acc) => sum + acc.balance, 0);
      const netIncome = grossProfit - totalOperatingExpenses;

      return {
        revenueAccounts,
        cogsAccounts,
        operatingExpenseAccounts,
        totalRevenue,
        totalCOGS,
        grossProfit,
        totalOperatingExpenses,
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Total Revenue</p>
            <p className="text-2xl font-bold font-mono text-green-600">
              {formatCurrency(plData.totalRevenue)}
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Cost of Goods Sold</p>
            <p className="text-2xl font-bold font-mono text-orange-600">
              {formatCurrency(plData.totalCOGS)}
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Gross Profit</p>
            <p className={`text-2xl font-bold font-mono ${plData.grossProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {formatCurrency(plData.grossProfit)}
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
                        <TableCell className={`text-right font-mono ${account.balance < 0 ? 'text-red-600' : ''}`}>
                          {account.balance < 0 ? '(' : ''}
                          {formatCurrency(Math.abs(account.balance))}
                          {account.balance < 0 ? ')' : ''}
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
                  <TableRow className="font-bold bg-green-50 dark:bg-green-950/30">
                    <TableCell>Total Revenue</TableCell>
                    <TableCell className="text-right font-mono text-green-600">
                      {formatCurrency(plData.totalRevenue)}
                    </TableCell>
                  </TableRow>

                  {/* Spacing */}
                  <TableRow>
                    <TableCell colSpan={2} className="h-4"></TableCell>
                  </TableRow>

                  {/* Cost of Goods Sold Section */}
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={2} className="font-bold text-lg">
                      COST OF GOODS SOLD
                    </TableCell>
                  </TableRow>
                  {plData.cogsAccounts.length > 0 ? (
                    plData.cogsAccounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell className="pl-8">
                          {account.account_code} - {account.account_name}
                        </TableCell>
                        <TableCell className={`text-right font-mono ${account.balance < 0 ? 'text-green-600' : ''}`}>
                          {account.balance < 0 ? '(' : ''}
                          {formatCurrency(Math.abs(account.balance))}
                          {account.balance < 0 ? ')' : ''}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell className="pl-8 text-muted-foreground" colSpan={2}>
                        No cost of goods sold recorded
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow className="font-bold bg-orange-50 dark:bg-orange-950/30">
                    <TableCell>Total Cost of Goods Sold</TableCell>
                    <TableCell className="text-right font-mono text-orange-600">
                      ({formatCurrency(plData.totalCOGS)})
                    </TableCell>
                  </TableRow>

                  {/* Gross Profit */}
                  <TableRow className="border-t-2 border-blue-300 bg-blue-50 dark:bg-blue-950/30">
                    <TableCell className="font-bold text-lg">GROSS PROFIT</TableCell>
                    <TableCell className={`text-right font-mono font-bold text-lg ${plData.grossProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {plData.grossProfit < 0 ? '(' : ''}
                      {formatCurrency(Math.abs(plData.grossProfit))}
                      {plData.grossProfit < 0 ? ')' : ''}
                    </TableCell>
                  </TableRow>

                  {/* Spacing */}
                  <TableRow>
                    <TableCell colSpan={2} className="h-4"></TableCell>
                  </TableRow>

                  {/* Operating Expenses Section */}
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={2} className="font-bold text-lg">
                      OPERATING EXPENSES
                    </TableCell>
                  </TableRow>
                  {plData.operatingExpenseAccounts.length > 0 ? (
                    plData.operatingExpenseAccounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell className="pl-8">
                          {account.account_code} - {account.account_name}
                        </TableCell>
                        <TableCell className={`text-right font-mono ${account.balance < 0 ? 'text-green-600' : ''}`}>
                          {account.balance < 0 ? '(' : ''}
                          {formatCurrency(Math.abs(account.balance))}
                          {account.balance < 0 ? ')' : ''}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell className="pl-8 text-muted-foreground" colSpan={2}>
                        No operating expenses recorded
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow className="font-bold bg-red-50 dark:bg-red-950/30">
                    <TableCell>Total Operating Expenses</TableCell>
                    <TableCell className="text-right font-mono text-red-600">
                      ({formatCurrency(plData.totalOperatingExpenses)})
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
