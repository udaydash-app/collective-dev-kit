import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Account {
  id: string;
  account_code: string;
  account_name: string;
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  current_balance: number;
  is_active: boolean;
}

interface MergeAccountsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  onSuccess: () => void;
}

export function MergeAccountsDialog({ open, onOpenChange, accounts, onSuccess }: MergeAccountsDialogProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [merging, setMerging] = useState(false);

  const handleMerge = async () => {
    if (!selectedAccountId) {
      toast.error("Please select which account to keep");
      return;
    }

    const keepAccount = accounts.find(a => a.id === selectedAccountId);
    const mergeAccounts = accounts.filter(a => a.id !== selectedAccountId);

    if (!keepAccount || mergeAccounts.length === 0) {
      toast.error("Invalid selection");
      return;
    }

    setMerging(true);

    try {
      console.log('=== Starting Account Merge ===');
      console.log('Keep account:', keepAccount.account_name, keepAccount.id, 'Balance:', keepAccount.current_balance);
      console.log('Merge accounts:', mergeAccounts.map(a => ({ name: a.account_name, id: a.id, balance: a.current_balance })));

      // Calculate total balance from all accounts
      const totalBalance = accounts.reduce((sum, acc) => sum + (acc.current_balance || 0), 0);
      console.log('Total balance:', totalBalance);

      // Transfer journal entry lines to kept account
      for (const account of mergeAccounts) {
        console.log(`Transferring journal entry lines from ${account.account_name} to ${keepAccount.account_name}`);
        
        const { error: journalLineError } = await supabase
          .from('journal_entry_lines')
          .update({ account_id: keepAccount.id })
          .eq('account_id', account.id);

        if (journalLineError) {
          console.error('Error transferring journal entry lines:', journalLineError);
          throw new Error('Failed to transfer journal entry lines');
        }
      }

      // Update parent account references
      for (const account of mergeAccounts) {
        const { error: parentError } = await supabase
          .from('accounts')
          .update({ parent_account_id: keepAccount.id })
          .eq('parent_account_id', account.id);

        if (parentError) {
          console.error('Error updating parent account references:', parentError);
        }
      }

      // Update contact customer ledger account references
      for (const account of mergeAccounts) {
        const { error: customerLedgerError } = await supabase
          .from('contacts')
          .update({ customer_ledger_account_id: keepAccount.id })
          .eq('customer_ledger_account_id', account.id);

        if (customerLedgerError) {
          console.error('Error updating customer ledger references:', customerLedgerError);
        }
      }

      // Update contact supplier ledger account references
      for (const account of mergeAccounts) {
        const { error: supplierLedgerError } = await supabase
          .from('contacts')
          .update({ supplier_ledger_account_id: keepAccount.id })
          .eq('supplier_ledger_account_id', account.id);

        if (supplierLedgerError) {
          console.error('Error updating supplier ledger references:', supplierLedgerError);
        }
      }

      // Update stock adjustment journal entry references
      for (const account of mergeAccounts) {
        const { error: stockAdjustmentError } = await supabase
          .from('stock_adjustments')
          .update({ journal_entry_id: keepAccount.id })
          .eq('journal_entry_id', account.id);

        if (stockAdjustmentError) {
          console.error('Error updating stock adjustment references:', stockAdjustmentError);
        }
      }

      // Update the kept account's balance
      console.log(`Updating ${keepAccount.account_name} balance to ${totalBalance}`);
      const { error: updateError } = await supabase
        .from('accounts')
        .update({ current_balance: totalBalance })
        .eq('id', keepAccount.id);

      if (updateError) {
        console.error('Error updating kept account balance:', updateError);
        throw new Error('Failed to update account balance');
      }

      // Delete merged accounts
      const accountIdsToDelete = mergeAccounts.map(a => a.id);
      console.log('Deleting accounts:', accountIdsToDelete);
      
      const { error: deleteError } = await supabase
        .from('accounts')
        .delete()
        .in('id', accountIdsToDelete);

      if (deleteError) {
        console.error('Error deleting merged accounts:', deleteError);
        throw new Error('Failed to delete merged accounts');
      }

      console.log('=== Merge Complete ===');
      toast.success(`Successfully merged ${mergeAccounts.length} account(s) into ${keepAccount.account_name}`);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Merge error:', error);
      toast.error(`Failed to merge accounts: ${error.message}`);
    } finally {
      setMerging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Merge Accounts</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">
              You are about to merge {accounts.length} accounts. This will:
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Transfer all journal entry lines to the selected account</li>
              <li>Update all parent account references</li>
              <li>Update all contact ledger references</li>
              <li>Combine the balances of all accounts</li>
              <li>Delete the unselected accounts</li>
            </ul>
            <p className="text-sm text-destructive font-medium mt-2">
              This action cannot be undone!
            </p>
          </div>

          <div>
            <Label className="text-base font-semibold mb-3 block">
              Select which account to keep:
            </Label>
            <RadioGroup value={selectedAccountId} onValueChange={setSelectedAccountId}>
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center space-x-3 border rounded-lg p-3 hover:bg-muted/50"
                >
                  <RadioGroupItem value={account.id} id={account.id} />
                  <Label
                    htmlFor={account.id}
                    className="flex-1 cursor-pointer space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{account.account_code}</span>
                        {" - "}
                        <span>{account.account_name}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Type: {account.account_type}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Balance: {formatCurrency(account.current_balance)}
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm font-medium">Total Combined Balance:</p>
            <p className="text-2xl font-bold">
              {formatCurrency(accounts.reduce((sum, a) => sum + (a.current_balance || 0), 0))}
            </p>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={merging}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleMerge}
              disabled={!selectedAccountId || merging}
            >
              {merging && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {merging ? "Merging..." : "Merge Accounts"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
