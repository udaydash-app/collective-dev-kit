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
  TableRow,
} from '@/components/ui/table';
import { Building2, Download, Calendar, FileSpreadsheet, CheckCircle, XCircle } from 'lucide-react';
import { usePageView } from '@/hooks/useAnalytics';
import { formatCurrency } from '@/lib/utils';
import { ReturnToPOSButton } from '@/components/layout/ReturnToPOSButton';

export default function BalanceSheet() {
  usePageView('Admin - Balance Sheet');
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: balanceSheetData, isLoading } = useQuery({
    queryKey: ['balance-sheet', asOfDate],
    queryFn: async () => {
      const { data: accounts, error } = await supabase
        .from('accounts')
        .select('*')
        .in('account_type', ['asset', 'liability', 'equity'])
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

          if (!lines || lines.length === 0) return null;

          const totalDebit = lines.reduce((sum, line) => sum + line.debit_amount, 0);
          const totalCredit = lines.reduce((sum, line) => sum + line.credit_amount, 0);

          const balance =
            account.account_type === 'asset'
              ? totalDebit - totalCredit
              : totalCredit - totalDebit;

          return {
            ...account,
            balance,
          };
        })
      );

      const activeAccounts = accountsWithBalances.filter((acc) => acc !== null && acc.balance !== 0);

      // Categorize assets
      const currentAssets = activeAccounts.filter((a) => 
        a.account_type === 'asset' && 
        (a.account_code?.startsWith('10') || a.account_code?.startsWith('11'))
      );
      const fixedAssets = activeAccounts.filter((a) => 
        a.account_type === 'asset' && 
        (a.account_code?.startsWith('12') || a.account_code?.startsWith('15'))
      );
      const otherAssets = activeAccounts.filter((a) => 
        a.account_type === 'asset' && 
        !currentAssets.includes(a) && !fixedAssets.includes(a)
      );

      // Categorize liabilities
      const currentLiabilities = activeAccounts.filter((a) => 
        a.account_type === 'liability' && 
        (a.account_code?.startsWith('20') || a.account_code?.startsWith('21'))
      );
      const longTermLiabilities = activeAccounts.filter((a) => 
        a.account_type === 'liability' && 
        (a.account_code?.startsWith('22') || a.account_code?.startsWith('25'))
      );
      const otherLiabilities = activeAccounts.filter((a) => 
        a.account_type === 'liability' && 
        !currentLiabilities.includes(a) && !longTermLiabilities.includes(a)
      );

      // Categorize equity
      const capitalAccounts = activeAccounts.filter((a) => 
        a.account_type === 'equity' && 
        (a.account_code?.startsWith('30') || a.account_code?.startsWith('31'))
      );
      const reserveAccounts = activeAccounts.filter((a) => 
        a.account_type === 'equity' && 
        (a.account_code?.startsWith('32') || a.account_code?.startsWith('33'))
      );
      const retainedEarnings = activeAccounts.filter((a) => 
        a.account_type === 'equity' && 
        !capitalAccounts.includes(a) && !reserveAccounts.includes(a)
      );

      const totalCurrentAssets = currentAssets.reduce((sum, acc) => sum + acc.balance, 0);
      const totalFixedAssets = fixedAssets.reduce((sum, acc) => sum + acc.balance, 0);
      const totalOtherAssets = otherAssets.reduce((sum, acc) => sum + acc.balance, 0);
      const totalAssets = totalCurrentAssets + totalFixedAssets + totalOtherAssets;

      const totalCurrentLiabilities = currentLiabilities.reduce((sum, acc) => sum + acc.balance, 0);
      const totalLongTermLiabilities = longTermLiabilities.reduce((sum, acc) => sum + acc.balance, 0);
      const totalOtherLiabilities = otherLiabilities.reduce((sum, acc) => sum + acc.balance, 0);
      const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities + totalOtherLiabilities;

      const totalCapital = capitalAccounts.reduce((sum, acc) => sum + acc.balance, 0);
      const totalReserves = reserveAccounts.reduce((sum, acc) => sum + acc.balance, 0);
      const totalRetainedEarnings = retainedEarnings.reduce((sum, acc) => sum + acc.balance, 0);
      const totalEquity = totalCapital + totalReserves + totalRetainedEarnings;

      const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
      const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01;

      return {
        currentAssets,
        fixedAssets,
        otherAssets,
        currentLiabilities,
        longTermLiabilities,
        otherLiabilities,
        capitalAccounts,
        reserveAccounts,
        retainedEarnings,
        totalCurrentAssets,
        totalFixedAssets,
        totalOtherAssets,
        totalAssets,
        totalCurrentLiabilities,
        totalLongTermLiabilities,
        totalOtherLiabilities,
        totalLiabilities,
        totalCapital,
        totalReserves,
        totalRetainedEarnings,
        totalEquity,
        totalLiabilitiesAndEquity,
        isBalanced,
      };
    },
  });

  const renderAccountGroup = (title: string, accounts: any[], subtotal: number, colorClass: string) => (
    <>
      {(accounts.length > 0 || subtotal !== 0) && (
        <>
          <TableRow className="bg-muted/30">
            <TableCell className="font-semibold pl-6">{title}</TableCell>
            <TableCell></TableCell>
          </TableRow>
          {accounts.map((account: any) => (
            <TableRow key={account.id}>
              <TableCell className="pl-10 text-sm">
                <span className="text-muted-foreground font-mono mr-2">{account.account_code}</span>
                {account.account_name}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatCurrency(Math.abs(account.balance))}
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted/20">
            <TableCell className={`pl-6 font-semibold ${colorClass}`}>Total {title}</TableCell>
            <TableCell className={`text-right font-mono font-semibold ${colorClass}`}>
              {formatCurrency(subtotal)}
            </TableCell>
          </TableRow>
        </>
      )}
    </>
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            Balance Sheet
          </h1>
          <p className="text-muted-foreground">Statement of Financial Position</p>
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

      {/* Balance Check Status */}
      {balanceSheetData && (
        <Card className={`p-4 ${balanceSheetData.isBalanced ? 'bg-green-50 dark:bg-green-950/30 border-green-300' : 'bg-red-50 dark:bg-red-950/30 border-red-300'}`}>
          <div className="flex items-center gap-3">
            {balanceSheetData.isBalanced ? (
              <CheckCircle className="h-8 w-8 text-green-600" />
            ) : (
              <XCircle className="h-8 w-8 text-red-600" />
            )}
            <div>
              <p className={`font-bold ${balanceSheetData.isBalanced ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                {balanceSheetData.isBalanced 
                  ? 'Balance Sheet is Balanced: Assets = Liabilities + Equity' 
                  : 'Balance Sheet is Out of Balance!'}
              </p>
              {!balanceSheetData.isBalanced && (
                <p className="text-sm text-red-600">
                  Difference: {formatCurrency(Math.abs(balanceSheetData.totalAssets - balanceSheetData.totalLiabilitiesAndEquity))}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Balance Sheet - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ASSETS Column */}
        <Card className="overflow-hidden">
          <div className="bg-blue-100 dark:bg-blue-950/50 p-4 border-b">
            <h2 className="text-xl font-bold text-blue-700 dark:text-blue-400 text-center">ASSETS</h2>
          </div>
          <div className="p-4">
            <Table>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-12">Loading...</TableCell>
                  </TableRow>
                ) : !balanceSheetData ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-12">No data available</TableCell>
                  </TableRow>
                ) : (
                  <>
                    {renderAccountGroup('Current Assets', balanceSheetData.currentAssets, balanceSheetData.totalCurrentAssets, 'text-blue-600')}
                    {renderAccountGroup('Fixed Assets', balanceSheetData.fixedAssets, balanceSheetData.totalFixedAssets, 'text-blue-600')}
                    {renderAccountGroup('Other Assets', balanceSheetData.otherAssets, balanceSheetData.totalOtherAssets, 'text-blue-600')}
                    
                    <TableRow className="font-bold bg-blue-200 dark:bg-blue-900/50 border-t-4 border-blue-400">
                      <TableCell className="text-lg text-blue-800 dark:text-blue-300">TOTAL ASSETS</TableCell>
                      <TableCell className="text-right font-mono text-lg text-blue-800 dark:text-blue-300">
                        {formatCurrency(balanceSheetData.totalAssets)}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* LIABILITIES & EQUITY Column */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-red-100 to-purple-100 dark:from-red-950/50 dark:to-purple-950/50 p-4 border-b">
            <h2 className="text-xl font-bold text-center">
              <span className="text-red-700 dark:text-red-400">LIABILITIES</span>
              <span className="text-muted-foreground mx-2">&</span>
              <span className="text-purple-700 dark:text-purple-400">EQUITY</span>
            </h2>
          </div>
          <div className="p-4">
            <Table>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-12">Loading...</TableCell>
                  </TableRow>
                ) : !balanceSheetData ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-12">No data available</TableCell>
                  </TableRow>
                ) : (
                  <>
                    {/* Liabilities Section */}
                    <TableRow className="bg-red-50 dark:bg-red-950/30">
                      <TableCell colSpan={2} className="font-bold text-red-700 dark:text-red-400">
                        LIABILITIES
                      </TableCell>
                    </TableRow>
                    {renderAccountGroup('Current Liabilities', balanceSheetData.currentLiabilities, balanceSheetData.totalCurrentLiabilities, 'text-red-600')}
                    {renderAccountGroup('Long-term Liabilities', balanceSheetData.longTermLiabilities, balanceSheetData.totalLongTermLiabilities, 'text-red-600')}
                    {renderAccountGroup('Other Liabilities', balanceSheetData.otherLiabilities, balanceSheetData.totalOtherLiabilities, 'text-red-600')}
                    
                    <TableRow className="font-bold bg-red-100 dark:bg-red-900/50">
                      <TableCell className="text-red-700 dark:text-red-400">Total Liabilities</TableCell>
                      <TableCell className="text-right font-mono text-red-700 dark:text-red-400">
                        {formatCurrency(balanceSheetData.totalLiabilities)}
                      </TableCell>
                    </TableRow>

                    {/* Spacing */}
                    <TableRow><TableCell colSpan={2} className="h-4 p-0"></TableCell></TableRow>

                    {/* Equity Section */}
                    <TableRow className="bg-purple-50 dark:bg-purple-950/30">
                      <TableCell colSpan={2} className="font-bold text-purple-700 dark:text-purple-400">
                        EQUITY
                      </TableCell>
                    </TableRow>
                    {renderAccountGroup('Capital', balanceSheetData.capitalAccounts, balanceSheetData.totalCapital, 'text-purple-600')}
                    {renderAccountGroup('Reserves', balanceSheetData.reserveAccounts, balanceSheetData.totalReserves, 'text-purple-600')}
                    {renderAccountGroup('Retained Earnings', balanceSheetData.retainedEarnings, balanceSheetData.totalRetainedEarnings, 'text-purple-600')}
                    
                    <TableRow className="font-bold bg-purple-100 dark:bg-purple-900/50">
                      <TableCell className="text-purple-700 dark:text-purple-400">Total Equity</TableCell>
                      <TableCell className="text-right font-mono text-purple-700 dark:text-purple-400">
                        {formatCurrency(balanceSheetData.totalEquity)}
                      </TableCell>
                    </TableRow>

                    {/* Total Liabilities + Equity */}
                    <TableRow className="font-bold bg-gradient-to-r from-red-200 to-purple-200 dark:from-red-900/50 dark:to-purple-900/50 border-t-4 border-primary">
                      <TableCell className="text-lg">TOTAL LIABILITIES & EQUITY</TableCell>
                      <TableCell className="text-right font-mono text-lg">
                        {formatCurrency(balanceSheetData.totalLiabilitiesAndEquity)}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Summary Cards */}
      {balanceSheetData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-blue-50 dark:bg-blue-950/30">
            <p className="text-xs text-muted-foreground">Total Assets</p>
            <p className="text-xl font-bold font-mono text-blue-600">{formatCurrency(balanceSheetData.totalAssets)}</p>
          </Card>
          <Card className="p-4 bg-red-50 dark:bg-red-950/30">
            <p className="text-xs text-muted-foreground">Total Liabilities</p>
            <p className="text-xl font-bold font-mono text-red-600">{formatCurrency(balanceSheetData.totalLiabilities)}</p>
          </Card>
          <Card className="p-4 bg-purple-50 dark:bg-purple-950/30">
            <p className="text-xs text-muted-foreground">Total Equity</p>
            <p className="text-xl font-bold font-mono text-purple-600">{formatCurrency(balanceSheetData.totalEquity)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Liabilities + Equity</p>
            <p className="text-xl font-bold font-mono">{formatCurrency(balanceSheetData.totalLiabilitiesAndEquity)}</p>
          </Card>
        </div>
      )}

      {/* Report Footer */}
      <Card className="p-4 text-center text-sm text-muted-foreground">
        <p>Report generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
        <p>As at {new Date(asOfDate).toLocaleDateString()}</p>
      </Card>
    </div>
  );
}