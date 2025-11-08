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
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Check, Eye, Edit, AlertTriangle, ChevronsUpDown } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';
import { usePageView } from '@/hooks/useAnalytics';
import { formatCurrency, cn } from '@/lib/utils';
import { ReturnToPOSButton } from '@/components/layout/ReturnToPOSButton';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';

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
  useRealtimeSync();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<any>(null);

  const [formData, setFormData] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    reference: '',
    description: '',
    notes: '',
  });

  const [lines, setLines] = useState<JournalLine[]>([]);
  const [openAccountPopovers, setOpenAccountPopovers] = useState<{ [key: number]: boolean }>({});

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
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchOnMount: 'always',
    staleTime: 0,
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

      if (editingEntry) {
        // Update existing entry
        const { error: entryError } = await supabase
          .from('journal_entries')
          .update({
            entry_date: formData.entry_date,
            reference: formData.reference,
            description: formData.description,
            notes: formData.notes,
            total_debit: totalDebit,
            total_credit: totalCredit,
          })
          .eq('id', editingEntry.id);

        if (entryError) throw entryError;

        // Delete existing lines
        const { error: deleteLinesError } = await supabase
          .from('journal_entry_lines')
          .delete()
          .eq('journal_entry_id', editingEntry.id);

        if (deleteLinesError) throw deleteLinesError;

        // Insert new lines
        const { error: linesError } = await supabase
          .from('journal_entry_lines')
          .insert(
            lines.map((line) => ({
              journal_entry_id: editingEntry.id,
              account_id: line.account_id,
              description: line.description,
              debit_amount: line.debit_amount,
              credit_amount: line.credit_amount,
            }))
          );

        if (linesError) throw linesError;

        return editingEntry;
      } else {
        // Create new journal entry
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
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      toast.success(editingEntry ? 'Journal entry updated successfully' : 'Journal entry created successfully');
      handleClose();
    },
    onError: (error) => {
      toast.error(`Failed to ${editingEntry ? 'update' : 'create'} journal entry: ` + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('journal_entries')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Journal entry deleted successfully');
      setDeleteDialogOpen(false);
      setEntryToDelete(null);
    },
    onError: (error) => {
      toast.error('Failed to delete journal entry: ' + error.message);
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
    setEditingEntry(null);
    setFormData({
      entry_date: new Date().toISOString().split('T')[0],
      reference: '',
      description: '',
      notes: '',
    });
    setLines([]);
  };

  const handleEdit = (entry: any) => {
    setEditingEntry(entry);
    setFormData({
      entry_date: entry.entry_date.split('T')[0],
      reference: entry.reference || '',
      description: entry.description,
      notes: entry.notes || '',
    });
    
    // Map the entry lines to the form structure
    const mappedLines = entry.journal_entry_lines?.map((line: any) => ({
      account_id: line.account_id,
      description: line.description,
      debit_amount: line.debit_amount,
      credit_amount: line.credit_amount,
      account_code: line.accounts?.account_code,
      account_name: line.accounts?.account_name,
    })) || [];
    
    setLines(mappedLines);
    setOpen(true);
  };

  const handleDelete = (entry: any) => {
    setEntryToDelete(entry);
    setDeleteDialogOpen(true);
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
        <div className="flex gap-2">
          <ReturnToPOSButton inline />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleClose}>
                <Plus className="h-4 w-4 mr-2" />
                New Entry
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingEntry ? 'Edit Journal Entry' : 'Create Journal Entry'}</DialogTitle>
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
                        <Popover 
                          open={openAccountPopovers[index]} 
                          onOpenChange={(open) => 
                            setOpenAccountPopovers(prev => ({ ...prev, [index]: open }))
                          }
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={openAccountPopovers[index]}
                              className="h-8 w-full justify-between text-xs"
                            >
                              {line.account_id
                                ? accounts?.find((account) => account.id === line.account_id)
                                  ? `${accounts.find((account) => account.id === line.account_id)?.account_code} - ${accounts.find((account) => account.id === line.account_id)?.account_name}`
                                  : "Select account"
                                : "Select account"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search account by name or code..." />
                              <CommandList>
                                <CommandEmpty>No account found.</CommandEmpty>
                                <CommandGroup>
                                  {accounts?.map((account) => (
                                    <CommandItem
                                      key={account.id}
                                      value={`${account.account_code} ${account.account_name}`}
                                      onSelect={() => {
                                        updateLine(index, 'account_id', account.id);
                                        setOpenAccountPopovers(prev => ({ ...prev, [index]: false }));
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          line.account_id === account.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {account.account_code} - {account.account_name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
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
                  {createMutation.isPending 
                    ? (editingEntry ? 'Updating...' : 'Creating...') 
                    : (editingEntry ? 'Update Entry' : 'Save as Draft')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>
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
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(entry)}
                        title="Edit entry"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(entry)}
                        title="Delete entry"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                      {entry.status === 'draft' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => postMutation.mutate(entry.id)}
                          title="Post entry"
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Journal Entry
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this journal entry?
              {entryToDelete && (
                <div className="mt-2 p-2 bg-muted rounded text-sm">
                  <p><strong>Entry #:</strong> {entryToDelete.entry_number}</p>
                  <p><strong>Description:</strong> {entryToDelete.description}</p>
                  <p><strong>Amount:</strong> {formatCurrency(entryToDelete.total_debit)}</p>
                </div>
              )}
              <p className="mt-2 text-destructive font-semibold">
                This action cannot be undone and will affect your account balances.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setEntryToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => entryToDelete && deleteMutation.mutate(entryToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Entry'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
