import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Plus, Search, Pencil, Trash2, BookOpen, Merge, Filter, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { MergeAccountsDialog } from '@/components/admin/MergeAccountsDialog';
import { usePageView } from '@/hooks/useAnalytics';
import { formatCurrency } from '@/lib/utils';
import { ReturnToPOSButton } from '@/components/layout/ReturnToPOSButton';

interface Account {
  id: string;
  account_code: string;
  account_name: string;
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  parent_account_id?: string;
  description?: string;
  is_active: boolean;
  current_balance: number;
  created_at: string;
}

// SYSCOHADA account translations (French to English)
const accountTranslations: Record<string, string> = {
  // Class 1 - Equity
  'Capital': 'Capital',
  'Capital social': 'Share Capital',
  'Réserves': 'Reserves',
  'Report à nouveau': 'Retained Earnings',
  'Résultat de l\'exercice': 'Net Income',
  'Compte de l\'exploitant': 'Owner\'s Account',
  
  // Class 2 - Fixed Assets
  'Immobilisations incorporelles': 'Intangible Assets',
  'Immobilisations corporelles': 'Tangible Assets',
  'Immobilisations financières': 'Financial Assets',
  'Terrains': 'Land',
  'Bâtiments': 'Buildings',
  'Matériel et outillage': 'Equipment & Tools',
  'Matériel de transport': 'Vehicles',
  'Matériel de bureau': 'Office Equipment',
  'Amortissements': 'Depreciation',
  
  // Class 3 - Inventory
  'Stocks et en-cours': 'Inventory',
  'Stocks de marchandises': 'Merchandise Inventory',
  'Marchandises': 'Merchandise',
  'Matières premières': 'Raw Materials',
  'Produits finis': 'Finished Goods',
  
  // Class 4 - Third Party Accounts
  'Fournisseurs': 'Suppliers/Vendors',
  'Fournisseurs d\'exploitation': 'Trade Payables',
  'Clients': 'Customers',
  'Clients et comptes rattachés': 'Accounts Receivable',
  'Personnel': 'Employees',
  'État': 'Government/Tax',
  'TVA collectée': 'VAT Collected',
  'TVA déductible': 'VAT Deductible',
  'TVA à payer': 'VAT Payable',
  'Impôts et taxes': 'Taxes',
  'Droit de Timbre': 'Stamp Duty',
  'Charges à payer': 'Accrued Expenses',
  'Produits à recevoir': 'Accrued Income',
  
  // Class 5 - Treasury
  'Trésorerie': 'Cash & Bank',
  'Caisse': 'Cash',
  'Banque': 'Bank',
  'Banque Mobile Money': 'Mobile Money',
  'Chèques à encaisser': 'Checks to Deposit',
  
  // Class 6 - Expenses
  'Charges d\'exploitation': 'Operating Expenses',
  'Achats de marchandises': 'Purchases',
  'Achats': 'Purchases',
  'Coût des ventes': 'Cost of Goods Sold',
  'Variation de stocks': 'Inventory Variation',
  'Services extérieurs': 'External Services',
  'Charges de personnel': 'Payroll Expenses',
  'Salaires et traitements': 'Salaries & Wages',
  'Charges sociales': 'Social Charges',
  'Dotations aux amortissements': 'Depreciation Expense',
  'Charges financières': 'Financial Charges',
  'Intérêts': 'Interest Expense',
  'Loyer': 'Rent',
  'Électricité': 'Electricity',
  'Transport': 'Transportation',
  'Frais généraux': 'General Expenses',
  'Remises accordées': 'Discounts Given',
  
  // Class 7 - Revenue
  'Produits d\'exploitation': 'Operating Revenue',
  'Ventes de marchandises': 'Sales Revenue',
  'Ventes': 'Sales',
  'Produits financiers': 'Financial Income',
  'Produits exceptionnels': 'Exceptional Income',
  'Remises obtenues': 'Discounts Received',
};

// Get English translation for an account name
const getEnglishName = (frenchName: string): string | null => {
  // Direct match
  if (accountTranslations[frenchName]) {
    return accountTranslations[frenchName];
  }
  
  // Partial match - check if name starts with a known translation
  for (const [french, english] of Object.entries(accountTranslations)) {
    if (frenchName.toLowerCase().startsWith(french.toLowerCase())) {
      return english;
    }
    if (frenchName.toLowerCase().includes(french.toLowerCase())) {
      return english;
    }
  }
  
  return null;
};

export default function ChartOfAccounts() {
  usePageView('Admin - Chart of Accounts');
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);

  const [formData, setFormData] = useState<{
    account_code: string;
    account_name: string;
    account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
    parent_account_id: string;
    description: string;
    is_active: boolean;
    opening_balance: string;
  }>({
    account_code: '',
    account_name: '',
    account_type: 'asset',
    parent_account_id: '',
    description: '',
    is_active: true,
    opening_balance: '',
  });

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('account_code');
      if (error) throw error;
      return data as Account[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from('accounts').insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Account created successfully');
      handleClose();
    },
    onError: (error) => {
      toast.error('Failed to create account: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase
        .from('accounts')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Account updated successfully');
      handleClose();
    },
    onError: (error) => {
      toast.error('Failed to update account: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Account deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete account: ' + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.account_code.trim() || !formData.account_name.trim()) {
      toast.error('Account code and name are required');
      return;
    }

    const submitData = {
      ...formData,
      parent_account_id: formData.parent_account_id || null,
      opening_balance: formData.opening_balance ? parseFloat(formData.opening_balance) : 0,
    };

    if (editingAccount) {
      updateMutation.mutate({ id: editingAccount.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      account_code: account.account_code,
      account_name: account.account_name,
      account_type: account.account_type,
      parent_account_id: account.parent_account_id || '',
      description: account.description || '',
      is_active: account.is_active,
      opening_balance: (account as any).opening_balance?.toString() || '0',
    });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingAccount(null);
    setFormData({
      account_code: '',
      account_name: '',
      account_type: 'asset',
      parent_account_id: '',
      description: '',
      is_active: true,
      opening_balance: '',
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete ${name}?`)) {
      deleteMutation.mutate(id);
    }
  };

  const findDuplicates = () => {
    if (!accounts) return [];
    const duplicates = new Set<string>();
    const nameMap = new Map<string, string[]>();

    accounts.forEach(account => {
      const normalizedName = account.account_name.toLowerCase().trim();
      if (!nameMap.has(normalizedName)) {
        nameMap.set(normalizedName, []);
      }
      nameMap.get(normalizedName)!.push(account.id);
    });

    nameMap.forEach((ids) => {
      if (ids.length > 1) {
        ids.forEach(id => duplicates.add(id));
      }
    });

    return Array.from(duplicates);
  };

  const duplicateAccountIds = findDuplicates();

  const filteredAccounts = accounts?.filter((account) => {
    const matchesSearch = account.account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.account_code.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (showDuplicatesOnly) {
      return matchesSearch && duplicateAccountIds.includes(account.id);
    }
    
    return matchesSearch;
  }).sort((a, b) => {
    // If showing duplicates or duplicates exist, group them together
    if (showDuplicatesOnly || duplicateAccountIds.length > 0) {
      const aIsDuplicate = duplicateAccountIds.includes(a.id);
      const bIsDuplicate = duplicateAccountIds.includes(b.id);
      
      // Sort duplicates first
      if (aIsDuplicate && !bIsDuplicate) return -1;
      if (!aIsDuplicate && bIsDuplicate) return 1;
      
      // Within duplicates, group by normalized name
      if (aIsDuplicate && bIsDuplicate) {
        const aName = a.account_name.toLowerCase().trim();
        const bName = b.account_name.toLowerCase().trim();
        if (aName !== bName) return aName.localeCompare(bName);
      }
    }
    
    // Default sort by account code
    return a.account_code.localeCompare(b.account_code);
  });

  const getParentAccountName = (parentId?: string) => {
    if (!parentId) return '-';
    const parent = accounts?.find(a => a.id === parentId);
    return parent ? `${parent.account_code} - ${parent.account_name}` : '-';
  };

  const accountTypeColors = {
    asset: 'bg-blue-500',
    liability: 'bg-red-500',
    equity: 'bg-purple-500',
    revenue: 'bg-green-500',
    expense: 'bg-orange-500',
  };

  const handleToggleAccount = (accountId: string) => {
    setSelectedAccounts(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const handleOpenMergeDialog = () => {
    if (selectedAccounts.length < 2) {
      toast.error("Please select at least 2 accounts to merge");
      return;
    }
    setMergeDialogOpen(true);
  };

  const handleMergeSuccess = () => {
    setSelectedAccounts([]);
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
  };

  const handleExport = () => {
    if (!accounts || accounts.length === 0) {
      toast.error('No accounts to export');
      return;
    }

    const exportData = accounts.map(account => ({
      'Account Code': account.account_code,
      'Account Name': account.account_name,
      'Account Type': account.account_type.charAt(0).toUpperCase() + account.account_type.slice(1),
      'Parent Account': getParentAccountName(account.parent_account_id),
      'Description': account.description || '',
      'Current Balance': account.current_balance,
      'Status': account.is_active ? 'Active' : 'Inactive',
      'Created At': new Date(account.created_at).toLocaleDateString(),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Chart of Accounts');
    
    // Set column widths
    ws['!cols'] = [
      { wch: 15 }, // Account Code
      { wch: 30 }, // Account Name
      { wch: 12 }, // Type
      { wch: 30 }, // Parent Account
      { wch: 40 }, // Description
      { wch: 15 }, // Balance
      { wch: 10 }, // Status
      { wch: 12 }, // Created At
    ];

    XLSX.writeFile(wb, `chart_of_accounts_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Chart of Accounts exported successfully');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Chart of Accounts</h1>
          <p className="text-muted-foreground">Manage your accounting structure</p>
        </div>
        <div className="flex gap-2">
          <ReturnToPOSButton inline />
          <Button onClick={handleExport} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button 
            onClick={() => {
              setShowDuplicatesOnly(!showDuplicatesOnly);
              if (!showDuplicatesOnly && duplicateAccountIds.length === 0) {
                toast.info("No duplicate accounts found");
              }
            }}
            variant={showDuplicatesOnly ? "default" : "outline"}
          >
            <Filter className="h-4 w-4 mr-2" />
            {showDuplicatesOnly ? `Duplicates (${duplicateAccountIds.length})` : 'Find Duplicates'}
          </Button>
          {selectedAccounts.length >= 2 && (
            <Button onClick={handleOpenMergeDialog} variant="secondary">
              <Merge className="h-4 w-4 mr-2" />
              Merge ({selectedAccounts.length})
            </Button>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleClose}>
                <Plus className="h-4 w-4 mr-2" />
                Add Account
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>
                {editingAccount ? 'Edit Account' : 'Add New Account'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="account_code">Account Code *</Label>
                  <Input
                    id="account_code"
                    value={formData.account_code}
                    onChange={(e) =>
                      setFormData({ ...formData, account_code: e.target.value })
                    }
                    placeholder="e.g., 1110"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="account_type">Account Type *</Label>
                  <Select
                    value={formData.account_type}
                    onValueChange={(value: any) =>
                      setFormData({ ...formData, account_type: value })
                    }
                  >
                    <SelectTrigger id="account_type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asset">Asset</SelectItem>
                      <SelectItem value="liability">Liability</SelectItem>
                      <SelectItem value="equity">Equity</SelectItem>
                      <SelectItem value="revenue">Revenue</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label htmlFor="account_name">Account Name *</Label>
                  <Input
                    id="account_name"
                    value={formData.account_name}
                    onChange={(e) =>
                      setFormData({ ...formData, account_name: e.target.value })
                    }
                    placeholder="e.g., Cash in Bank"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="parent_account">
                    Parent Account (Optional)
                    <span className="text-muted-foreground text-xs ml-2">
                      - Change hierarchy by selecting a different parent
                    </span>
                  </Label>
                  <Select
                    value={formData.parent_account_id || 'none'}
                    onValueChange={(value) =>
                      setFormData({ ...formData, parent_account_id: value === 'none' ? '' : value })
                    }
                  >
                    <SelectTrigger id="parent_account">
                      <SelectValue placeholder="None (Top Level Account)" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value="none">None (Top Level Account)</SelectItem>
                      {accounts
                        ?.filter(a => a.id !== editingAccount?.id)
                        .sort((a, b) => a.account_code.localeCompare(b.account_code))
                        .map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs">{account.account_code}</span>
                              <span>-</span>
                              <span>{account.account_name}</span>
                              <Badge 
                                variant="outline" 
                                className="ml-auto text-xs"
                              >
                                {account.account_type}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {editingAccount && formData.parent_account_id && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Currently moving to: {getParentAccountName(formData.parent_account_id)}
                    </p>
                  )}
                </div>

                <div className="col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="opening_balance">Opening Balance</Label>
                  <Input
                    id="opening_balance"
                    type="number"
                    step="0.01"
                    value={formData.opening_balance}
                    onChange={(e) =>
                      setFormData({ ...formData, opening_balance: e.target.value })
                    }
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Starting balance for this account
                  </p>
                </div>

                <div className="col-span-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, is_active: !!checked })
                      }
                    />
                    <label htmlFor="is_active" className="text-sm cursor-pointer">
                      Active Account
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingAccount ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by code or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      {/* Accounts Table */}
      <Card>
        <Table fixedScroll>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Account Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Parent Account</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredAccounts?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  No accounts found
                </TableCell>
              </TableRow>
            ) : (
              filteredAccounts?.map((account) => (
                <TableRow 
                  key={account.id}
                  className={duplicateAccountIds.includes(account.id) ? 'bg-yellow-50 dark:bg-yellow-950/20' : ''}
                >
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedAccounts.includes(account.id)}
                      onChange={() => handleToggleAccount(account.id)}
                      className="h-4 w-4 rounded border-border"
                    />
                  </TableCell>
                  <TableCell className="font-mono">{account.account_code}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{account.account_name}</p>
                      {getEnglishName(account.account_name) && getEnglishName(account.account_name) !== account.account_name && (
                        <p className="text-xs text-primary/70 font-medium">
                          {getEnglishName(account.account_name)}
                        </p>
                      )}
                      {account.description && (
                        <p className="text-sm text-muted-foreground">
                          {account.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={accountTypeColors[account.account_type]}>
                      {account.account_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {getParentAccountName(account.parent_account_id)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(account.current_balance)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={account.is_active ? 'default' : 'secondary'}>
                      {account.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(account)}
                        title="Edit account"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(account.id, account.account_name)}
                        disabled={account.current_balance !== 0}
                        title={account.current_balance !== 0 ? "Cannot delete account with balance" : "Delete account"}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <MergeAccountsDialog
        open={mergeDialogOpen}
        onOpenChange={setMergeDialogOpen}
        accounts={accounts?.filter(a => selectedAccounts.includes(a.id)) || []}
        onSuccess={handleMergeSuccess}
      />
    </div>
  );
}
