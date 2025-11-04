import { useState } from 'react';
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

interface PurchaseItem {
  product_id: string;
  variant_id?: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  product_name?: string;
  variant_label?: string;
}

export default function Purchases() {
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

  const queryClient = useQueryClient();

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

  const createPurchaseMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get supplier details
      const supplier = suppliers?.find(s => s.id === selectedSupplier);
      if (!supplier) throw new Error('Supplier not found');

      const totalAmount = items.reduce((sum, item) => sum + item.total_cost, 0);

      // Create purchase
      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .insert({
          store_id: selectedStore,
          supplier_name: supplier.name,
          supplier_contact: supplier.phone || supplier.email || '',
          total_amount: totalAmount,
          payment_status: paymentStatus,
          payment_method: paymentMethod,
          notes: notes,
          purchased_by: user.id,
        })
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      // Create purchase items
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

  const resetForm = () => {
    setSelectedSupplier('');
    setSelectedStore('');
    setPaymentStatus('pending');
    setPaymentMethod('');
    setNotes('');
    setItems([]);
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
      const unitCost = variant ? variant.price : product.price;
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
    mutationFn: async () => {
      if (!selectedPurchase) throw new Error('No purchase selected');

      const totalAmount = items.reduce((sum, item) => sum + item.total_cost, 0);

      // Update purchase
      const { error: purchaseError } = await supabase
        .from('purchases')
        .update({
          payment_status: paymentStatus,
          payment_method: paymentMethod,
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

  const handleEditPurchase = (purchase: any) => {
    setSelectedPurchase(purchase);
    setSelectedSupplier(purchase.supplier_name);
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
      <Dialog open={showNewPurchase} onOpenChange={setShowNewPurchase}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Purchase</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Supplier Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="supplier">Supplier *</Label>
                <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                  <SelectTrigger id="supplier">
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
                <p className="text-xs text-muted-foreground mt-1">
                  Don't see your supplier?{' '}
                  <a href="/admin/contacts" className="text-primary hover:underline">
                    Add one in Contacts
                  </a>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="store">Store *</Label>
                <Select value={selectedStore} onValueChange={setSelectedStore}>
                  <SelectTrigger id="store">
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
                <Label htmlFor="payment-status">Payment Status</Label>
                <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                  <SelectTrigger id="payment-status">
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

            {/* Products */}
            <div>
              <Label>Products</Label>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowProductSearch(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>

              {/* Items List */}
              <div className="mt-4 space-y-2">
                {items.map((item, index) => (
                  <div key={index} className="border rounded p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{item.product_name}</p>
                        {item.variant_label && (
                          <p className="text-sm text-muted-foreground">{item.variant_label}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Quantity</Label>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 0)}
                          min="1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Unit Cost</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.unit_cost}
                          onChange={(e) => updateItemCost(index, parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Total</Label>
                        <Input
                          value={formatCurrency(item.total_cost)}
                          disabled
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
              />
            </div>

            {/* Total */}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center text-lg font-bold">
                <span>Total Amount:</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowNewPurchase(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => createPurchaseMutation.mutate()}
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Purchase</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Payment Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-payment-status">Payment Status</Label>
                <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                  <SelectTrigger id="edit-payment-status">
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
                <Label htmlFor="edit-payment-method">Payment Method</Label>
                <Input
                  id="edit-payment-method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  placeholder="Cash, Card, Bank Transfer..."
                />
              </div>
            </div>

            {/* Products */}
            <div>
              <Label>Products</Label>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowProductSearch(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>

              {/* Items List */}
              <div className="mt-4 space-y-2">
                {items.map((item, index) => (
                  <div key={index} className="border rounded p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{item.product_name}</p>
                        {item.variant_label && (
                          <p className="text-sm text-muted-foreground">{item.variant_label}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Quantity</Label>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 0)}
                          min="1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Unit Cost</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.unit_cost}
                          onChange={(e) => updateItemCost(index, parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Total</Label>
                        <Input
                          value={formatCurrency(item.total_cost)}
                          disabled
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
              />
            </div>

            {/* Total */}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center text-lg font-bold">
                <span>Total Amount:</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
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
                onClick={() => updatePurchaseMutation.mutate()}
                disabled={items.length === 0 || updatePurchaseMutation.isPending}
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
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
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
                            <span>{formatCurrency(variant.price)}</span>
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
                        Add - {formatCurrency(product.price)}
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

      <BottomNav />
    </div>
  );
}
