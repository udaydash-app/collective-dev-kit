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
import { Building2, Download, Calendar } from 'lucide-react';
import { usePageView } from '@/hooks/useAnalytics';
import { formatCurrency } from '@/lib/utils';

export default function BalanceSheet() {
  usePageView('Admin - Balance Sheet');
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: balanceSheetData, isLoading } = useQuery({
    queryKey: ['balance-sheet', asOfDate],
    queryFn: async () => {
      // Get asset, liability, and equity accounts
      const { data: accounts, error } = await supabase
        .from('accounts')
        .select('*')
        .in('account_type', ['asset', 'liability', 'equity'])
        .eq('is_active', true)
        .order('account_code');

      if (error) throw error;

      // Calculate balances up to the date
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

          if (!lines || lines.length === 0) return null;

          const totalDebit = lines.reduce((sum, line) => sum + line.debit_amount, 0);
          const totalCredit = lines.reduce((sum, line) => sum + line.credit_amount, 0);

          // For assets: debit increases (debit - credit)
          // For liabilities and equity: credit increases (credit - debit)
          const balance =
            account.account_type === 'asset'
              ? totalDebit - totalCredit
              : totalCredit - totalDebit;

          return {
            ...account,
            balance: Math.abs(balance),
          };
        })
      );

      const activeAccounts = accountsWithBalances.filter((acc) => acc !== null && acc.balance > 0);

      const assetAccounts = activeAccounts.filter((a) => a.account_type === 'asset');
      const liabilityAccounts = activeAccounts.filter((a) => a.account_type === 'liability');
      const equityAccounts = activeAccounts.filter((a) => a.account_type === 'equity');

      const totalAssets = assetAccounts.reduce((sum, acc) => sum + acc.balance, 0);
      const totalLiabilities = liabilityAccounts.reduce((sum, acc) => sum + acc.balance, 0);
      const totalEquity = equityAccounts.reduce((sum, acc) => sum + acc.balance, 0);

      const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
      const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01;

      return {
        assetAccounts,
        liabilityAccounts,
        equityAccounts,
        totalAssets,
        totalLiabilities,
        totalEquity,
        totalLiabilitiesAndEquity,
        isBalanced,
      };
    },
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            Balance Sheet
          </h1>
          <p className="text-muted-foreground">Statement of financial position</p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export PDF
        </Button>
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

      {/* Summary Cards */}
      {balanceSheetData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Total Assets</p>
            <p className="text-2xl font-bold font-mono text-blue-600">
              {formatCurrency(balanceSheetData.totalAssets)}
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Total Liabilities</p>
            <p className="text-2xl font-bold font-mono text-red-600">
              {formatCurrency(balanceSheetData.totalLiabilities)}
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Total Equity</p>
            <p className="text-2xl font-bold font-mono text-purple-600">
              {formatCurrency(balanceSheetData.totalEquity)}
            </p>
          </Card>
        </div>
      )}

      {/* Balance Sheet Statement */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Assets Column */}
        <Card>
          <div className="p-6">
            <h2 className="text-xl font-bold mb-4 text-blue-600">ASSETS</h2>
            <Table>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : !balanceSheetData?.assetAccounts.length ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                      No assets recorded
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {balanceSheetData.assetAccounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{account.account_name}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {account.account_code}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(account.balance)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold bg-blue-50 border-t-2">
                      <TableCell>Total Assets</TableCell>
                      <TableCell className="text-right font-mono text-blue-600">
                        {formatCurrency(balanceSheetData.totalAssets)}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Liabilities & Equity Column */}
        <Card>
          <div className="p-6">
            <h2 className="text-xl font-bold mb-4 text-red-600">LIABILITIES</h2>
            <Table>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {balanceSheetData?.liabilityAccounts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-muted-foreground py-4">
                          No liabilities recorded
                        </TableCell>
                      </TableRow>
                    ) : (
                      balanceSheetData?.liabilityAccounts.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{account.account_name}</p>
                              <p className="text-xs text-muted-foreground font-mono">
                                {account.account_code}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(account.balance)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                    <TableRow className="font-bold bg-red-50">
                      <TableCell>Total Liabilities</TableCell>
                      <TableCell className="text-right font-mono text-red-600">
                        {formatCurrency(balanceSheetData?.totalLiabilities || 0)}
                      </TableCell>
                    </TableRow>

                    {/* Spacing */}
                    <TableRow>
                      <TableCell colSpan={2} className="h-6"></TableCell>
                    </TableRow>

                    {/* Equity Section */}
                    <TableRow>
                      <TableCell colSpan={2} className="font-bold text-lg text-purple-600">
                        EQUITY
                      </TableCell>
                    </TableRow>
                    {balanceSheetData?.equityAccounts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-muted-foreground py-4">
                          No equity recorded
                        </TableCell>
                      </TableRow>
                    ) : (
                      balanceSheetData?.equityAccounts.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{account.account_name}</p>
                              <p className="text-xs text-muted-foreground font-mono">
                                {account.account_code}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(account.balance)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                    <TableRow className="font-bold bg-purple-50">
                      <TableCell>Total Equity</TableCell>
                      <TableCell className="text-right font-mono text-purple-600">
                        {formatCurrency(balanceSheetData?.totalEquity || 0)}
                      </TableCell>
                    </TableRow>

                    {/* Total Liabilities + Equity */}
                    <TableRow className="font-bold bg-primary/10 border-t-2">
                      <TableCell>Total Liabilities & Equity</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(balanceSheetData?.totalLiabilitiesAndEquity || 0)}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Balance Check */}
      {balanceSheetData && !balanceSheetData.isBalanced && (
        <Card className="p-4 bg-destructive/10 border-destructive">
          <p className="font-bold text-destructive">
            ⚠️ Balance Sheet is out of balance!
          </p>
          <p className="text-sm text-destructive">
            Assets should equal Liabilities + Equity. Difference:{' '}
            {formatCurrency(
              Math.abs(
                balanceSheetData.totalAssets - balanceSheetData.totalLiabilitiesAndEquity
              )
            )}
          </p>
        </Card>
      )}

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
