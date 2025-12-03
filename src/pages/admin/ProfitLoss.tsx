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
import { TrendingUp, Download, Calendar, FileSpreadsheet } from 'lucide-react';
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
      // Fetch revenue and expense accounts
      const { data: accounts, error } = await supabase
        .from('accounts')
        .select('*')
        .in('account_type', ['revenue', 'expense'])
        .eq('is_active', true)
        .order('account_code');

      if (error) throw error;

      // Fetch Inventory account for Purchases calculation
      const { data: inventoryAccount } = await supabase
        .from('accounts')
        .select('*')
        .eq('account_code', '1020')
        .single();

      // Get purchases (debits to Inventory account) within date range
      let totalPurchases = 0;
      if (inventoryAccount) {
        const { data: inventoryLines } = await supabase
          .from('journal_entry_lines')
          .select(`
            debit_amount,
            credit_amount,
            journal_entries!inner (
              status,
              entry_date,
              description
            )
          `)
          .eq('account_id', inventoryAccount.id)
          .eq('journal_entries.status', 'posted')
          .gte('journal_entries.entry_date', startDate)
          .lte('journal_entries.entry_date', endDate);

        if (inventoryLines) {
          // Purchases are debits to inventory (excluding sales adjustments)
          totalPurchases = inventoryLines
            .filter((line: any) => !line.journal_entries?.description?.includes('POS Sale'))
            .reduce((sum: number, line: any) => sum + (line.debit_amount || 0), 0);
        }
      }

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

          const balance =
            account.account_type === 'revenue'
              ? totalCredit - totalDebit
              : totalDebit - totalCredit;

          return {
            ...account,
            balance,
            totalDebit,
            totalCredit,
          };
        })
      );

      const activeAccounts = accountsWithBalances.filter((acc) => acc !== null && acc.balance !== 0);

      // Categorize accounts
      const salesAccounts = activeAccounts.filter((a) => 
        a.account_type === 'revenue' && a.account_code?.startsWith('401')
      );
      const otherIncomeAccounts = activeAccounts.filter((a) => 
        a.account_type === 'revenue' && !a.account_code?.startsWith('401')
      );
      const cogsAccounts = activeAccounts.filter((a) => 
        a.account_type === 'expense' && 
        (a.account_code?.startsWith('501') || a.account_name?.toLowerCase().includes('cost of goods'))
      );
      const directExpenseAccounts = activeAccounts.filter((a) => 
        a.account_type === 'expense' && 
        a.account_code?.startsWith('502')
      );
      const adminExpenseAccounts = activeAccounts.filter((a) => 
        a.account_type === 'expense' && 
        (a.account_code?.startsWith('52') || a.account_code?.startsWith('53'))
      );
      const sellingExpenseAccounts = activeAccounts.filter((a) => 
        a.account_type === 'expense' && 
        a.account_code?.startsWith('54')
      );
      const otherExpenseAccounts = activeAccounts.filter((a) => 
        a.account_type === 'expense' && 
        !cogsAccounts.includes(a) && 
        !directExpenseAccounts.includes(a) && 
        !adminExpenseAccounts.includes(a) && 
        !sellingExpenseAccounts.includes(a)
      );

      const totalSales = salesAccounts.reduce((sum, acc) => sum + acc.balance, 0);
      const totalOtherIncome = otherIncomeAccounts.reduce((sum, acc) => sum + acc.balance, 0);
      const totalRevenue = totalSales + totalOtherIncome;
      
      const totalCOGS = cogsAccounts.reduce((sum, acc) => sum + acc.balance, 0);
      const totalDirectExpenses = directExpenseAccounts.reduce((sum, acc) => sum + acc.balance, 0);
      // Include purchases (inventory debits) in COGS calculation
      const totalCOGSAndPurchases = totalCOGS + totalPurchases;
      const grossProfit = totalRevenue - totalCOGSAndPurchases - totalDirectExpenses;
      
      const totalAdminExpenses = adminExpenseAccounts.reduce((sum, acc) => sum + acc.balance, 0);
      const totalSellingExpenses = sellingExpenseAccounts.reduce((sum, acc) => sum + acc.balance, 0);
      const totalOtherExpenses = otherExpenseAccounts.reduce((sum, acc) => sum + acc.balance, 0);
      const totalOperatingExpenses = totalAdminExpenses + totalSellingExpenses + totalOtherExpenses;
      
      const netIncome = grossProfit - totalOperatingExpenses;

      return {
        salesAccounts,
        otherIncomeAccounts,
        cogsAccounts,
        directExpenseAccounts,
        adminExpenseAccounts,
        sellingExpenseAccounts,
        otherExpenseAccounts,
        totalSales,
        totalOtherIncome,
        totalRevenue,
        totalCOGS,
        totalPurchases,
        totalCOGSAndPurchases,
        totalDirectExpenses,
        grossProfit,
        totalAdminExpenses,
        totalSellingExpenses,
        totalOtherExpenses,
        totalOperatingExpenses,
        netIncome,
        isProfit: netIncome >= 0,
      };
    },
  });

  const renderAccountSection = (title: string, accounts: any[], showCredit = false) => (
    <>
      {accounts.length > 0 && (
        <>
          <TableRow className="bg-muted/30">
            <TableCell className="font-semibold pl-6">{title}</TableCell>
            <TableCell></TableCell>
            <TableCell></TableCell>
          </TableRow>
          {accounts.map((account: any) => (
            <TableRow key={account.id}>
              <TableCell className="pl-10 text-sm">
                {account.account_code} - {account.account_name}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {!showCredit && account.balance > 0 ? formatCurrency(account.balance) : ''}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {showCredit && account.balance > 0 ? formatCurrency(account.balance) : ''}
              </TableCell>
            </TableRow>
          ))}
        </>
      )}
    </>
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="h-8 w-8" />
            Profit & Loss Account
          </h1>
          <p className="text-muted-foreground">Trading and Profit & Loss Statement</p>
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

      {/* Date Range Filter */}
      <Card className="p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <div className="grid grid-cols-2 gap-4 max-w-md flex-1">
            <div>
              <Label htmlFor="start-date">From</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="end-date">To</Label>
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

      {/* P&L Statement - Professional 2-Column Layout */}
      <Card className="overflow-hidden">
        <div className="bg-primary/5 p-4 border-b">
          <h2 className="text-xl font-bold text-center">PROFIT & LOSS ACCOUNT</h2>
          <p className="text-sm text-muted-foreground text-center">
            For the period {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}
          </p>
        </div>
        
        <div className="p-4">
          <Table>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-12">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : !plData ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-12">
                    No data available for this period
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {/* Header Row */}
                  <TableRow className="bg-primary/10 font-bold">
                    <TableCell className="w-1/2">Particulars</TableCell>
                    <TableCell className="text-right w-1/4">Debit (Dr.)</TableCell>
                    <TableCell className="text-right w-1/4">Credit (Cr.)</TableCell>
                  </TableRow>

                  {/* INCOME SECTION */}
                  <TableRow className="bg-green-50 dark:bg-green-950/30">
                    <TableCell colSpan={3} className="font-bold text-green-700 dark:text-green-400">
                      INCOME
                    </TableCell>
                  </TableRow>
                  
                  {renderAccountSection('Sales Revenue', plData.salesAccounts, true)}
                  {renderAccountSection('Other Income', plData.otherIncomeAccounts, true)}
                  
                  <TableRow className="font-bold bg-green-100 dark:bg-green-950/50">
                    <TableCell className="pl-4">Total Revenue</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right font-mono text-green-700 dark:text-green-400">
                      {formatCurrency(plData.totalRevenue)}
                    </TableCell>
                  </TableRow>

                  {/* Spacing */}
                  <TableRow><TableCell colSpan={3} className="h-2 p-0"></TableCell></TableRow>

                  {/* COST OF GOODS SOLD */}
                  <TableRow className="bg-orange-50 dark:bg-orange-950/30">
                    <TableCell colSpan={3} className="font-bold text-orange-700 dark:text-orange-400">
                      COST OF GOODS SOLD
                    </TableCell>
                  </TableRow>
                  
                  {/* Purchases from Inventory */}
                  {plData.totalPurchases > 0 && (
                    <TableRow>
                      <TableCell className="pl-10 text-sm">
                        Purchases (Inventory)
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(plData.totalPurchases)}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  )}
                  
                  {renderAccountSection('Cost of Goods Sold', plData.cogsAccounts, false)}
                  {renderAccountSection('Direct Expenses', plData.directExpenseAccounts, false)}
                  
                  <TableRow className="font-bold bg-orange-100 dark:bg-orange-950/50">
                    <TableCell className="pl-4">Total COGS & Direct Expenses</TableCell>
                    <TableCell className="text-right font-mono text-orange-700 dark:text-orange-400">
                      {formatCurrency(plData.totalCOGSAndPurchases + plData.totalDirectExpenses)}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>

                  {/* GROSS PROFIT */}
                  <TableRow className="font-bold bg-blue-100 dark:bg-blue-950/50 border-y-2 border-blue-300">
                    <TableCell className="text-blue-700 dark:text-blue-400 text-lg">
                      GROSS PROFIT
                    </TableCell>
                    <TableCell className={`text-right font-mono text-lg ${plData.grossProfit < 0 ? 'text-red-600' : ''}`}>
                      {plData.grossProfit < 0 ? formatCurrency(Math.abs(plData.grossProfit)) : ''}
                    </TableCell>
                    <TableCell className={`text-right font-mono text-lg ${plData.grossProfit >= 0 ? 'text-blue-700 dark:text-blue-400' : ''}`}>
                      {plData.grossProfit >= 0 ? formatCurrency(plData.grossProfit) : ''}
                    </TableCell>
                  </TableRow>

                  {/* Spacing */}
                  <TableRow><TableCell colSpan={3} className="h-2 p-0"></TableCell></TableRow>

                  {/* OPERATING EXPENSES */}
                  <TableRow className="bg-red-50 dark:bg-red-950/30">
                    <TableCell colSpan={3} className="font-bold text-red-700 dark:text-red-400">
                      OPERATING EXPENSES
                    </TableCell>
                  </TableRow>
                  
                  {renderAccountSection('Administrative Expenses', plData.adminExpenseAccounts, false)}
                  {renderAccountSection('Selling & Distribution', plData.sellingExpenseAccounts, false)}
                  {renderAccountSection('Other Expenses', plData.otherExpenseAccounts, false)}
                  
                  <TableRow className="font-bold bg-red-100 dark:bg-red-950/50">
                    <TableCell className="pl-4">Total Operating Expenses</TableCell>
                    <TableCell className="text-right font-mono text-red-700 dark:text-red-400">
                      {formatCurrency(plData.totalOperatingExpenses)}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>

                  {/* NET PROFIT/LOSS */}
                  <TableRow className={`font-bold border-y-4 ${plData.isProfit ? 'bg-green-200 dark:bg-green-900/50 border-green-400' : 'bg-red-200 dark:bg-red-900/50 border-red-400'}`}>
                    <TableCell className="text-lg py-4">
                      NET {plData.isProfit ? 'PROFIT' : 'LOSS'}
                    </TableCell>
                    <TableCell className={`text-right font-mono text-xl py-4 ${!plData.isProfit ? 'text-red-700 dark:text-red-400' : ''}`}>
                      {!plData.isProfit ? formatCurrency(Math.abs(plData.netIncome)) : ''}
                    </TableCell>
                    <TableCell className={`text-right font-mono text-xl py-4 ${plData.isProfit ? 'text-green-700 dark:text-green-400' : ''}`}>
                      {plData.isProfit ? formatCurrency(plData.netIncome) : ''}
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Summary Cards */}
      {plData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Total Revenue</p>
            <p className="text-lg font-bold font-mono text-green-600">{formatCurrency(plData.totalRevenue)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">COGS & Purchases</p>
            <p className="text-lg font-bold font-mono text-orange-600">{formatCurrency(plData.totalCOGSAndPurchases + plData.totalDirectExpenses)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Gross Profit</p>
            <p className={`text-lg font-bold font-mono ${plData.grossProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {formatCurrency(plData.grossProfit)}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Net {plData.isProfit ? 'Profit' : 'Loss'}</p>
            <p className={`text-lg font-bold font-mono ${plData.isProfit ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(Math.abs(plData.netIncome))}
            </p>
          </Card>
        </div>
      )}

      {/* Report Footer */}
      <Card className="p-4 text-center text-sm text-muted-foreground">
        <p>Report generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
      </Card>
    </div>
  );
}