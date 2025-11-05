import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
import { BookOpen, Download, Check, ChevronsUpDown } from 'lucide-react';
import { usePageView } from '@/hooks/useAnalytics';
import { formatCurrency, cn } from '@/lib/utils';
import { ReturnToPOSButton } from '@/components/layout/ReturnToPOSButton';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export default function GeneralLedger() {
  usePageView('Admin - General Ledger');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: contacts } = useQuery({
    queryKey: ['contacts-for-ledger'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, is_customer, is_supplier, customer_ledger_account_id, supplier_ledger_account_id');
      if (error) throw error;
      return data;
    },
  });

  const { data: rawAccounts } = useQuery({
    queryKey: ['accounts-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select(`
          *,
          parent:parent_account_id(account_name, account_code)
        `)
        .eq('is_active', true)
        .order('account_code');
      if (error) throw error;
      return data;
    },
  });

  // Map accounts with contact names after both queries complete
  const accounts = rawAccounts && contacts ? (() => {
    // Organize accounts by parent-child relationship
    const parentAccounts = rawAccounts.filter(a => !a.parent_account_id) || [];
    const childAccounts = rawAccounts.filter(a => a.parent_account_id) || [];
    
    // Create a structured list with contact names
    const structuredAccounts: any[] = [];
    
    // Add unified accounts for contacts who are both customers and suppliers
    const dualRoleContacts = contacts.filter(c => c.is_customer && c.is_supplier && c.customer_ledger_account_id && c.supplier_ledger_account_id);
    
    // Create a Set of account IDs that belong to dual-role contacts for quick lookup
    const dualRoleAccountIds = new Set<string>();
    dualRoleContacts.forEach(contact => {
      if (contact.customer_ledger_account_id) dualRoleAccountIds.add(contact.customer_ledger_account_id);
      if (contact.supplier_ledger_account_id) dualRoleAccountIds.add(contact.supplier_ledger_account_id);
    });
    
    if (dualRoleContacts.length > 0) {
      structuredAccounts.push({
        id: 'unified-header',
        account_code: 'UNIFIED',
        account_name: '═══ Combined Customer/Supplier Accounts ═══',
        isParent: true,
        contactName: '',
        isHeader: true
      });
      
      dualRoleContacts.forEach(contact => {
        structuredAccounts.push({
          id: `unified-${contact.id}`,
          account_code: 'UNIFIED',
          account_name: `${contact.name} (Combined View)`,
          isChild: true,
          contactName: contact.name,
          isCustomer: true,
          isSupplier: true,
          isUnified: true,
          contactId: contact.id,
          customerAccountId: contact.customer_ledger_account_id,
          supplierAccountId: contact.supplier_ledger_account_id
        });
      });
    }
    
    // Track which child accounts have been added to prevent duplicates
    const addedChildIds = new Set<string>();
    
    parentAccounts.forEach(parent => {
      structuredAccounts.push({ ...parent, isParent: true, contactName: '' });
      const children = childAccounts.filter(c => c.parent_account_id === parent.id);
      children.forEach(child => {
        // Skip if this account belongs to a dual-role contact (already in unified section)
        if (dualRoleAccountIds.has(child.id)) {
          console.log('Skipping dual-role account:', child.account_name, child.id);
          return;
        }
        
        // Skip if this child account was already added under another parent
        if (addedChildIds.has(child.id)) {
          console.log('Skipping already added child:', child.account_name, child.id);
          return;
        }
        
        // Find associated contact based on account type
        let contact;
        
        // Check if this is under Accounts Receivable (customer ledger)
        if (parent.account_name?.toLowerCase().includes('receivable') || 
            parent.account_name?.toLowerCase().includes('debtors')) {
          contact = contacts.find(c => c.is_customer && c.customer_ledger_account_id === child.id);
        }
        // Check if this is under Accounts Payable (supplier ledger)
        else if (parent.account_name?.toLowerCase().includes('payable') || 
                 parent.account_name?.toLowerCase().includes('creditors')) {
          contact = contacts.find(c => c.is_supplier && c.supplier_ledger_account_id === child.id);
        }
        // Fallback to check both
        else {
          contact = contacts.find(
            c => c.customer_ledger_account_id === child.id || c.supplier_ledger_account_id === child.id
          );
        }
        
        if (contact?.name.toLowerCase().includes('sudha')) {
          console.log('Adding Sudha account:', {
            childId: child.id,
            accountName: child.account_name,
            contactName: contact.name,
            parentName: parent.account_name
          });
        }
        
        structuredAccounts.push({ 
          ...child, 
          isChild: true,
          contactName: contact?.name || '',
          isCustomer: contact?.is_customer || false,
          isSupplier: contact?.is_supplier || false
        });
        
        // Mark this child account as added
        addedChildIds.add(child.id);
      });
    });
    
    // Log final structured accounts for Sudha
    const sudhaAccounts = structuredAccounts.filter(a => a.contactName?.toLowerCase().includes('sudha'));
    console.log('Final Sudha accounts in structuredAccounts:', sudhaAccounts.length, sudhaAccounts);
    
    return structuredAccounts;
  })() : rawAccounts?.map(acc => ({ ...acc, isParent: !acc.parent_account_id, isChild: !!acc.parent_account_id, contactName: '' }));

  // Filter accounts based on search term
  const selectedAccountData = accounts?.find(acc => acc.id === selectedAccount);
  
  const filteredAccounts = (() => {
    if (!accounts) return [];
    
    const filtered = accounts.filter((account) => {
      // If no search term, show nothing
      if (!searchValue || searchValue.trim() === '') return false;
      
      const searchLower = searchValue.toLowerCase().trim();
      const accountName = (account.account_name || '').toLowerCase();
      const accountCode = (account.account_code || '').toLowerCase();
      const contactName = (account.contactName || '').toLowerCase();
      
      // Only match if the search term is actually found in a non-empty field
      const nameMatch = accountName.length > 0 && accountName.includes(searchLower);
      const codeMatch = accountCode.length > 0 && accountCode.includes(searchLower);
      const contactMatch = contactName.length > 0 && contactName.includes(searchLower);
      
      return nameMatch || codeMatch || contactMatch;
    });
    
    // Deduplicate by account ID - each unique account should appear only once
    const seenAccountIds = new Set<string>();
    const deduplicated = filtered.filter((account) => {
      // Always keep headers (they don't have real account IDs)
      if (account.isHeader) return true;
      
      // For unified accounts, use a special key
      const accountKey = account.isUnified ? account.id : account.id;
      
      if (seenAccountIds.has(accountKey)) {
        return false; // Skip duplicate
      }
      
      seenAccountIds.add(accountKey);
      return true;
    });
    
    return deduplicated;
  })();

  const { data: ledgerData, isLoading } = useQuery({
    queryKey: ['general-ledger', selectedAccount, startDate, endDate],
    queryFn: async () => {
      if (!selectedAccount) return null;

      const selectedAccountInfo = accounts?.find(a => a.id === selectedAccount);
      
      // Handle unified account view
      if (selectedAccountInfo?.isUnified) {
        const { customerAccountId, supplierAccountId } = selectedAccountInfo;
        
        // Fetch lines from both customer and supplier accounts
        const { data: customerLines, error: customerError } = await supabase
          .from('journal_entry_lines')
          .select(`
            *,
            journal_entries!inner (
              entry_number,
              entry_date,
              description,
              reference,
              status
            )
          `)
          .eq('account_id', customerAccountId)
          .eq('journal_entries.status', 'posted')
          .gte('journal_entries.entry_date', startDate)
          .lte('journal_entries.entry_date', endDate);

        const { data: supplierLines, error: supplierError } = await supabase
          .from('journal_entry_lines')
          .select(`
            *,
            journal_entries!inner (
              entry_number,
              entry_date,
              description,
              reference,
              status
            )
          `)
          .eq('account_id', supplierAccountId)
          .eq('journal_entries.status', 'posted')
          .gte('journal_entries.entry_date', startDate)
          .lte('journal_entries.entry_date', endDate);

        if (customerError || supplierError) throw customerError || supplierError;

        // Mark lines with their source type
        const markedCustomerLines = customerLines?.map(line => ({ ...line, sourceType: 'receivable' })) || [];
        const markedSupplierLines = supplierLines?.map(line => ({ ...line, sourceType: 'payable' })) || [];
        
        // Combine and sort all lines
        const allLines = [...markedCustomerLines, ...markedSupplierLines].sort((a, b) => 
          new Date(a.journal_entries.entry_date).getTime() - new Date(b.journal_entries.entry_date).getTime()
        );

        return { 
          lines: allLines, 
          account: { 
            account_name: selectedAccountInfo.account_name,
            account_type: 'unified',
            isUnified: true
          } 
        };
      }

      // Regular single account view
      const { data: lines, error } = await supabase
        .from('journal_entry_lines')
        .select(`
          *,
          journal_entries!inner (
            entry_number,
            entry_date,
            description,
            reference,
            status
          )
        `)
        .eq('account_id', selectedAccount)
        .eq('journal_entries.status', 'posted')
        .gte('journal_entries.entry_date', startDate)
        .lte('journal_entries.entry_date', endDate);

      if (error) throw error;

      // Sort by entry date
      const sortedLines = lines?.sort((a, b) => 
        new Date(a.journal_entries.entry_date).getTime() - new Date(b.journal_entries.entry_date).getTime()
      );

      // Get account details
      const { data: account } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', selectedAccount)
        .maybeSingle();

      return { lines: sortedLines, account };
    },
    enabled: !!selectedAccount,
  });

  const calculateRunningBalance = () => {
    if (!ledgerData?.lines || !ledgerData?.account) return [];

    let balance = 0;
    const accountType = ledgerData.account.account_type;
    
    return ledgerData.lines.map((line: any) => {
      // For unified accounts, calculate net position
      // Receivable (customer owes us) is positive, Payable (we owe them) is negative
      if (accountType === 'unified') {
        if (line.sourceType === 'receivable') {
          // Customer account: debit increases what they owe us
          balance += line.debit_amount - line.credit_amount;
        } else {
          // Supplier account: credit increases what we owe them (negative balance)
          balance -= (line.credit_amount - line.debit_amount);
        }
      }
      // Regular account logic
      else if (['asset', 'expense'].includes(accountType)) {
        balance += line.debit_amount - line.credit_amount;
      } else {
        balance += line.credit_amount - line.debit_amount;
      }

      return {
        ...line,
        running_balance: balance,
      };
    });
  };

  const ledgerEntries = calculateRunningBalance();

  const totalDebit = (ledgerData?.lines as any[])?.reduce(
    (sum: number, line: any) => sum + (line.debit_amount || 0),
    0
  ) || 0;

  const totalCredit = (ledgerData?.lines as any[])?.reduce(
    (sum: number, line: any) => sum + (line.credit_amount || 0),
    0
  ) || 0;

  const netChange = totalDebit - totalCredit;

  const handleExport = () => {
    if (!ledgerData?.account || !ledgerEntries.length) {
      return;
    }

    const accountInfo = ledgerData.account as any;
    const accountName = accountInfo.isUnified ? 'UNIFIED' : accountInfo.account_code;
    
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(16);
    doc.text('General Ledger Report', 14, 15);
    
    // Account info
    doc.setFontSize(9);
    doc.text(`Account: ${accountName} - ${accountInfo.account_name}`, 14, 23);
    doc.text(`Type: ${accountInfo.isUnified ? 'Combined Customer/Supplier' : accountInfo.account_type}`, 14, 28);
    doc.text(`Period: ${startDate} to ${endDate}`, 14, 33);
    
    // Prepare table data
    const tableData = ledgerEntries.map((entry: any) => [
      new Date(entry.journal_entries.entry_date).toLocaleDateString(),
      entry.journal_entries.entry_number,
      entry.journal_entries.description + (entry.description ? ' - ' + entry.description : ''),
      entry.journal_entries.reference || '',
      entry.debit_amount > 0 ? entry.debit_amount.toFixed(2) : '',
      entry.credit_amount > 0 ? entry.credit_amount.toFixed(2) : '',
      Math.abs(entry.running_balance).toFixed(2) + (entry.running_balance < 0 ? ' CR' : ''),
    ]);
    
    // Add table
    autoTable(doc, {
      startY: 38,
      head: [['Date', 'Entry', 'Description', 'Ref', 'Debit', 'Credit', 'Balance']],
      body: tableData,
      foot: [
        ['', '', '', 'Total:', totalDebit.toFixed(2), totalCredit.toFixed(2), ''],
        ['', '', '', 'Balance:', '', '', 
         Math.abs(netChange).toFixed(2) + (netChange < 0 ? ' CR' : '')]
      ],
      styles: { 
        fontSize: 7,
        cellPadding: 2,
        overflow: 'linebreak',
        cellWidth: 'wrap'
      },
      headStyles: { 
        fillColor: [34, 197, 94],
        fontSize: 8,
        fontStyle: 'bold'
      },
      footStyles: { 
        fillColor: [240, 240, 240], 
        textColor: [0, 0, 0], 
        fontStyle: 'bold',
        fontSize: 8
      },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 20 },
        2: { cellWidth: 60 },
        3: { cellWidth: 20 },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 22, halign: 'right' },
        6: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 },
    });
    
    // Save PDF
    doc.save(`general-ledger-${accountName}-${startDate}-${endDate}.pdf`);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BookOpen className="h-8 w-8" />
            General Ledger
          </h1>
          <p className="text-muted-foreground">
            View detailed transaction history by account
          </p>
        </div>
        <div className="flex gap-2">
          <ReturnToPOSButton inline />
          <Button 
            variant="outline" 
            onClick={handleExport}
            disabled={!selectedAccount || !ledgerEntries.length}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <Label htmlFor="search">Search Account or Contact</Label>
            <Input
              id="search"
              placeholder="Search by account code, name, or contact..."
              value={searchValue}
              onChange={(e) => {
                setSearchValue(e.target.value);
                if (e.target.value.trim() === '') {
                  setSelectedAccount('');
                }
              }}
            />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="account">Account *</Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="account"
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between"
                >
                  {selectedAccount
                    ? (() => {
                        const account = selectedAccountData;
                        return account ? (
                          <span className="truncate">
                            {account.isChild && '└─ '}
                            {account.account_code} - {account.account_name}
                            {account.contactName && ` (${account.contactName})`}
                            {account.isCustomer && ' 👤'}
                            {account.isSupplier && ' 🏢'}
                          </span>
                        ) : 'Select account...';
                      })()
                    : 'Select account...'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0">
                <Command shouldFilter={false}>
                  {filteredAccounts.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                      {searchValue ? 'No accounts found matching your search' : 'No accounts available'}
                    </div>
                  ) : (
                    <CommandGroup className="max-h-[300px] overflow-auto">
                      {filteredAccounts.map((account) => (
                        <CommandItem
                          key={account.id}
                          value={account.id}
                          onSelect={(value) => {
                            setSelectedAccount(value);
                            setOpen(false);
                          }}
                          className={cn(account.isChild && 'pl-8')}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              selectedAccount === account.id ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          {account.isChild && '└─ '}
                          {account.account_code} - {account.account_name}
                          {account.contactName && ` (${account.contactName})`}
                          {account.isCustomer && ' 👤'}
                          {account.isSupplier && ' 🏢'}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">

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
      </Card>

      {/* Account Summary */}
      {ledgerData?.account && (
        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Account</p>
              <p className="text-lg font-bold">
                {(ledgerData.account as any).isUnified ? 'UNIFIED' : (ledgerData.account as any).account_code} - {ledgerData.account.account_name}
              </p>
              <Badge className="mt-1">
                {(ledgerData.account as any).isUnified ? 'Combined Customer/Supplier' : ledgerData.account.account_type}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Debits</p>
              <p className="text-lg font-bold font-mono">
                {formatCurrency(Number(totalDebit))}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Credits</p>
              <p className="text-lg font-bold font-mono">
                {formatCurrency(Number(totalCredit))}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Balance</p>
              <p
                className={`text-lg font-bold font-mono ${
                  netChange >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {formatCurrency(Math.abs(netChange))}
                {netChange < 0 && ' CR'}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Ledger Entries */}
      {selectedAccount ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Entry #</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : ledgerEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    No transactions found for this period
                  </TableCell>
                </TableRow>
              ) : (
                ledgerEntries.map((entry: any) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      {new Date(entry.journal_entries.entry_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-mono">
                      {entry.journal_entries.entry_number}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p>{entry.journal_entries.description}</p>
                        {entry.description && (
                          <p className="text-sm text-muted-foreground">
                            {entry.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{entry.journal_entries.reference || '-'}</TableCell>
                    <TableCell className="text-right font-mono">
                      {entry.debit_amount > 0
                        ? formatCurrency(entry.debit_amount)
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {entry.credit_amount > 0
                        ? formatCurrency(entry.credit_amount)
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      {formatCurrency(Math.abs(entry.running_balance))}
                      {entry.running_balance < 0 && ' CR'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold mb-2">Select an Account</h3>
          <p className="text-muted-foreground">
            Choose an account from the dropdown above to view its ledger
          </p>
        </Card>
      )}
    </div>
  );
}
