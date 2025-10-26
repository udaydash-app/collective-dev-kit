import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Check, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { usePageView } from '@/hooks/useAnalytics';
import { formatCurrency } from '@/lib/utils';

interface JournalLine {
  account_id: string;
  description: string;
  debit_amount: number;
  credit_amount: number;
  account_code?: string;
  account_name?: string;
}

export default function JournalEntries() {
  usePageView('Admin - Journal Entries');
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);

  const [formData, setFormData] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    reference: '',
    description: '',
    notes: '',
  });

  const [lines, setLines] = useState<JournalLine[]>([]);

  const { data: accounts } = useQuery({
    queryKey: ['accounts-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true)
        .order('account_code');
      if (error) throw error;
      return data;
    },
  });

  const { data: journalEntries, isLoading } = useQuery({
    queryKey: ['journal-entries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('journal_entries')
        .select(`
          *,
          journal_entry_lines (
            *,
            accounts (account_code, account_name)
          )
        `)
        .order('entry_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const totalDebit = lines.reduce((sum, line) => sum + line.debit_amount, 0);
      const totalCredit = lines.reduce((sum, line) => sum + line.credit_amount, 0);

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error('Journal entry must balance (total debits = total credits)');
      }

      // Create journal entry
      const { data: entry, error: entryError } = await supabase
        .from('journal_entries')
        .insert({
          entry_date: formData.entry_date,
          reference: formData.reference,
          description: formData.description,
          notes: formData.notes,
          total_debit: totalDebit,
          total_credit: totalCredit,
          status: 'draft',
          created_by: user.id,
        })
        .select()
        .single();

      if (entryError) throw entryError;

      // Create journal entry lines
      const { error: linesError } = await supabase
        .from('journal_entry_lines')
        .insert(
          lines.map((line) => ({
            journal_entry_id: entry.id,
            account_id: line.account_id,
            description: line.description,
            debit_amount: line.debit_amount,
            credit_amount: line.credit_amount,
          }))
        );

      if (linesError) throw linesError;

      return entry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      toast.success('Journal entry created successfully');
      handleClose();
    },
    onError: (error) => {
      toast.error('Failed to create journal entry: ' + error.message);
    },
  });

  const postMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('journal_entries')
        .update({
          status: 'posted',
          posted_at: new Date().toISOString(),
          posted_by: user.id,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Journal entry posted successfully');
    },
    onError: (error) => {
      toast.error('Failed to post journal entry: ' + error.message);
    },
  });

  const handleClose = () => {
    setOpen(false);
    setFormData({
      entry_date: new Date().toISOString().split('T')[0],
      reference: '',
      description: '',
      notes: '',
    });
    setLines([]);
  };

  const addLine = () => {
    setLines([
      ...lines,
      {
        account_id: '',
        description: '',
        debit_amount: 0,
        credit_amount: 0,
      },
    ]);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof JournalLine, value: any) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    setLines(updated);
  };

  const totalDebit = lines.reduce((sum, line) => sum + line.debit_amount, 0);
  const totalCredit = lines.reduce((sum, line) => sum + line.credit_amount, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Journal Entries</h1>
          <p className="text-muted-foreground">Record manual accounting transactions</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleClose}>
              <Plus className="h-4 w-4 mr-2" />
              New Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Journal Entry</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="entry_date">Date *</Label>
                  <Input
                    id="entry_date"
                    type="date"
                    value={formData.entry_date}
                    onChange={(e) =>
                      setFormData({ ...formData, entry_date: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="reference">Reference</Label>
                  <Input
                    id="reference"
                    value={formData.reference}
                    onChange={(e) =>
                      setFormData({ ...formData, reference: e.target.value })
                    }
                    placeholder="e.g., INV-001"
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="description">Description *</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Entry description"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    rows={2}
                  />
                </div>
              </div>

              {/* Journal Lines */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Journal Lines</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addLine}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Line
                  </Button>
                </div>

                {lines.map((line, index) => (
                  <Card key={index} className="p-3">
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-4">
                        <Label className="text-xs">Account</Label>
                        <Select
                          value={line.account_id}
                          onValueChange={(value) =>
                            updateLine(index, 'account_id', value)
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts?.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.account_code} - {account.account_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="col-span-3">
                        <Label className="text-xs">Description</Label>
                        <Input
                          className="h-8"
                          value={line.description}
                          onChange={(e) =>
                            updateLine(index, 'description', e.target.value)
                          }
                          placeholder="Line memo"
                        />
                      </div>

                      <div className="col-span-2">
                        <Label className="text-xs">Debit</Label>
                        <Input
                          className="h-8"
                          type="number"
                          step="0.01"
                          value={line.debit_amount || ''}
                          onChange={(e) =>
                            updateLine(
                              index,
                              'debit_amount',
                              parseFloat(e.target.value) || 0
                            )
                          }
                        />
                      </div>

                      <div className="col-span-2">
                        <Label className="text-xs">Credit</Label>
                        <Input
                          className="h-8"
                          type="number"
                          step="0.01"
                          value={line.credit_amount || ''}
                          onChange={(e) =>
                            updateLine(
                              index,
                              'credit_amount',
                              parseFloat(e.target.value) || 0
                            )
                          }
                        />
                      </div>

                      <div className="col-span-1 flex items-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removeLine(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total Debits:</span>
                  <span className="font-mono">{formatCurrency(totalDebit)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total Credits:</span>
                  <span className="font-mono">{formatCurrency(totalCredit)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Difference:</span>
                  <span
                    className={`font-mono ${
                      isBalanced ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {formatCurrency(Math.abs(totalDebit - totalCredit))}
                  </span>
                </div>
                {!isBalanced && (
                  <p className="text-sm text-destructive">
                    Entry must balance before saving
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={
                    !formData.description ||
                    lines.length === 0 ||
                    !isBalanced ||
                    createMutation.isPending
                  }
                  className="flex-1"
                >
                  {createMutation.isPending ? 'Creating...' : 'Save as Draft'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Entries List */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entry #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : journalEntries?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  No journal entries found
                </TableCell>
              </TableRow>
            ) : (
              journalEntries?.map((entry: any) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-mono">{entry.entry_number}</TableCell>
                  <TableCell>{new Date(entry.entry_date).toLocaleDateString()}</TableCell>
                  <TableCell>{entry.description}</TableCell>
                  <TableCell>{entry.reference || '-'}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(entry.total_debit)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={entry.status === 'posted' ? 'default' : 'secondary'}
                    >
                      {entry.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedEntry(entry);
                          setViewDialogOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {entry.status === 'draft' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => postMutation.mutate(entry.id)}
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* View Entry Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Journal Entry Details</DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Entry Number</p>
                  <p className="font-mono">{selectedEntry.entry_number}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p>{new Date(selectedEntry.entry_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Reference</p>
                  <p>{selectedEntry.reference || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge
                    variant={
                      selectedEntry.status === 'posted' ? 'default' : 'secondary'
                    }
                  >
                    {selectedEntry.status}
                  </Badge>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Description</p>
                  <p>{selectedEntry.description}</p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedEntry.journal_entry_lines?.map((line: any) => (
                    <TableRow key={line.id}>
                      <TableCell>
                        {line.accounts.account_code} - {line.accounts.account_name}
                      </TableCell>
                      <TableCell>{line.description}</TableCell>
                      <TableCell className="text-right font-mono">
                        {line.debit_amount > 0
                          ? formatCurrency(line.debit_amount)
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {line.credit_amount > 0
                          ? formatCurrency(line.credit_amount)
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold">
                    <TableCell colSpan={2}>Total</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(selectedEntry.total_debit)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(selectedEntry.total_credit)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
