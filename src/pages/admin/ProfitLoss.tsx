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
      // Get Purchases directly from purchases table
      const { data: purchases } = await supabase
        .from('purchases')
        .select('total_amount')
        .gte('purchased_at', startDate)
        .lte('purchased_at', endDate + 'T23:59:59');

      const totalPurchases = purchases?.reduce((sum, p) => sum + (p.total_amount || 0), 0) || 0;

      // Get Sales directly from pos_transactions
      const { data: sales } = await supabase
        .from('pos_transactions')
        .select('subtotal, discount')
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59');

      const grossSales = sales?.reduce((sum, s) => sum + (s.subtotal || 0), 0) || 0;
      const salesReturns = 0; // Would need a returns table
      const salesDiscounts = sales?.reduce((sum, s) => sum + (s.discount || 0), 0) || 0;
      const netSales = grossSales - salesReturns - salesDiscounts;

      // Get Inventory account for stock calculations
      const { data: inventoryAccount } = await supabase
        .from('accounts')
        .select('*')
        .eq('account_code', '1020')
        .single();

      let openingStock = 0;
      let closingStock = 0;

      if (inventoryAccount) {
        // Opening Stock: Inventory balance before start date
        const { data: openingLines } = await supabase
          .from('journal_entry_lines')
          .select(`debit_amount, credit_amount, journal_entries!inner (status, entry_date)`)
          .eq('account_id', inventoryAccount.id)
          .eq('journal_entries.status', 'posted')
          .lt('journal_entries.entry_date', startDate);

        if (openingLines) {
          const debits = openingLines.reduce((sum: number, l: any) => sum + (l.debit_amount || 0), 0);
          const credits = openingLines.reduce((sum: number, l: any) => sum + (l.credit_amount || 0), 0);
          openingStock = debits - credits;
        }

        // Closing Stock: Inventory balance at end of period
        const { data: closingLines } = await supabase
          .from('journal_entry_lines')
          .select(`debit_amount, credit_amount, journal_entries!inner (status, entry_date)`)
          .eq('account_id', inventoryAccount.id)
          .eq('journal_entries.status', 'posted')
          .lte('journal_entries.entry_date', endDate);

        if (closingLines) {
          const debits = closingLines.reduce((sum: number, l: any) => sum + (l.debit_amount || 0), 0);
          const credits = closingLines.reduce((sum: number, l: any) => sum + (l.credit_amount || 0), 0);
          closingStock = debits - credits;
        }
      }

      // Purchase Returns (if any - from journal entries)
      const purchaseReturns = 0; // Would need purchase returns tracking

      // Direct Expenses (Carriage Inward, etc.)
      const { data: expenseAccounts } = await supabase
        .from('accounts')
        .select('*')
        .eq('account_type', 'expense')
        .eq('is_active', true)
        .order('account_code');

      // Get expense account balances
      const expenseBalances = await Promise.all(
        (expenseAccounts || []).map(async (account) => {
          const { data: lines } = await supabase
            .from('journal_entry_lines')
            .select(`debit_amount, credit_amount, journal_entries!inner (status, entry_date)`)
            .eq('account_id', account.id)
            .eq('journal_entries.status', 'posted')
            .gte('journal_entries.entry_date', startDate)
            .lte('journal_entries.entry_date', endDate);

          if (!lines || lines.length === 0) return null;
          const balance = lines.reduce((sum, l) => sum + l.debit_amount - l.credit_amount, 0);
          return { ...account, balance };
        })
      );

      const activeExpenses = expenseBalances.filter((e) => e !== null && e.balance !== 0);

      // Categorize expenses
      const directExpenses = activeExpenses.filter((a) => a.account_code?.startsWith('502'));
      const adminExpenses = activeExpenses.filter((a) => 
        a.account_code?.startsWith('52') || a.account_code?.startsWith('53')
      );
      const sellingExpenses = activeExpenses.filter((a) => a.account_code?.startsWith('54'));
      const otherExpenses = activeExpenses.filter((a) => 
        !a.account_code?.startsWith('501') &&
        !directExpenses.includes(a) && 
        !adminExpenses.includes(a) && 
        !sellingExpenses.includes(a)
      );

      const totalDirectExpenses = directExpenses.reduce((sum, a) => sum + a.balance, 0);
      const totalAdminExpenses = adminExpenses.reduce((sum, a) => sum + a.balance, 0);
      const totalSellingExpenses = sellingExpenses.reduce((sum, a) => sum + a.balance, 0);
      const totalOtherExpenses = otherExpenses.reduce((sum, a) => sum + a.balance, 0);

      // Trading Account Calculations
      // Dr Side: Opening Stock + Purchases - Returns + Direct Expenses + Gross Profit
      // Cr Side: Sales - Returns + Closing Stock
      const tradingDrTotal = openingStock + totalPurchases - purchaseReturns + totalDirectExpenses;
      const tradingCrTotal = netSales + closingStock;
      const grossProfit = tradingCrTotal - tradingDrTotal;

      // P&L Account Calculations
      const totalOperatingExpenses = totalAdminExpenses + totalSellingExpenses + totalOtherExpenses;
      const netProfit = grossProfit - totalOperatingExpenses;

      return {
        // Trading Account
        openingStock,
        totalPurchases,
        purchaseReturns,
        totalDirectExpenses,
        directExpenses,
        grossSales,
        salesReturns,
        salesDiscounts,
        netSales,
        closingStock,
        grossProfit,
        tradingDrTotal: tradingDrTotal + (grossProfit > 0 ? grossProfit : 0),
        tradingCrTotal: tradingCrTotal + (grossProfit < 0 ? Math.abs(grossProfit) : 0),
        // P&L Account
        adminExpenses,
        sellingExpenses,
        otherExpenses,
        totalAdminExpenses,
        totalSellingExpenses,
        totalOtherExpenses,
        totalOperatingExpenses,
        netProfit,
        isProfit: netProfit >= 0,
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
          {isLoading ? (
            <div className="text-center py-12">Loading...</div>
          ) : !plData ? (
            <div className="text-center py-12">No data available for this period</div>
          ) : (
            <>
              {/* TRADING ACCOUNT */}
              <div className="mb-8">
                <h3 className="text-lg font-bold text-center mb-4 bg-muted p-2">TRADING ACCOUNT</h3>
                <div className="grid grid-cols-2 gap-0 border">
                  {/* Dr Side */}
                  <div className="border-r">
                    <div className="bg-muted/50 p-2 font-bold border-b">Dr</div>
                    <Table>
                      <TableBody>
                        <TableRow className="border-b bg-muted/30">
                          <TableCell className="font-semibold">Particulars</TableCell>
                          <TableCell className="text-right font-semibold w-32">Amt.</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>To Opening Stock</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(plData.openingStock)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>To Purchases</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(plData.totalPurchases)}</TableCell>
                        </TableRow>
                        {plData.purchaseReturns > 0 && (
                          <TableRow>
                            <TableCell className="text-red-600">(-) Return Outwards</TableCell>
                            <TableCell className="text-right font-mono text-red-600">({formatCurrency(plData.purchaseReturns)})</TableCell>
                          </TableRow>
                        )}
                        {plData.directExpenses.map((exp: any) => (
                          <TableRow key={exp.id}>
                            <TableCell>To {exp.account_name}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(exp.balance)}</TableCell>
                          </TableRow>
                        ))}
                        {plData.grossProfit > 0 && (
                          <TableRow className="bg-green-50 dark:bg-green-950/30">
                            <TableCell className="font-bold text-green-700">To Gross Profit c/d</TableCell>
                            <TableCell className="text-right font-mono font-bold text-green-700">{formatCurrency(plData.grossProfit)}</TableCell>
                          </TableRow>
                        )}
                        <TableRow className="border-t-2 bg-muted">
                          <TableCell className="font-bold">Total</TableCell>
                          <TableCell className="text-right font-mono font-bold">{formatCurrency(plData.tradingDrTotal)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  
                  {/* Cr Side */}
                  <div>
                    <div className="bg-muted/50 p-2 font-bold border-b">Cr</div>
                    <Table>
                      <TableBody>
                        <TableRow className="border-b bg-muted/30">
                          <TableCell className="font-semibold">Particulars</TableCell>
                          <TableCell className="text-right font-semibold w-32">Amt.</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>By Sales</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(plData.grossSales)}</TableCell>
                        </TableRow>
                        {plData.salesReturns > 0 && (
                          <TableRow>
                            <TableCell className="text-red-600">(-) Return Inwards</TableCell>
                            <TableCell className="text-right font-mono text-red-600">({formatCurrency(plData.salesReturns)})</TableCell>
                          </TableRow>
                        )}
                        {plData.salesDiscounts > 0 && (
                          <TableRow>
                            <TableCell className="text-red-600">(-) Sales Discounts</TableCell>
                            <TableCell className="text-right font-mono text-red-600">({formatCurrency(plData.salesDiscounts)})</TableCell>
                          </TableRow>
                        )}
                        <TableRow>
                          <TableCell>By Closing Stock</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(plData.closingStock)}</TableCell>
                        </TableRow>
                        {plData.grossProfit < 0 && (
                          <TableRow className="bg-red-50 dark:bg-red-950/30">
                            <TableCell className="font-bold text-red-700">By Gross Loss c/d</TableCell>
                            <TableCell className="text-right font-mono font-bold text-red-700">{formatCurrency(Math.abs(plData.grossProfit))}</TableCell>
                          </TableRow>
                        )}
                        <TableRow className="border-t-2 bg-muted">
                          <TableCell className="font-bold">Total</TableCell>
                          <TableCell className="text-right font-mono font-bold">{formatCurrency(plData.tradingCrTotal)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>

              {/* PROFIT & LOSS ACCOUNT */}
              <div>
                <h3 className="text-lg font-bold text-center mb-4 bg-muted p-2">PROFIT & LOSS ACCOUNT</h3>
                <div className="grid grid-cols-2 gap-0 border">
                  {/* Dr Side - Expenses */}
                  <div className="border-r">
                    <div className="bg-muted/50 p-2 font-bold border-b">Dr</div>
                    <Table>
                      <TableBody>
                        <TableRow className="border-b bg-muted/30">
                          <TableCell className="font-semibold">Particulars</TableCell>
                          <TableCell className="text-right font-semibold w-32">Amt.</TableCell>
                        </TableRow>
                        {plData.adminExpenses.map((exp: any) => (
                          <TableRow key={exp.id}>
                            <TableCell>To {exp.account_name}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(exp.balance)}</TableCell>
                          </TableRow>
                        ))}
                        {plData.sellingExpenses.map((exp: any) => (
                          <TableRow key={exp.id}>
                            <TableCell>To {exp.account_name}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(exp.balance)}</TableCell>
                          </TableRow>
                        ))}
                        {plData.otherExpenses.map((exp: any) => (
                          <TableRow key={exp.id}>
                            <TableCell>To {exp.account_name}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(exp.balance)}</TableCell>
                          </TableRow>
                        ))}
                        {plData.netProfit > 0 && (
                          <TableRow className="bg-green-50 dark:bg-green-950/30">
                            <TableCell className="font-bold text-green-700">To Net Profit</TableCell>
                            <TableCell className="text-right font-mono font-bold text-green-700">{formatCurrency(plData.netProfit)}</TableCell>
                          </TableRow>
                        )}
                        <TableRow className="border-t-2 bg-muted">
                          <TableCell className="font-bold">Total</TableCell>
                          <TableCell className="text-right font-mono font-bold">
                            {formatCurrency(plData.totalOperatingExpenses + (plData.netProfit > 0 ? plData.netProfit : 0))}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  
                  {/* Cr Side - Income */}
                  <div>
                    <div className="bg-muted/50 p-2 font-bold border-b">Cr</div>
                    <Table>
                      <TableBody>
                        <TableRow className="border-b bg-muted/30">
                          <TableCell className="font-semibold">Particulars</TableCell>
                          <TableCell className="text-right font-semibold w-32">Amt.</TableCell>
                        </TableRow>
                        <TableRow className={plData.grossProfit >= 0 ? 'bg-green-50 dark:bg-green-950/30' : 'bg-red-50 dark:bg-red-950/30'}>
                          <TableCell className="font-bold">By Gross {plData.grossProfit >= 0 ? 'Profit' : 'Loss'} b/d</TableCell>
                          <TableCell className="text-right font-mono font-bold">{formatCurrency(Math.abs(plData.grossProfit))}</TableCell>
                        </TableRow>
                        {plData.netProfit < 0 && (
                          <TableRow className="bg-red-50 dark:bg-red-950/30">
                            <TableCell className="font-bold text-red-700">By Net Loss</TableCell>
                            <TableCell className="text-right font-mono font-bold text-red-700">{formatCurrency(Math.abs(plData.netProfit))}</TableCell>
                          </TableRow>
                        )}
                        <TableRow className="border-t-2 bg-muted">
                          <TableCell className="font-bold">Total</TableCell>
                          <TableCell className="text-right font-mono font-bold">
                            {formatCurrency(Math.abs(plData.grossProfit) + (plData.netProfit < 0 ? Math.abs(plData.netProfit) : 0))}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Summary Cards */}
      {plData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Net Sales</p>
            <p className="text-lg font-bold font-mono text-green-600">{formatCurrency(plData.netSales)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Purchases</p>
            <p className="text-lg font-bold font-mono text-orange-600">{formatCurrency(plData.totalPurchases)}</p>
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
              {formatCurrency(Math.abs(plData.netProfit))}
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