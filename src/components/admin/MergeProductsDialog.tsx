import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  stock_quantity: number;
  price: number;
  cost_price?: number;
  product_variants?: Array<{
    id: string;
    stock_quantity: number;
    unit: string;
    label?: string;
    price: number;
  }>;
}

interface MergeProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  onSuccess: () => void;
}

export function MergeProductsDialog({ open, onOpenChange, products, onSuccess }: MergeProductsDialogProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);
  
  // Check if any product has variants
  const hasVariants = products.some(p => p.product_variants && p.product_variants.length > 0);
  
  // Get all variants from all products
  const allVariants = products.flatMap(p => 
    (p.product_variants || []).map(v => ({
      ...v,
      productName: p.name
    }))
  );

  const handleMerge = async () => {
    if (!selectedProductId) {
      toast.error("Please select which product to keep");
      return;
    }

    const keepProduct = products.find(p => p.id === selectedProductId);
    const mergeProducts = products.filter(p => p.id !== selectedProductId);

    if (!keepProduct || mergeProducts.length === 0) {
      toast.error("Invalid selection");
      return;
    }

    setMerging(true);

    try {
      // Transfer inventory layers from merged products to kept product
      for (const product of mergeProducts) {
        const { error: layerError } = await supabase
          .from('inventory_layers')
          .update({ product_id: keepProduct.id })
          .eq('product_id', product.id);

        if (layerError) console.error('Error transferring inventory layers:', layerError);
      }

      // Handle variants based on user selection
      if (hasVariants && selectedVariantIds.length > 0) {
        // Transfer only selected variants to kept product
        const { error: variantError } = await supabase
          .from('product_variants')
          .update({ product_id: keepProduct.id })
          .in('id', selectedVariantIds);

        if (variantError) {
          console.error('Error transferring selected variants:', variantError);
          throw new Error('Failed to transfer variants');
        }
        
        // Check if non-selected variants have any references before deleting
        const allVariantIds = allVariants.map(v => v.id);
        const variantsToDelete = allVariantIds.filter(id => !selectedVariantIds.includes(id));
        
        if (variantsToDelete.length > 0) {
          // Check for references in related tables
          const { data: cartRefs } = await supabase
            .from('cart_items')
            .select('id')
            .in('variant_id', variantsToDelete)
            .limit(1);
            
          const { data: purchaseRefs } = await supabase
            .from('purchase_items')
            .select('id')
            .in('variant_id', variantsToDelete)
            .limit(1);
            
          const { data: inventoryRefs } = await supabase
            .from('inventory_layers')
            .select('id')
            .in('variant_id', variantsToDelete)
            .limit(1);

          if (cartRefs?.length || purchaseRefs?.length || inventoryRefs?.length) {
            toast.error('Cannot delete non-selected variants: they have transaction history or are in carts');
            throw new Error('Variants have foreign key references');
          }

          // Safe to delete - no references found
          const { error: deleteVariantError } = await supabase
            .from('product_variants')
            .delete()
            .in('id', variantsToDelete);
            
          if (deleteVariantError) {
            console.error('Error deleting non-selected variants:', deleteVariantError);
            throw deleteVariantError;
          }
        }
      } else {
        // No variants selected or no variants exist, transfer all variants
        for (const product of mergeProducts) {
          if (product.product_variants && product.product_variants.length > 0) {
            const { error: variantError } = await supabase
              .from('product_variants')
              .update({ product_id: keepProduct.id })
              .eq('product_id', product.id);

            if (variantError) {
              console.error('Error transferring variants:', variantError);
              throw variantError;
            }
          }
        }
      }

      // Update references in other tables
      for (const product of mergeProducts) {
        // Update purchase items
        await supabase
          .from('purchase_items')
          .update({ product_id: keepProduct.id })
          .eq('product_id', product.id);

        // Update order items
        await supabase
          .from('order_items')
          .update({ product_id: keepProduct.id })
          .eq('product_id', product.id);

        // Update cart items
        await supabase
          .from('cart_items')
          .update({ product_id: keepProduct.id })
          .eq('product_id', product.id);

        // Update favorites
        await supabase
          .from('favorites')
          .update({ product_id: keepProduct.id })
          .eq('product_id', product.id);

        // Update wishlist
        await supabase
          .from('wishlist')
          .update({ product_id: keepProduct.id })
          .eq('product_id', product.id);

        // Update stock adjustments
        await supabase
          .from('stock_adjustments')
          .update({ product_id: keepProduct.id })
          .eq('product_id', product.id);

        // Update production outputs
        await supabase
          .from('production_outputs')
          .update({ product_id: keepProduct.id })
          .eq('product_id', product.id);

        // Update productions (source product)
        await supabase
          .from('productions')
          .update({ source_product_id: keepProduct.id })
          .eq('source_product_id', product.id);
      }

      // Delete the merged products
      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .in('id', mergeProducts.map(p => p.id));

      if (deleteError) throw deleteError;

      // Recalculate stock from inventory layers using edge function to bypass triggers
      const { error: fixStockError } = await supabase.functions.invoke('fix-product-stock', {
        body: { productId: keepProduct.id }
      });

      if (fixStockError) {
        console.error('Error fixing stock:', fixStockError);
        // Fallback to direct update
        const { data: layers } = await supabase
          .from('inventory_layers')
          .select('quantity_remaining')
          .eq('product_id', keepProduct.id);

        const totalStock = layers?.reduce((sum, layer) => sum + (layer.quantity_remaining || 0), 0) || 0;

        await supabase
          .from('products')
          .update({ stock_quantity: totalStock })
          .eq('id', keepProduct.id);
      }

      toast.success(`Successfully merged ${mergeProducts.length} products into "${keepProduct.name}"`);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error merging products:', error);
      toast.error(error.message || "Failed to merge products");
    } finally {
      setMerging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Merge Products</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select which product to keep. All stock quantities will be combined into the selected product.
          </p>
          
          <div className="space-y-3">
            <Label>Products to merge ({products.length})</Label>
            <RadioGroup value={selectedProductId} onValueChange={setSelectedProductId}>
              {products.map((product) => (
                <div key={product.id} className="flex items-start space-x-2 rounded-lg border p-3">
                  <RadioGroupItem value={product.id} id={product.id} className="mt-1" />
                  <Label htmlFor={product.id} className="flex-1 cursor-pointer">
                    <div className="font-medium">{product.name}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Stock: {product.stock_quantity || 0} | 
                      Price: {formatCurrency(product.price)}
                      {product.product_variants && product.product_variants.length > 0 && (
                        <span> | {product.product_variants.length} variants</span>
                      )}
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {selectedProductId && hasVariants && (
            <div className="space-y-3">
              <Label>Select variants to keep</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {allVariants.map((variant) => (
                  <div key={variant.id} className="flex items-center space-x-2 rounded-lg border p-2">
                    <input
                      type="checkbox"
                      id={variant.id}
                      checked={selectedVariantIds.includes(variant.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedVariantIds([...selectedVariantIds, variant.id]);
                        } else {
                          setSelectedVariantIds(selectedVariantIds.filter(id => id !== variant.id));
                        }
                      }}
                      className="h-4 w-4"
                    />
                    <Label htmlFor={variant.id} className="flex-1 cursor-pointer text-sm">
                      <div className="font-medium">{variant.productName}</div>
                      <div className="text-muted-foreground">
                        {variant.label || variant.unit} - Stock: {variant.stock_quantity || 0} - {formatCurrency(variant.price)}
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedProductId && (
            <div className="rounded-lg bg-muted p-3 text-sm">
              <strong>Result:</strong> All products will be merged into "
              {products.find(p => p.id === selectedProductId)?.name}". 
              Stock will be automatically recalculated from inventory layers.
              {hasVariants && selectedVariantIds.length > 0 && (
                <div className="mt-1">
                  {selectedVariantIds.length} variant(s) will be kept.
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleMerge}
              disabled={!selectedProductId || merging || (hasVariants && selectedVariantIds.length === 0)}
              className="flex-1"
            >
              {merging && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Merge Products
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={merging}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
