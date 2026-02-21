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
import { Droplets, Download, Calendar } from 'lucide-react';
import { usePageView } from '@/hooks/useAnalytics';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { ReturnToPOSButton } from '@/components/layout/ReturnToPOSButton';

export default function CashFlow() {
  usePageView('Admin - Cash Flow Statement');
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: cashFlowData, isLoading } = useQuery({
    queryKey: ['cash-flow', startDate, endDate],
    queryFn: async () => {
      // Get cash account (571 - Caisse SYSCOHADA)
      const { data: cashAccounts } = await supabase
        .from('accounts')
        .select('id')
        .eq('account_code', '571')
        .eq('is_active', true);

      if (!cashAccounts || cashAccounts.length === 0) {
        console.log('No cash accounts found for 571 (Caisse)');
        return {
          operatingActivities: [],
          investingActivities: [],
          financingActivities: [],
          netOperating: 0,
          netInvesting: 0,
          netFinancing: 0,
          netCashFlow: 0,
          beginningCash: 0,
          endingCash: 0,
        };
      }

      const cashAccountId = cashAccounts[0].id;
      console.log('Cash account ID:', cashAccountId);

      // Get journal lines for cash account with journal entry data in date range
      const { data: journalLines, error: jlError } = await supabase
        .from('journal_entry_lines')
        .select(`
          debit_amount,
          credit_amount,
          journal_entry_id,
          journal_entries!inner (
            id,
            entry_number,
            entry_date,
            description,
            status
          )
        `)
        .eq('account_id', cashAccountId)
        .eq('journal_entries.status', 'posted')
        .gte('journal_entries.entry_date', startDate)
        .lte('journal_entries.entry_date', endDate);

      console.log('Journal lines for cash:', journalLines?.length, jlError);

      // Calculate beginning cash balance (before start date)
      const { data: beginningLines, error: blError } = await supabase
        .from('journal_entry_lines')
        .select(`
          debit_amount,
          credit_amount,
          journal_entries!inner (status, entry_date)
        `)
        .eq('account_id', cashAccountId)
        .eq('journal_entries.status', 'posted')
        .lt('journal_entries.entry_date', startDate);

      console.log('Beginning lines:', beginningLines?.length, blError);

      const beginningCash = beginningLines?.reduce((sum, line) => {
        return sum + line.debit_amount - line.credit_amount;
      }, 0) || 0;

      // Process each journal entry
      const operatingActivities: any[] = [];
      const investingActivities: any[] = [];
      const financingActivities: any[] = [];

      const processedEntries = new Set();
      journalLines?.forEach((line: any) => {
        const je = line.journal_entries;
        if (!je || processedEntries.has(je.entry_number)) return;
        processedEntries.add(je.entry_number);

        const cashEffect = line.debit_amount - line.credit_amount;
        const description = je.description.toLowerCase();
        
        if (
          description.includes('sale') ||
          description.includes('revenue') ||
          description.includes('expense') ||
          description.includes('purchase') ||
          description.includes('payment')
        ) {
          operatingActivities.push({
            date: je.entry_date,
            description: je.description,
            amount: cashEffect,
          });
        } else if (
          description.includes('equipment') ||
          description.includes('asset') ||
          description.includes('investment')
        ) {
          investingActivities.push({
            date: je.entry_date,
            description: je.description,
            amount: cashEffect,
          });
        } else if (
          description.includes('loan') ||
          description.includes('capital') ||
          description.includes('equity') ||
          description.includes('dividend')
        ) {
          financingActivities.push({
            date: je.entry_date,
            description: je.description,
            amount: cashEffect,
          });
        } else {
          // Default to operating
          operatingActivities.push({
            date: je.entry_date,
            description: je.description,
            amount: cashEffect,
          });
        }
      });

      const netOperating = operatingActivities.reduce((sum, item) => sum + item.amount, 0);
      const netInvesting = investingActivities.reduce((sum, item) => sum + item.amount, 0);
      const netFinancing = financingActivities.reduce((sum, item) => sum + item.amount, 0);
      const netCashFlow = netOperating + netInvesting + netFinancing;
      const endingCash = beginningCash + netCashFlow;

      return {
        operatingActivities,
        investingActivities,
        financingActivities,
        netOperating,
        netInvesting,
        netFinancing,
        netCashFlow,
        beginningCash,
        endingCash,
      };
    },
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Droplets className="h-8 w-8" />
            Cash Flow Statement
          </h1>
          <p className="text-muted-foreground">Statement of cash flows</p>
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
      {cashFlowData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Beginning Cash</p>
            <p className="text-2xl font-bold font-mono">
              {formatCurrency(cashFlowData.beginningCash)}
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Net Cash Flow</p>
            <p
              className={`text-2xl font-bold font-mono ${
                cashFlowData.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {formatCurrency(Math.abs(cashFlowData.netCashFlow))}
              {cashFlowData.netCashFlow < 0 && ' (-)'}
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Ending Cash</p>
            <p className="text-2xl font-bold font-mono">
              {formatCurrency(cashFlowData.endingCash)}
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Change</p>
            <p
              className={`text-2xl font-bold font-mono ${
                cashFlowData.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {cashFlowData.netCashFlow >= 0 ? '+' : ''}
              {((cashFlowData.netCashFlow / (cashFlowData.beginningCash || 1)) * 100).toFixed(1)}%
            </p>
          </Card>
        </div>
      )}

      {/* Cash Flow Statement */}
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Statement of Cash Flows</h2>
          <p className="text-sm text-muted-foreground mb-6">
            For the period {formatDate(startDate)} to{' '}
            {formatDate(endDate)}
          </p>

          <Table>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : !cashFlowData ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center py-8">
                    No cash flow data available
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {/* Operating Activities */}
                  <TableRow className="bg-blue-50">
                    <TableCell colSpan={2} className="font-bold text-lg">
                      CASH FLOWS FROM OPERATING ACTIVITIES
                    </TableCell>
                  </TableRow>
                  {cashFlowData.operatingActivities.length > 0 ? (
                    cashFlowData.operatingActivities.map((item: any, index: number) => (
                      <TableRow key={`op-${index}`}>
                        <TableCell className="pl-8">
                          <div>
                            <p>{item.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(item.date)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono ${
                            item.amount >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {item.amount >= 0 ? '' : '('}
                          {formatCurrency(Math.abs(item.amount))}
                          {item.amount < 0 && ')'}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell className="pl-8 text-muted-foreground" colSpan={2}>
                        No operating activities
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow className="font-bold bg-blue-100">
                    <TableCell>Net Cash from Operating Activities</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(cashFlowData.netOperating)}
                    </TableCell>
                  </TableRow>

                  {/* Spacing */}
                  <TableRow>
                    <TableCell colSpan={2} className="h-4"></TableCell>
                  </TableRow>

                  {/* Investing Activities */}
                  <TableRow className="bg-purple-50">
                    <TableCell colSpan={2} className="font-bold text-lg">
                      CASH FLOWS FROM INVESTING ACTIVITIES
                    </TableCell>
                  </TableRow>
                  {cashFlowData.investingActivities.length > 0 ? (
                    cashFlowData.investingActivities.map((item: any, index: number) => (
                      <TableRow key={`inv-${index}`}>
                        <TableCell className="pl-8">
                          <div>
                            <p>{item.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(item.date)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono ${
                            item.amount >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {item.amount >= 0 ? '' : '('}
                          {formatCurrency(Math.abs(item.amount))}
                          {item.amount < 0 && ')'}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell className="pl-8 text-muted-foreground" colSpan={2}>
                        No investing activities
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow className="font-bold bg-purple-100">
                    <TableCell>Net Cash from Investing Activities</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(cashFlowData.netInvesting)}
                    </TableCell>
                  </TableRow>

                  {/* Spacing */}
                  <TableRow>
                    <TableCell colSpan={2} className="h-4"></TableCell>
                  </TableRow>

                  {/* Financing Activities */}
                  <TableRow className="bg-orange-50">
                    <TableCell colSpan={2} className="font-bold text-lg">
                      CASH FLOWS FROM FINANCING ACTIVITIES
                    </TableCell>
                  </TableRow>
                  {cashFlowData.financingActivities.length > 0 ? (
                    cashFlowData.financingActivities.map((item: any, index: number) => (
                      <TableRow key={`fin-${index}`}>
                        <TableCell className="pl-8">
                          <div>
                            <p>{item.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(item.date)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono ${
                            item.amount >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {item.amount >= 0 ? '' : '('}
                          {formatCurrency(Math.abs(item.amount))}
                          {item.amount < 0 && ')'}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell className="pl-8 text-muted-foreground" colSpan={2}>
                        No financing activities
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow className="font-bold bg-orange-100">
                    <TableCell>Net Cash from Financing Activities</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(cashFlowData.netFinancing)}
                    </TableCell>
                  </TableRow>

                  {/* Net Change */}
                  <TableRow className="border-t-2 border-primary">
                    <TableCell className="font-bold text-lg">
                      NET INCREASE (DECREASE) IN CASH
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono font-bold text-lg ${
                        cashFlowData.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {formatCurrency(cashFlowData.netCashFlow)}
                    </TableCell>
                  </TableRow>

                  {/* Beginning and Ending Cash */}
                  <TableRow>
                    <TableCell>Cash at Beginning of Period</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(cashFlowData.beginningCash)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="font-bold bg-primary/10 border-t-2">
                    <TableCell className="text-lg">Cash at End of Period</TableCell>
                    <TableCell className="text-right font-mono text-lg">
                      {formatCurrency(cashFlowData.endingCash)}
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
          Report generated on {formatDateTime(new Date())}
        </p>
        <p className="mt-1">
          Note: Cash flow categorization is simplified. For accurate reporting, ensure proper
          classification of transactions.
        </p>
      </Card>
    </div>
  );
}
