import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { toast } from 'sonner';

interface SelectedProduct {
  product_id: string;
  variant_id?: string;
  quantity: number;
  name: string;
  price: number;
}

interface ComboOfferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCombo?: any;
}

export function ComboOfferDialog({ open, onOpenChange, editingCombo }: ComboOfferDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [comboPrice, setComboPrice] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState('0');
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const queryClient = useQueryClient();

  const { data: products } = useQuery({
    queryKey: ['products-for-combo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          price,
          product_variants (
            id,
            label,
            price
          )
        `)
        .eq('is_available', true)
        .order('name');

      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (editingCombo) {
      setName(editingCombo.name);
      setDescription(editingCombo.description || '');
      setComboPrice(editingCombo.combo_price.toString());
      setIsActive(editingCombo.is_active);
      setDisplayOrder(editingCombo.display_order?.toString() || '0');
      
      const items = editingCombo.combo_offer_items?.map((item: any) => ({
        product_id: item.product_id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        name: item.variant_id 
          ? `${item.products?.name} (${item.product_variants?.label})`
          : item.products?.name,
        price: item.variant_id 
          ? item.product_variants?.price || 0
          : item.products?.price || 0,
      })) || [];
      
      setSelectedProducts(items);
    } else {
      resetForm();
    }
  }, [editingCombo, open]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setComboPrice('');
    setIsActive(true);
    setDisplayOrder('0');
    setSelectedProducts([]);
    setSelectedProductId('');
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name || !comboPrice || selectedProducts.length === 0) {
        throw new Error('Please fill all required fields and add at least one product');
      }

      const comboData = {
        name,
        description: description || null,
        combo_price: parseFloat(comboPrice),
        is_active: isActive,
        display_order: parseInt(displayOrder) || 0,
      };

      let comboId: string;

      if (editingCombo) {
        const { error } = await supabase
          .from('combo_offers')
          .update(comboData)
          .eq('id', editingCombo.id);
        if (error) throw error;
        comboId = editingCombo.id;

        // Delete existing items
        await supabase
          .from('combo_offer_items')
          .delete()
          .eq('combo_offer_id', comboId);
      } else {
        const { data, error } = await supabase
          .from('combo_offers')
          .insert(comboData)
          .select()
          .single();
        if (error) throw error;
        comboId = data.id;
      }

      // Insert combo items
      const items = selectedProducts.map(p => ({
        combo_offer_id: comboId,
        product_id: p.product_id,
        variant_id: p.variant_id || null,
        quantity: p.quantity,
      }));

      const { error: itemsError } = await supabase
        .from('combo_offer_items')
        .insert(items);
      if (itemsError) throw itemsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['combo-offers'] });
      toast.success(editingCombo ? 'Combo updated successfully' : 'Combo created successfully');
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save combo');
    },
  });

  const handleAddProduct = () => {
    if (!selectedProductId) return;

    const [productId, variantId] = selectedProductId.split('|');
    const product = products?.find(p => p.id === productId);
    if (!product) return;

    const variant = variantId 
      ? product.product_variants?.find(v => v.id === variantId)
      : null;

    const newProduct: SelectedProduct = {
      product_id: productId,
      variant_id: variantId || undefined,
      quantity: 1,
      name: variant ? `${product.name} (${variant.label})` : product.name,
      price: variant?.price || product.price,
    };

    setSelectedProducts(prev => [...prev, newProduct]);
    setSelectedProductId('');
  };

  const handleRemoveProduct = (index: number) => {
    setSelectedProducts(prev => prev.filter((_, i) => i !== index));
  };

  const handleQuantityChange = (index: number, quantity: number) => {
    if (quantity < 1) return;
    setSelectedProducts(prev =>
      prev.map((p, i) => (i === index ? { ...p, quantity } : p))
    );
  };

  const calculateTotalPrice = () => {
    return selectedProducts.reduce((sum, p) => sum + (p.price * p.quantity), 0);
  };

  const calculateSavings = () => {
    const total = calculateTotalPrice();
    const combo = parseFloat(comboPrice) || 0;
    return total - combo;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingCombo ? 'Edit Combo Offer' : 'Create Combo Offer'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Combo Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Family Pack"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
            />
          </div>

          <div>
            <Label>Add Products *</Label>
            <div className="flex gap-2">
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products?.map(product => (
                    <div key={product.id}>
                      <SelectItem value={product.id}>
                        {product.name} - ₹{product.price}
                      </SelectItem>
                      {product.product_variants?.map(variant => (
                        <SelectItem key={variant.id} value={`${product.id}|${variant.id}`}>
                          {product.name} ({variant.label}) - ₹{variant.price}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleAddProduct} type="button">
                Add
              </Button>
            </div>
          </div>

          {selectedProducts.length > 0 && (
            <div className="border rounded-lg p-4 space-y-2">
              <Label>Selected Products</Label>
              {selectedProducts.map((product, index) => (
                <div key={index} className="flex items-center justify-between gap-2 bg-muted p-2 rounded">
                  <div className="flex-1">
                    <div className="font-medium">{product.name}</div>
                    <div className="text-sm text-muted-foreground">
                      ₹{product.price} each
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      value={product.quantity}
                      onChange={(e) => handleQuantityChange(index, parseInt(e.target.value) || 1)}
                      className="w-20"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveProduct(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="comboPrice">Combo Price *</Label>
              <Input
                id="comboPrice"
                type="number"
                step="0.01"
                value={comboPrice}
                onChange={(e) => setComboPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="displayOrder">Display Order</Label>
              <Input
                id="displayOrder"
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value)}
              />
            </div>
          </div>

          {selectedProducts.length > 0 && comboPrice && (
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span>Regular Total:</span>
                <span className="line-through">₹{calculateTotalPrice().toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-green-600">
                <span>Combo Price:</span>
                <span>₹{parseFloat(comboPrice).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Customer Saves:</span>
                <Badge variant="secondary">
                  ₹{calculateSavings().toFixed(2)}
                </Badge>
              </div>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="isActive">Active</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : editingCombo ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
