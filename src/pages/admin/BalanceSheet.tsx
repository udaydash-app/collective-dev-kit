import { useState } from 'react';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
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

  // Helper to get max rows for T-account alignment
  const getMaxRows = () => {
    if (!balanceSheetData) return 0;
    const assetRows = 
      balanceSheetData.currentAssets.length + 
      balanceSheetData.fixedAssets.length + 
      balanceSheetData.otherAssets.length + 6; // headers and subtotals
    const liabilityEquityRows = 
      balanceSheetData.currentLiabilities.length + 
      balanceSheetData.longTermLiabilities.length + 
      balanceSheetData.otherLiabilities.length +
      balanceSheetData.capitalAccounts.length +
      balanceSheetData.reserveAccounts.length +
      balanceSheetData.retainedEarnings.length + 10;
    return Math.max(assetRows, liabilityEquityRows);
  };

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

      {/* Traditional T-Account Balance Sheet */}
      <Card className="overflow-hidden">
        {/* Header */}
        <div className="bg-muted/50 p-4 border-b text-center">
          <h2 className="text-xl font-bold">BALANCE SHEET</h2>
          <p className="text-sm text-muted-foreground">
            As at {new Date(asOfDate).toLocaleDateString()}
          </p>
        </div>

        {isLoading ? (
          <div className="p-12 text-center">Loading...</div>
        ) : !balanceSheetData ? (
          <div className="p-12 text-center">No data available</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/30 border-b-2 border-border">
                  <th className="p-3 text-left font-bold border-r border-border w-[35%]">Liabilities</th>
                  <th className="p-3 text-right font-bold border-r border-border w-[15%]">Amount</th>
                  <th className="p-3 text-left font-bold border-r border-border w-[35%]">Assets</th>
                  <th className="p-3 text-right font-bold w-[15%]">Amount</th>
                </tr>
              </thead>
              <tbody>
                {/* Capital/Equity Section on Left, Fixed Assets on Right */}
                <tr className="bg-muted/10">
                  <td className="p-2 font-bold border-r border-border">Capital & Reserves</td>
                  <td className="p-2 border-r border-border"></td>
                  <td className="p-2 font-bold border-r border-border">Fixed Assets</td>
                  <td className="p-2"></td>
                </tr>
                
                {/* Capital Accounts */}
                {balanceSheetData.capitalAccounts.map((acc) => (
                  <tr key={`cap-${acc.id}`} className="border-b border-border/30">
                    <td className="p-2 pl-6 border-r border-border">
                      <span className="font-mono text-xs text-muted-foreground mr-2">{acc.account_code}</span>
                      {acc.account_name}
                    </td>
                    <td className="p-2 text-right font-mono border-r border-border">
                      {formatCurrency(Math.abs(acc.balance))}
                    </td>
                    <td className="p-2 border-r border-border"></td>
                    <td className="p-2"></td>
                  </tr>
                ))}

                {/* Reserve Accounts */}
                {balanceSheetData.reserveAccounts.map((acc) => (
                  <tr key={`res-${acc.id}`} className="border-b border-border/30">
                    <td className="p-2 pl-6 border-r border-border">
                      <span className="font-mono text-xs text-muted-foreground mr-2">{acc.account_code}</span>
                      {acc.account_name}
                    </td>
                    <td className="p-2 text-right font-mono border-r border-border">
                      {formatCurrency(Math.abs(acc.balance))}
                    </td>
                    <td className="p-2 border-r border-border"></td>
                    <td className="p-2"></td>
                  </tr>
                ))}

                {/* Retained Earnings */}
                {balanceSheetData.retainedEarnings.map((acc) => (
                  <tr key={`ret-${acc.id}`} className="border-b border-border/30">
                    <td className="p-2 pl-6 border-r border-border">
                      <span className="font-mono text-xs text-muted-foreground mr-2">{acc.account_code}</span>
                      {acc.account_name}
                    </td>
                    <td className="p-2 text-right font-mono border-r border-border">
                      {formatCurrency(Math.abs(acc.balance))}
                    </td>
                    <td className="p-2 border-r border-border"></td>
                    <td className="p-2"></td>
                  </tr>
                ))}

                {/* Fixed Assets on Right */}
                {balanceSheetData.fixedAssets.map((acc, idx) => (
                  <tr key={`fixed-${acc.id}`} className="border-b border-border/30">
                    <td className="p-2 border-r border-border"></td>
                    <td className="p-2 border-r border-border"></td>
                    <td className="p-2 pl-6 border-r border-border">
                      <span className="font-mono text-xs text-muted-foreground mr-2">{acc.account_code}</span>
                      {acc.account_name}
                    </td>
                    <td className="p-2 text-right font-mono">
                      {formatCurrency(Math.abs(acc.balance))}
                    </td>
                  </tr>
                ))}

                {/* Subtotal for Capital & Reserves / Fixed Assets */}
                <tr className="bg-muted/20 font-semibold">
                  <td className="p-2 text-right border-r border-border">Total Capital & Reserves</td>
                  <td className="p-2 text-right font-mono border-r border-border">
                    {formatCurrency(balanceSheetData.totalEquity)}
                  </td>
                  <td className="p-2 text-right border-r border-border">Total Fixed Assets</td>
                  <td className="p-2 text-right font-mono">
                    {formatCurrency(balanceSheetData.totalFixedAssets)}
                  </td>
                </tr>

                {/* Spacer */}
                <tr><td colSpan={4} className="h-2 bg-muted/5"></td></tr>

                {/* Liabilities Section on Left, Current Assets on Right */}
                <tr className="bg-muted/10">
                  <td className="p-2 font-bold border-r border-border">Liabilities</td>
                  <td className="p-2 border-r border-border"></td>
                  <td className="p-2 font-bold border-r border-border">Current Assets</td>
                  <td className="p-2"></td>
                </tr>

                {/* Current Liabilities */}
                {balanceSheetData.currentLiabilities.map((acc) => (
                  <tr key={`cl-${acc.id}`} className="border-b border-border/30">
                    <td className="p-2 pl-6 border-r border-border">
                      <span className="font-mono text-xs text-muted-foreground mr-2">{acc.account_code}</span>
                      {acc.account_name}
                    </td>
                    <td className="p-2 text-right font-mono border-r border-border">
                      {formatCurrency(Math.abs(acc.balance))}
                    </td>
                    <td className="p-2 border-r border-border"></td>
                    <td className="p-2"></td>
                  </tr>
                ))}

                {/* Long-term Liabilities */}
                {balanceSheetData.longTermLiabilities.map((acc) => (
                  <tr key={`lt-${acc.id}`} className="border-b border-border/30">
                    <td className="p-2 pl-6 border-r border-border">
                      <span className="font-mono text-xs text-muted-foreground mr-2">{acc.account_code}</span>
                      {acc.account_name}
                    </td>
                    <td className="p-2 text-right font-mono border-r border-border">
                      {formatCurrency(Math.abs(acc.balance))}
                    </td>
                    <td className="p-2 border-r border-border"></td>
                    <td className="p-2"></td>
                  </tr>
                ))}

                {/* Other Liabilities */}
                {balanceSheetData.otherLiabilities.map((acc) => (
                  <tr key={`ol-${acc.id}`} className="border-b border-border/30">
                    <td className="p-2 pl-6 border-r border-border">
                      <span className="font-mono text-xs text-muted-foreground mr-2">{acc.account_code}</span>
                      {acc.account_name}
                    </td>
                    <td className="p-2 text-right font-mono border-r border-border">
                      {formatCurrency(Math.abs(acc.balance))}
                    </td>
                    <td className="p-2 border-r border-border"></td>
                    <td className="p-2"></td>
                  </tr>
                ))}

                {/* Current Assets on Right */}
                {balanceSheetData.currentAssets.map((acc) => (
                  <tr key={`ca-${acc.id}`} className="border-b border-border/30">
                    <td className="p-2 border-r border-border"></td>
                    <td className="p-2 border-r border-border"></td>
                    <td className="p-2 pl-6 border-r border-border">
                      <span className="font-mono text-xs text-muted-foreground mr-2">{acc.account_code}</span>
                      {acc.account_name}
                    </td>
                    <td className="p-2 text-right font-mono">
                      {formatCurrency(Math.abs(acc.balance))}
                    </td>
                  </tr>
                ))}

                {/* Other Assets on Right */}
                {balanceSheetData.otherAssets.map((acc) => (
                  <tr key={`oa-${acc.id}`} className="border-b border-border/30">
                    <td className="p-2 border-r border-border"></td>
                    <td className="p-2 border-r border-border"></td>
                    <td className="p-2 pl-6 border-r border-border">
                      <span className="font-mono text-xs text-muted-foreground mr-2">{acc.account_code}</span>
                      {acc.account_name}
                    </td>
                    <td className="p-2 text-right font-mono">
                      {formatCurrency(Math.abs(acc.balance))}
                    </td>
                  </tr>
                ))}

                {/* Subtotal for Liabilities / Current Assets */}
                <tr className="bg-muted/20 font-semibold">
                  <td className="p-2 text-right border-r border-border">Total Liabilities</td>
                  <td className="p-2 text-right font-mono border-r border-border">
                    {formatCurrency(balanceSheetData.totalLiabilities)}
                  </td>
                  <td className="p-2 text-right border-r border-border">Total Current Assets</td>
                  <td className="p-2 text-right font-mono">
                    {formatCurrency(balanceSheetData.totalCurrentAssets + balanceSheetData.totalOtherAssets)}
                  </td>
                </tr>

                {/* Grand Totals */}
                <tr className="bg-primary/10 font-bold border-t-4 border-primary">
                  <td className="p-3 text-right border-r border-border text-lg">TOTAL</td>
                  <td className="p-3 text-right font-mono text-lg border-r border-border">
                    {formatCurrency(balanceSheetData.totalLiabilitiesAndEquity)}
                  </td>
                  <td className="p-3 text-right border-r border-border text-lg">TOTAL</td>
                  <td className="p-3 text-right font-mono text-lg">
                    {formatCurrency(balanceSheetData.totalAssets)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Report Footer */}
      <Card className="p-4 text-center text-sm text-muted-foreground">
        <p>Report generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
        <p>As at {new Date(asOfDate).toLocaleDateString()}</p>
      </Card>
    </div>
  );
}
