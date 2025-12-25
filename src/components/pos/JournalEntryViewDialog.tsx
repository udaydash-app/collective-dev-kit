import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import { BookOpen, Calendar, FileText, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface JournalEntryViewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  entry: {
    id: string;
    reference: string;
    description?: string;
    entry_date: string;
    created_at: string;
    total_debit: number;
    total_credit: number;
    status: string;
  } | null;
}

export const JournalEntryViewDialog = ({ isOpen, onClose, entry }: JournalEntryViewDialogProps) => {
  // Fetch journal entry lines with account details
  const { data: entryLines, isLoading } = useQuery({
    queryKey: ['journal-entry-lines', entry?.id],
    queryFn: async () => {
      if (!entry?.id) return [];
      
      const { data, error } = await supabase
        .from('journal_entry_lines')
        .select(`
          id,
          debit_amount,
          credit_amount,
          description,
          accounts (
            id,
            account_code,
            account_name,
            account_type
          )
        `)
        .eq('journal_entry_id', entry.id)
        .order('debit_amount', { ascending: false });
      
      if (error) {
        console.error('Error fetching journal entry lines:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: isOpen && !!entry?.id
  });

  if (!entry) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'posted':
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-200';
      case 'draft':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-200';
      case 'void':
        return 'bg-red-500/10 text-red-600 border-red-200';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-primary/5 to-primary/10">
          <DialogTitle className="text-xl font-bold flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <span>Journal Entry</span>
              <Badge className={`ml-3 ${getStatusColor(entry.status)}`}>
                {entry.status.toUpperCase()}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)]">
          <div className="p-6 space-y-4">
            {/* Entry Info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Reference:</span>
                <span className="font-medium">{entry.reference || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Date:</span>
                <span className="font-medium">{format(new Date(entry.created_at), 'MMM dd, yyyy HH:mm')}</span>
              </div>
            </div>
            
            {entry.description && (
              <div className="text-sm">
                <span className="text-muted-foreground">Description: </span>
                <span className="font-medium">{entry.description}</span>
              </div>
            )}

            <Separator />

            {/* Journal Entry Lines */}
            <div>
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                Entry Lines
              </h3>
              
              {isLoading ? (
                <div className="text-center py-4 text-muted-foreground text-sm">Loading lines...</div>
              ) : entryLines && entryLines.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow className="text-xs">
                        <TableHead className="text-[10px] py-2 px-2">Account</TableHead>
                        <TableHead className="text-right text-[10px] py-2 px-2 w-[100px]">
                          <div className="flex items-center justify-end gap-1">
                            <ArrowUpRight className="h-3 w-3 text-blue-600" />
                            Debit
                          </div>
                        </TableHead>
                        <TableHead className="text-right text-[10px] py-2 px-2 w-[100px]">
                          <div className="flex items-center justify-end gap-1">
                            <ArrowDownLeft className="h-3 w-3 text-emerald-600" />
                            Credit
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entryLines.map((line: any) => (
                        <TableRow key={line.id} className="text-xs">
                          <TableCell className="py-2 px-2">
                            <div>
                              <span className="text-[11px] font-medium">
                                {line.accounts?.account_code} - {line.accounts?.account_name}
                              </span>
                              {line.description && (
                                <p className="text-[10px] text-muted-foreground truncate">{line.description}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-2 px-2">
                            {line.debit_amount > 0 ? (
                              <span className="text-[11px] font-semibold text-blue-600">
                                {formatCurrency(line.debit_amount)}
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right py-2 px-2">
                            {line.credit_amount > 0 ? (
                              <span className="text-[11px] font-semibold text-emerald-600">
                                {formatCurrency(line.credit_amount)}
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground text-sm">No lines found</div>
              )}
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <ArrowUpRight className="h-4 w-4 text-blue-600" />
                  Total Debit
                </span>
                <span className="font-semibold text-blue-600">{formatCurrency(entry.total_debit)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                  Total Credit
                </span>
                <span className="font-semibold text-emerald-600">{formatCurrency(entry.total_credit)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between text-lg font-bold">
                <span>Balance</span>
                <span className={entry.total_debit === entry.total_credit ? 'text-emerald-600' : 'text-red-600'}>
                  {entry.total_debit === entry.total_credit ? 'Balanced ✓' : formatCurrency(Math.abs(entry.total_debit - entry.total_credit))}
                </span>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="p-4 border-t bg-muted/30">
          <Button onClick={onClose} className="w-full">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
