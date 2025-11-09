import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Search, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface AssignBarcodeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  barcode: string;
  onBarcodeAssigned?: () => void;
}

export const AssignBarcodeDialog = ({ 
  isOpen, 
  onClose, 
  barcode, 
  onBarcodeAssigned 
}: AssignBarcodeDialogProps) => {
  const navigate = useNavigate();
  const [productSearch, setProductSearch] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  // First check if barcode already exists in products or variants
  const { data: existingBarcode } = useQuery({
    queryKey: ['existing-barcode', barcode],
    queryFn: async () => {
      // Check products
      const { data: productData } = await supabase
        .from('products')
        .select('id, name, barcode')
        .eq('barcode', barcode)
        .maybeSingle();
      
      if (productData) {
        return { type: 'product', name: productData.name };
      }

      // Check variants
      const { data: variantData } = await supabase
        .from('product_variants')
        .select('id, label, barcode, product:products(name)')
        .eq('barcode', barcode)
        .maybeSingle();
      
      if (variantData) {
        return { 
          type: 'variant', 
          name: `${variantData.product.name} (${variantData.label})` 
        };
      }

      return null;
    },
    enabled: isOpen && !!barcode,
  });

  const { data: productsWithVariants, isLoading } = useQuery({
    queryKey: ['products-for-barcode', productSearch],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select(`
          id, 
          name, 
          price, 
          barcode, 
          image_url, 
          unit,
          product_variants (
            id,
            label,
            barcode,
            price,
            is_available
          )
        `)
        .eq('is_available', true)
        .order('name');

      if (productSearch) {
        query = query.ilike('name', `%${productSearch}%`);
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data;
    },
    enabled: isOpen,
  });

  const handleAssignBarcode = async (productId: string, productName: string, variantId?: string) => {
    setIsAssigning(true);
    try {
      if (variantId) {
        // Assign to variant
        const { error } = await supabase
          .from('product_variants')
          .update({ barcode })
          .eq('id', variantId);

        if (error) throw error;
      } else {
        // Assign to product
        const { error } = await supabase
          .from('products')
          .update({ barcode })
          .eq('id', productId);

        if (error) throw error;
      }

      toast.success(`Barcode ${barcode} assigned to ${productName}`);
      onBarcodeAssigned?.();
      onClose();
    } catch (error) {
      console.error('Error assigning barcode:', error);
      toast.error('Failed to assign barcode');
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Assign Barcode to Product</DialogTitle>
          <DialogDescription>
            Barcode <span className="font-mono font-semibold">{barcode}</span> not found. Select a product to assign this barcode.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {existingBarcode && (
            <Card className="p-4 bg-destructive/10 border-destructive">
              <p className="text-sm font-medium text-destructive">
                This barcode is already assigned to: <span className="font-bold">{existingBarcode.name}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Please use a different barcode or update the existing product.
              </p>
            </Card>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!existingBarcode && productsWithVariants && productsWithVariants.length === 0 && productSearch && (
              <Card className="p-6 text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  No products found for "{productSearch}"
                </p>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Would you like to add a new product?</p>
                  <Button
                    onClick={() => {
                      onClose();
                      navigate(`/admin/products?addNew=true&barcode=${encodeURIComponent(barcode)}&returnTo=pos`);
                    }}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add New Product
                  </Button>
                </div>
              </Card>
            )}

            {productsWithVariants && productsWithVariants.length === 0 && !productSearch && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Search for a product to assign this barcode
              </p>
            )}

            {productsWithVariants?.map((product) => {
              const availableVariants = product.product_variants?.filter((v: any) => v.is_available) || [];
              
              return (
                <div key={product.id} className="space-y-2">
                  {/* Main Product */}
                  <Card
                    className="p-3 flex items-center gap-3 hover:bg-accent transition-colors"
                  >
                    {product.image_url && (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {product.barcode ? `Barcode: ${product.barcode}` : 'No barcode'}
                      </p>
                      {availableVariants.length > 0 && (
                        <p className="text-xs font-semibold text-primary mt-1">
                          📦 {availableVariants.length} variant{availableVariants.length > 1 ? 's' : ''} available - assign barcode to variant below
                        </p>
                      )}
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <p className="font-bold text-primary">
                        {formatCurrency(Number(product.price))}
                      </p>
                      <Button
                        size="sm"
                        onClick={() => handleAssignBarcode(product.id, product.name)}
                        disabled={isAssigning || availableVariants.length > 0}
                        variant={availableVariants.length > 0 ? "outline" : "default"}
                      >
                        {isAssigning ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : availableVariants.length > 0 ? (
                          'Has Variants'
                        ) : (
                          'Assign to Product'
                        )}
                      </Button>
                    </div>
                  </Card>

                  {/* Variants - Enhanced visibility */}
                  {availableVariants.length > 0 && (
                    <div className="pl-4 space-y-2 border-l-4 border-primary/20 ml-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Select Variant to Assign Barcode:
                      </p>
                      {availableVariants.map((variant: any) => (
                        <Card
                          key={variant.id}
                          className="p-4 flex items-center gap-3 hover:bg-primary/5 transition-colors border-2 border-primary/20 cursor-pointer"
                          onClick={() => handleAssignBarcode(
                            product.id, 
                            `${product.name} (${variant.label})`,
                            variant.id
                          )}
                        >
                          <div className="flex-1">
                            <p className="font-semibold text-base">
                              📦 {variant.label || 'Default Variant'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {variant.barcode ? (
                                <>Current barcode: <span className="font-mono">{variant.barcode}</span></>
                              ) : (
                                <span className="text-orange-600 dark:text-orange-400 font-medium">⚠️ No barcode assigned</span>
                              )}
                            </p>
                          </div>
                          <div className="text-right flex items-center gap-3">
                            <p className="font-bold text-primary">
                              {formatCurrency(Number(variant.price))}
                            </p>
                            <Button
                              size="default"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAssignBarcode(
                                  product.id, 
                                  `${product.name} (${variant.label})`,
                                  variant.id
                                );
                              }}
                              disabled={isAssigning}
                              className="min-w-[120px]"
                            >
                              {isAssigning ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Assign to Variant'
                              )}
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
