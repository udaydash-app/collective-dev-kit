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
import { Plus, Trash2, Package, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
  const [supplierName, setSupplierName] = useState('');
  const [supplierContact, setSupplierContact] = useState('');
  const [selectedStore, setSelectedStore] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);

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
            quantity,
            unit_cost,
            total_cost,
            products (name),
            product_variants (label, quantity, unit)
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

      const totalAmount = items.reduce((sum, item) => sum + item.total_cost, 0);

      // Create purchase
      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .insert({
          store_id: selectedStore,
          supplier_name: supplierName,
          supplier_contact: supplierContact,
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
    setSupplierName('');
    setSupplierContact('');
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

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />

      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Purchase Management</h1>
            <p className="text-muted-foreground">Track inventory purchases and update stock</p>
          </div>
          <Button onClick={() => setShowNewPurchase(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Purchase
          </Button>
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
                    <div>
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
                  <div className="text-sm text-muted-foreground">
                    {purchase.purchase_items.length} items • {new Date(purchase.purchased_at).toLocaleDateString()}
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
              <div>
                <Label htmlFor="supplier">Supplier Name *</Label>
                <Input
                  id="supplier"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="Enter supplier name"
                />
              </div>
              <div>
                <Label htmlFor="contact">Supplier Contact</Label>
                <Input
                  id="contact"
                  value={supplierContact}
                  onChange={(e) => setSupplierContact(e.target.value)}
                  placeholder="Phone or email"
                />
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
                disabled={!supplierName || !selectedStore || items.length === 0 || createPurchaseMutation.isPending}
                className="flex-1"
              >
                {createPurchaseMutation.isPending ? 'Creating...' : 'Create Purchase'}
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

      <BottomNav />
    </div>
  );
}
