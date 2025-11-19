import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { Plus, Trash2, Package, Search, Eye, Edit, X } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ReturnToPOSButton } from '@/components/layout/ReturnToPOSButton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PurchasePaymentDialog } from '@/components/admin/PurchasePaymentDialog';

interface PurchaseItem {
  product_id: string;
  variant_id?: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  product_name?: string;
  variant_label?: string;
}

// State preservation helpers for navigating to add new product
const PURCHASE_FORM_STATE_KEY = 'purchaseFormState';
const STATE_EXPIRY_HOURS = 1;

interface SavedPurchaseFormState {
  items: PurchaseItem[];
  selectedSupplier: string;
  selectedStore: string;
  paymentStatus: string;
  paymentMethod: string;
  notes: string;
  timestamp: number;
}

const savePurchaseFormState = (state: Omit<SavedPurchaseFormState, 'timestamp'>) => {
  const stateWithTimestamp: SavedPurchaseFormState = {
    ...state,
    timestamp: Date.now(),
  };
  sessionStorage.setItem(PURCHASE_FORM_STATE_KEY, JSON.stringify(stateWithTimestamp));
};

const restorePurchaseFormState = (): SavedPurchaseFormState | null => {
  const saved = sessionStorage.getItem(PURCHASE_FORM_STATE_KEY);
  if (!saved) return null;
  
  try {
    const state: SavedPurchaseFormState = JSON.parse(saved);
    // Check if state is expired (older than 1 hour)
    const isExpired = Date.now() - state.timestamp > STATE_EXPIRY_HOURS * 60 * 60 * 1000;
    if (isExpired) {
      clearPurchaseFormState();
      return null;
    }
    return state;
  } catch (error) {
    console.error('Error restoring purchase form state:', error);
    return null;
  }
};

const clearPurchaseFormState = () => {
  sessionStorage.removeItem(PURCHASE_FORM_STATE_KEY);
};

export default function Purchases() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showNewPurchase, setShowNewPurchase] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedStore, setSelectedStore] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [pendingPaymentPurchase, setPendingPaymentPurchase] = useState<any>(null);
  
  const lastItemRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Auto-focus on newly added product
  useEffect(() => {
    if (items.length > 0 && lastItemRef.current) {
      lastItemRef.current.focus();
      lastItemRef.current.select();
    }
  }, [items.length]);

  const { data: stores } = useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const { data } = await supabase
        .from('stores')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data } = await supabase
        .from('contacts')
        .select('id, name, phone, email')
        .eq('is_supplier', true)
        .order('name');
      return data || [];
    },
  });

  const { data: purchases } = useQuery({
    queryKey: ['purchases'],
    queryFn: async () => {
      const { data } = await supabase
        .from('purchases')
        .select(`
          *,
          stores (name),
          purchase_items (
            id,
            product_id,
            variant_id,
            quantity,
            unit_cost,
            total_cost,
            products (id, name),
            product_variants (id, label, quantity, unit)
          )
        `)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: products } = useQuery({
    queryKey: ['products-for-purchase', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select(`
          *,
          product_variants (
            id,
            label,
            quantity,
            unit,
            price,
            cost_price,
            is_available
          )
        `)
        .eq('is_available', true);

      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
      }

      const { data } = await query.limit(20);
      return data || [];
    },
    enabled: showProductSearch && searchTerm.length > 0,
  });

  // Auto-select newly created product from Products page and restore form state
  useEffect(() => {
    const newProductId = location.state?.newProductId;
    if (newProductId) {
      // Fetch the specific product
      const fetchNewProduct = async () => {
        const { data: product } = await supabase
          .from('products')
          .select(`
            *,
            product_variants (
              id,
              label,
              quantity,
              unit,
              price,
              cost_price,
              is_available
            )
          `)
          .eq('id', newProductId)
          .single();
        
        if (product) {
          // Restore saved form state if available
          const savedState = restorePurchaseFormState();
          
          if (savedState) {
            // Restore all form fields
            setSelectedSupplier(savedState.selectedSupplier);
            setSelectedStore(savedState.selectedStore);
            setPaymentStatus(savedState.paymentStatus);
            setPaymentMethod(savedState.paymentMethod);
            setNotes(savedState.notes);
            
            // Add the newly created product to the restored items
            const unitCost = product.cost_price || product.price;
            const newItem: PurchaseItem = {
              product_id: product.id,
              quantity: 1,
              unit_cost: Number(unitCost),
              total_cost: Number(unitCost),
              product_name: product.name,
            };
            
            // Check if product already exists in saved items
            const existingIndex = savedState.items.findIndex(
              item => item.product_id === product.id && !item.variant_id
            );
            
            let updatedItems: PurchaseItem[];
            if (existingIndex >= 0) {
              // Increment quantity if product exists
              updatedItems = [...savedState.items];
              updatedItems[existingIndex].quantity += 1;
              updatedItems[existingIndex].total_cost = 
                updatedItems[existingIndex].quantity * updatedItems[existingIndex].unit_cost;
            } else {
              // Add new item
              updatedItems = [...savedState.items, newItem];
            }
            
            setItems(updatedItems);
            
            // Reopen the purchase dialog
            setShowNewPurchase(true);
            
            // Clear the saved state after restoration
            clearPurchaseFormState();
            
            toast.success(`"${product.name}" added to purchase`);
          } else {
            // No saved state, just add the product normally
            addProductToItems(product);
            toast.success(`"${product.name}" added to purchase`);
          }
        }
      };
      
      fetchNewProduct();
      // Clear the navigation state
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state?.newProductId]);

  // Auto-select newly created supplier from Contacts page
  useEffect(() => {
    const newSupplierId = location.state?.newSupplierId;
    if (newSupplierId) {
      setSelectedSupplier(newSupplierId);
      setShowNewPurchase(true); // Reopen the dialog
      
      // Fetch the supplier details to show success message
      const fetchNewSupplier = async () => {
        const { data: supplier } = await supabase
          .from('contacts')
          .select('id, name')
          .eq('id', newSupplierId)
          .single();
        
        if (supplier) {
          toast.success(`Supplier "${supplier.name}" selected`);
        }
      };
      
      fetchNewSupplier();
      // Clear the state
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state?.newSupplierId]);

  const createPurchaseMutation = useMutation({
    mutationFn: async (paymentDetails?: Array<{method: string; amount: number}>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get supplier details
      const supplier = suppliers?.find(s => s.id === selectedSupplier);
      if (!supplier) throw new Error('Supplier not found');

      const totalAmount = items.reduce((sum, item) => sum + item.total_cost, 0);

      // Determine payment method display
      const displayMethod = paymentDetails && paymentDetails.length > 1 
        ? 'Multiple' 
        : paymentDetails?.[0]?.method || paymentMethod || 'cash';

      // Create purchase
      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .insert({
          store_id: selectedStore,
          supplier_name: supplier.name,
          supplier_contact: supplier.phone || supplier.email || '',
          total_amount: totalAmount,
          payment_status: paymentStatus,
          payment_method: displayMethod,
          payment_details: paymentDetails || [],
          notes: notes,
          purchased_by: user.id,
        })
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      // Create purchase items and inventory layers
      const purchaseItems = items.map(item => ({
        purchase_id: purchase.id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        total_cost: item.total_cost,
      }));

      const { error: itemsError } = await supabase
        .from('purchase_items')
        .insert(purchaseItems);

      if (itemsError) throw itemsError;

      // Create journal entries if payment status is paid or partial
      if (paymentStatus === 'paid' || paymentStatus === 'partial') {
        await createPurchaseJournalEntries(purchase, paymentDetails || [], supplier);
      }

      return purchase;
    },
    onSuccess: () => {
      toast.success('Purchase created and stock updated!');
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      resetForm();
      setShowNewPurchase(false);
    },
    onError: (error) => {
      toast.error(`Failed to create purchase: ${error.message}`);
    },
  });

  // Function to create journal entries for purchase payments
  const createPurchaseJournalEntries = async (
    purchase: any, 
    payments: Array<{method: string; amount: number}>, 
    supplier: any
  ) => {
    try {
      // Get accounts
      const { data: accounts } = await supabase
        .from('accounts')
        .select('*')
        .in('account_code', ['1510', '2010', '1010', '1020', '1030']);

      if (!accounts || accounts.length === 0) {
        console.error('Required accounts not found');
        return;
      }

      const inventoryAccount = accounts.find(a => a.account_code === '1510'); // Inventory
      const accountsPayableAccount = accounts.find(a => a.account_code === '2010'); // Accounts Payable
      const cashAccount = accounts.find(a => a.account_code === '1010'); // Cash
      const bankAccount = accounts.find(a => a.account_code === '1020'); // Bank
      const mobileMoneyAccount = accounts.find(a => a.account_code === '1030'); // Mobile Money

      // Create journal entry for purchase
      const { data: journalEntry, error: jeError } = await supabase
        .from('journal_entries')
        .insert({
          description: `Purchase from ${supplier.name} - ${purchase.purchase_number}`,
          reference: purchase.purchase_number,
          entry_date: new Date().toISOString().split('T')[0],
          status: 'posted',
          total_debit: purchase.total_amount,
          total_credit: purchase.total_amount,
        })
        .select()
        .single();

      if (jeError) throw jeError;

      // Debit: Inventory (asset increases)
      await supabase.from('journal_entry_lines').insert({
        journal_entry_id: journalEntry.id,
        account_id: inventoryAccount?.id,
        debit_amount: purchase.total_amount,
        credit_amount: 0,
        description: `Inventory purchase - ${purchase.purchase_number}`,
      });

      // Credit: Based on payment method
      if (purchase.payment_status === 'paid') {
        // Fully paid - credit payment accounts
        for (const payment of payments) {
          let accountId;
          switch (payment.method) {
            case 'cash':
              accountId = cashAccount?.id;
              break;
            case 'card':
            case 'bank_transfer':
            case 'cheque':
              accountId = bankAccount?.id;
              break;
            case 'mobile_money':
              accountId = mobileMoneyAccount?.id;
              break;
            default:
              accountId = cashAccount?.id;
          }

          await supabase.from('journal_entry_lines').insert({
            journal_entry_id: journalEntry.id,
            account_id: accountId,
            debit_amount: 0,
            credit_amount: payment.amount,
            description: `Payment via ${payment.method} - ${purchase.purchase_number}`,
          });
        }
      } else {
        // Pending or Partial - credit Accounts Payable (liability increases)
        await supabase.from('journal_entry_lines').insert({
          journal_entry_id: journalEntry.id,
          account_id: accountsPayableAccount?.id,
          debit_amount: 0,
          credit_amount: purchase.total_amount,
          description: `Accounts Payable - ${supplier.name}`,
        });
      }

      // Update account balances via triggers
      // Account balances are automatically updated by database triggers
      
    } catch (error) {
      console.error('Error creating journal entries:', error);
      // Don't throw - allow purchase to complete even if journal entry fails
    }
  };

  const resetForm = () => {
    setSelectedSupplier('');
    setSelectedStore('');
    setPaymentStatus('pending');
    setPaymentMethod('');
    setNotes('');
    setItems([]);
    // Clear any saved form state
    clearPurchaseFormState();
  };

  const addProductToItems = (product: any, variant?: any) => {
    const existingIndex = items.findIndex(
      item => item.product_id === product.id && item.variant_id === variant?.id
    );

    if (existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex].quantity += 1;
      updated[existingIndex].total_cost = updated[existingIndex].quantity * updated[existingIndex].unit_cost;
      setItems(updated);
    } else {
      const unitCost = variant ? (variant.cost_price || variant.price) : (product.cost_price || product.price);
      setItems([
        ...items,
        {
          product_id: product.id,
          variant_id: variant?.id,
          quantity: 1,
          unit_cost: Number(unitCost),
          total_cost: Number(unitCost),
          product_name: product.name,
          variant_label: variant ? (variant.label || `${variant.quantity}${variant.unit}`) : undefined,
        },
      ]);
    }
    setShowProductSearch(false);
    setSearchTerm('');
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Handle create purchase click
  const handleCreatePurchase = () => {
    if (!selectedSupplier || !selectedStore || items.length === 0) {
      return;
    }

    // If payment status is paid or partial, show payment dialog
    if (paymentStatus === 'paid' || paymentStatus === 'partial') {
      const totalAmount = items.reduce((sum, item) => sum + item.total_cost, 0);
      setPendingPaymentPurchase({ totalAmount, isNew: true });
      setShowPaymentDialog(true);
    } else {
      // For pending, create directly
      createPurchaseMutation.mutate(undefined);
    }
  };

  // Handle payment confirmation for new or updated purchase
  const handlePaymentConfirm = async (payments: Array<{id: string; method: string; amount: number}>) => {
    const paymentDetails = payments.map(p => ({ method: p.method, amount: p.amount }));
    
    // Check if we're updating an existing purchase (selectedPurchase is set)
    if (selectedPurchase) {
      await updatePurchaseMutation.mutateAsync({ paymentDetails });
    } else if (pendingPaymentPurchase?.isNew) {
      // Only create new if we don't have a selectedPurchase
      await createPurchaseMutation.mutateAsync(paymentDetails);
    }
    
    setShowPaymentDialog(false);
    setPendingPaymentPurchase(null);
  };

  const updateItemQuantity = (index: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(index);
      return;
    }
    const updated = [...items];
    updated[index].quantity = quantity;
    updated[index].total_cost = quantity * updated[index].unit_cost;
    setItems(updated);
  };

  const updateItemCost = (index: number, cost: number) => {
    const updated = [...items];
    updated[index].unit_cost = cost;
    updated[index].total_cost = cost * updated[index].quantity;
    setItems(updated);
  };

  const totalAmount = items.reduce((sum, item) => sum + item.total_cost, 0);

  const deletePurchaseMutation = useMutation({
    mutationFn: async (purchaseId: string) => {
      // Delete purchase items first
      const { error: itemsError } = await supabase
        .from('purchase_items')
        .delete()
        .eq('purchase_id', purchaseId);

      if (itemsError) throw itemsError;

      // Delete purchase
      const { error: purchaseError } = await supabase
        .from('purchases')
        .delete()
        .eq('id', purchaseId);

      if (purchaseError) throw purchaseError;
    },
    onSuccess: () => {
      toast.success('Purchase deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
    },
    onError: (error) => {
      toast.error(`Failed to delete purchase: ${error.message}`);
    },
  });

  const updatePurchaseMutation = useMutation({
    mutationFn: async ({ paymentDetails }: { paymentDetails?: Array<{method: string; amount: number}> }) => {
      if (!selectedPurchase) throw new Error('No purchase selected');

      const totalAmount = items.reduce((sum, item) => sum + item.total_cost, 0);

      // Get supplier details
      const supplier = suppliers?.find(s => s.id === selectedSupplier);
      if (!supplier) throw new Error('Supplier not found');

      // Determine payment method display
      const displayMethod = paymentDetails && paymentDetails.length > 1 
        ? 'Multiple' 
        : paymentDetails?.[0]?.method || paymentMethod || selectedPurchase.payment_method;

      // Update purchase with all editable fields
      const { error: purchaseError } = await supabase
        .from('purchases')
        .update({
          supplier_name: supplier.name,
          supplier_contact: supplier.phone || supplier.email || null,
          store_id: selectedStore,
          payment_status: paymentStatus,
          payment_method: displayMethod,
          payment_details: paymentDetails || selectedPurchase.payment_details || [],
          notes: notes,
          total_amount: totalAmount,
        })
        .eq('id', selectedPurchase.id);

      if (purchaseError) throw purchaseError;

      // Delete existing purchase items
      await supabase
        .from('purchase_items')
        .delete()
        .eq('purchase_id', selectedPurchase.id);

      // Create new purchase items
      const purchaseItems = items.map(item => ({
        purchase_id: selectedPurchase.id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        total_cost: item.total_cost,
      }));

      const { error: itemsError } = await supabase
        .from('purchase_items')
        .insert(purchaseItems);

      if (itemsError) throw itemsError;

      // Create journal entries if payment status changed to paid or partial
      if (paymentStatus === 'paid' || paymentStatus === 'partial') {
        if (supplier && paymentDetails) {
          await createPurchaseJournalEntries(
            { ...selectedPurchase, total_amount: totalAmount }, 
            paymentDetails, 
            supplier
          );
        }
      }
    },
    onSuccess: () => {
      toast.success('Purchase updated successfully');
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      resetForm();
      setShowEditDialog(false);
      setSelectedPurchase(null);
    },
    onError: (error) => {
      toast.error(`Failed to update purchase: ${error.message}`);
    },
  });

  const handleViewPurchase = (purchase: any) => {
    setSelectedPurchase(purchase);
    setShowViewDialog(true);
  };

  // Handle update purchase click
  const handleUpdatePurchase = () => {
    if (items.length === 0) {
      return;
    }

    // If payment status changed to paid or partial, and it wasn't before
    const wasNotPaid = selectedPurchase?.payment_status === 'pending';
    const isNowPaid = paymentStatus === 'paid' || paymentStatus === 'partial';
    
    if (wasNotPaid && isNowPaid) {
      const totalAmount = items.reduce((sum, item) => sum + item.total_cost, 0);
      setPendingPaymentPurchase({ totalAmount, isNew: false });
      setShowPaymentDialog(true);
    } else {
      // No payment change or already paid
      updatePurchaseMutation.mutate({ paymentDetails: undefined });
    }
  };

  const handleEditPurchase = (purchase: any) => {
    setSelectedPurchase(purchase);
    
    // Find supplier ID by name
    const supplier = suppliers?.find(s => s.name === purchase.supplier_name);
    setSelectedSupplier(supplier?.id || '');
    setSelectedStore(purchase.store_id);
    setPaymentStatus(purchase.payment_status);
    setPaymentMethod(purchase.payment_method || '');
    setNotes(purchase.notes || '');
    
    // Load items
    const purchaseItems = purchase.purchase_items.map((item: any) => ({
      product_id: item.product_id,
      variant_id: item.variant_id || undefined,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
      total_cost: item.total_cost,
      product_name: item.products?.name || '',
      variant_label: item.product_variants ? 
        (item.product_variants.label || `${item.product_variants.quantity}${item.product_variants.unit}`) : 
        undefined,
    }));
    
    setItems(purchaseItems);
    setShowEditDialog(true);
  };

  const handleDeletePurchase = (purchaseId: string) => {
    if (confirm('Are you sure you want to delete this purchase?')) {
      deletePurchaseMutation.mutate(purchaseId);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />

      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Purchase Management</h1>
            <p className="text-muted-foreground">Track inventory purchases and update stock</p>
          </div>
          <div className="flex gap-2">
            <ReturnToPOSButton inline />
            <Button onClick={() => setShowNewPurchase(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Purchase
          </Button>
          </div>
        </div>

        {/* Purchase History */}
        <Card>
          <CardHeader>
            <CardTitle>Purchase History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {purchases?.map((purchase: any) => (
                <div key={purchase.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-semibold">{purchase.purchase_number}</p>
                      <p className="text-sm text-muted-foreground">
                        {purchase.supplier_name} • {purchase.stores.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{formatCurrency(purchase.total_amount)}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {purchase.payment_status}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {purchase.purchase_items.length} items • {new Date(purchase.purchased_at).toLocaleDateString()}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewPurchase(purchase)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditPurchase(purchase)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeletePurchase(purchase.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>

      {/* New Purchase Dialog */}
      <Dialog 
        open={showNewPurchase} 
        onOpenChange={(open) => {
          setShowNewPurchase(open);
          // Clear saved state if dialog is being closed
          if (!open) {
            clearPurchaseFormState();
          }
        }}
      >
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl">Create New Purchase</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 pr-2">
            {/* Header Info Card */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="supplier" className="text-sm font-semibold">Supplier *</Label>
                    <div className="flex gap-2">
                      <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                        <SelectTrigger id="supplier" className="mt-1 flex-1">
                          <SelectValue placeholder="Select supplier" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers?.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id}>
                              {supplier.name}
                              {(supplier.phone || supplier.email) && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  {supplier.phone || supplier.email}
                                </span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="mt-1"
                        onClick={() => navigate('/admin/contacts', { 
                          state: { openAddDialog: true, fromPurchases: true } 
                        })}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="store" className="text-sm font-semibold">Store *</Label>
                    <Select value={selectedStore} onValueChange={setSelectedStore}>
                      <SelectTrigger id="store" className="mt-1">
                        <SelectValue placeholder="Select store" />
                      </SelectTrigger>
                      <SelectContent>
                        {stores?.map((store) => (
                          <SelectItem key={store.id} value={store.id}>
                            {store.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="payment-status" className="text-sm font-semibold">Payment Status</Label>
                    <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                      <SelectTrigger id="payment-status" className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="partial">Partial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-4">
                  <Label htmlFor="payment-method" className="text-sm font-semibold">Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger id="payment-method" className="mt-1">
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="wave_money">Wave Money</SelectItem>
                      <SelectItem value="orange_money">Orange Money</SelectItem>
                      <SelectItem value="store_credit">Store Credit</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Products Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Purchase Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No items added yet. Click "Add Product" to begin.</p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-[40%]">Product</TableHead>
                          <TableHead className="w-[15%] text-center">Quantity</TableHead>
                          <TableHead className="w-[15%] text-right">Unit Cost</TableHead>
                          <TableHead className="w-[20%] text-right">Total</TableHead>
                          <TableHead className="w-[10%] text-center">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, index) => (
                          <TableRow key={index} className="hover:bg-muted/30">
                            <TableCell>
                              <div>
                                <p className="font-medium">{item.product_name}</p>
                                {item.variant_label && (
                                  <p className="text-xs text-muted-foreground">{item.variant_label}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Input
                                ref={index === items.length - 1 ? lastItemRef : null}
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 0)}
                                min="1"
                                className="w-20 mx-auto text-center"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                step="0.01"
                                value={item.unit_cost}
                                onChange={(e) => updateItemCost(index, parseFloat(e.target.value) || 0)}
                                className="w-28 ml-auto text-right"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="font-semibold">{formatCurrency(item.total_cost)}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItem(index)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Add Product Button at Bottom */}
                <Button
                  onClick={() => setShowProductSearch(true)}
                  variant="outline"
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardContent className="pt-6">
                <Label htmlFor="notes" className="text-sm font-semibold">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes or remarks..."
                  rows={3}
                  className="mt-1"
                />
              </CardContent>
            </Card>
          </div>

          {/* Footer - Fixed at bottom */}
          <div className="border-t pt-4 mt-4 bg-background space-y-4">
            <div className="flex justify-between items-center px-2">
              <span className="text-lg font-semibold">Total Amount:</span>
              <span className="text-2xl font-bold text-primary">{formatCurrency(totalAmount)}</span>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  clearPurchaseFormState();
                  setShowNewPurchase(false);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreatePurchase}
                disabled={!selectedSupplier || !selectedStore || items.length === 0 || createPurchaseMutation.isPending}
                className="flex-1"
              >
                {createPurchaseMutation.isPending ? 'Creating...' : 'Create Purchase'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Purchase Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => {
        setShowEditDialog(open);
        if (!open) {
          resetForm();
          setSelectedPurchase(null);
        }
      }}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl">Edit Purchase</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 pr-2">
            {/* Header Info Card */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-supplier" className="text-sm font-semibold">Supplier *</Label>
                    <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                      <SelectTrigger id="edit-supplier" className="mt-1">
                        <SelectValue placeholder="Select supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers?.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                            {(supplier.phone || supplier.email) && (
                              <span className="text-xs text-muted-foreground ml-2">
                                {supplier.phone || supplier.email}
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="edit-store" className="text-sm font-semibold">Store *</Label>
                    <Select value={selectedStore} onValueChange={setSelectedStore}>
                      <SelectTrigger id="edit-store" className="mt-1">
                        <SelectValue placeholder="Select store" />
                      </SelectTrigger>
                      <SelectContent>
                        {stores?.map((store) => (
                          <SelectItem key={store.id} value={store.id}>
                            {store.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="edit-payment-status" className="text-sm font-semibold">Payment Status</Label>
                    <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                      <SelectTrigger id="edit-payment-status" className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="partial">Partial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="edit-payment-method" className="text-sm font-semibold">Payment Method</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger id="edit-payment-method" className="mt-1">
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="wave_money">Wave Money</SelectItem>
                        <SelectItem value="orange_money">Orange Money</SelectItem>
                        <SelectItem value="store_credit">Store Credit</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Products Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Purchase Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No items added yet. Click "Add Product" to begin.</p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-[40%]">Product</TableHead>
                          <TableHead className="w-[15%] text-center">Quantity</TableHead>
                          <TableHead className="w-[15%] text-right">Unit Cost</TableHead>
                          <TableHead className="w-[20%] text-right">Total</TableHead>
                          <TableHead className="w-[10%] text-center">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, index) => (
                          <TableRow key={index} className="hover:bg-muted/30">
                            <TableCell>
                              <div>
                                <p className="font-medium">{item.product_name}</p>
                                {item.variant_label && (
                                  <p className="text-xs text-muted-foreground">{item.variant_label}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Input
                                ref={index === items.length - 1 ? lastItemRef : null}
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 0)}
                                min="1"
                                className="w-20 mx-auto text-center"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                step="0.01"
                                value={item.unit_cost}
                                onChange={(e) => updateItemCost(index, parseFloat(e.target.value) || 0)}
                                className="w-28 ml-auto text-right"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="font-semibold">{formatCurrency(item.total_cost)}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItem(index)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Add Product Button at Bottom */}
                <Button
                  onClick={() => setShowProductSearch(true)}
                  variant="outline"
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardContent className="pt-6">
                <Label htmlFor="edit-notes" className="text-sm font-semibold">Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes or remarks..."
                  rows={3}
                  className="mt-1"
                />
              </CardContent>
            </Card>
          </div>

          {/* Footer - Fixed at bottom */}
          <div className="border-t pt-4 mt-4 bg-background space-y-4">
            <div className="flex justify-between items-center px-2">
              <span className="text-lg font-semibold">Total Amount:</span>
              <span className="text-2xl font-bold text-primary">{formatCurrency(totalAmount)}</span>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditDialog(false);
                  resetForm();
                  setSelectedPurchase(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdatePurchase}
                disabled={!selectedSupplier || !selectedStore || items.length === 0 || updatePurchaseMutation.isPending}
                className="flex-1"
              >
                {updatePurchaseMutation.isPending ? 'Updating...' : 'Update Purchase'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Search Dialog */}
      <Dialog open={showProductSearch} onOpenChange={setShowProductSearch}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Search Products</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                variant="default"
                onClick={() => {
                  // Save current form state before navigating
                  savePurchaseFormState({
                    items,
                    selectedSupplier,
                    selectedStore,
                    paymentStatus,
                    paymentMethod,
                    notes,
                  });
                  
                  setShowProductSearch(false);
                  navigate('/admin/products', { state: { openAddDialog: true, fromPurchases: true } });
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                New Product
              </Button>
            </div>
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {products?.map((product) => {
                const variants = product.product_variants?.filter((v: any) => v.is_available) || [];
                
                return (
                  <div key={product.id} className="border rounded p-3">
                    <p className="font-medium">{product.name}</p>
                    {variants.length > 0 ? (
                      <div className="mt-2 space-y-1">
                        {variants.map((variant: any) => (
                          <Button
                            key={variant.id}
                            variant="outline"
                            size="sm"
                            className="w-full justify-between"
                            onClick={() => addProductToItems(product, variant)}
                          >
                            <span>{variant.label || `${variant.quantity}${variant.unit}`}</span>
                            <span>{formatCurrency(variant.cost_price || variant.price)}</span>
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2"
                        onClick={() => addProductToItems(product)}
                      >
                        Add - {formatCurrency(product.cost_price || product.price)}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Purchase Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Purchase Details</DialogTitle>
          </DialogHeader>
          {selectedPurchase && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Purchase Number</Label>
                  <p className="font-semibold">{selectedPurchase.purchase_number}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Date</Label>
                  <p>{new Date(selectedPurchase.purchased_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Supplier</Label>
                  <p>{selectedPurchase.supplier_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Store</Label>
                  <p>{selectedPurchase.stores.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Payment Status</Label>
                  <p className="capitalize">{selectedPurchase.payment_status}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Payment Method</Label>
                  <p>{selectedPurchase.payment_method || 'N/A'}</p>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Items</Label>
                <div className="border rounded-lg divide-y mt-2">
                  {selectedPurchase.purchase_items.map((item: any) => (
                    <div key={item.id} className="p-3 flex justify-between">
                      <div>
                        <p className="font-medium">{item.products?.name || 'Unknown Product'}</p>
                        {item.product_variants && (
                          <p className="text-sm text-muted-foreground">
                            {item.product_variants.label || `${item.product_variants.quantity}${item.product_variants.unit}`}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          Qty: {item.quantity} × {formatCurrency(item.unit_cost)}
                        </p>
                      </div>
                      <p className="font-semibold">{formatCurrency(item.total_cost)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {selectedPurchase.notes && (
                <div>
                  <Label className="text-muted-foreground">Notes</Label>
                  <p className="text-sm mt-1">{selectedPurchase.notes}</p>
                </div>
              )}

              <div className="border-t pt-4">
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Total Amount:</span>
                  <span>{formatCurrency(selectedPurchase.total_amount)}</span>
                </div>
              </div>

              <Button onClick={() => setShowViewDialog(false)} className="w-full">
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <PurchasePaymentDialog
        isOpen={showPaymentDialog}
        onClose={() => {
          setShowPaymentDialog(false);
          setPendingPaymentPurchase(null);
        }}
        totalAmount={pendingPaymentPurchase?.totalAmount || 0}
        onConfirm={handlePaymentConfirm}
        currentPaymentStatus={paymentStatus}
      />

      <BottomNav />
    </div>
  );
}
