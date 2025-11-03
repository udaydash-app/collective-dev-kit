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

  const { data: products, isLoading } = useQuery({
    queryKey: ['products-for-barcode', productSearch],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('id, name, price, barcode, image_url, unit')
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

  const handleAssignBarcode = async (productId: string, productName: string) => {
    setIsAssigning(true);
    try {
      const { error } = await supabase
        .from('products')
        .update({ barcode })
        .eq('id', productId);

      if (error) throw error;

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

            {products && products.length === 0 && productSearch && (
              <Card className="p-6 text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  No products found for "{productSearch}"
                </p>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Would you like to add a new product?</p>
                  <Button
                    onClick={() => {
                      onClose();
                      navigate('/admin/products');
                    }}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add New Product
                  </Button>
                </div>
              </Card>
            )}

            {products && products.length === 0 && !productSearch && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Search for a product to assign this barcode
              </p>
            )}

            {products?.map((product) => (
              <Card
                key={product.id}
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
                    {product.barcode ? `Current: ${product.barcode}` : 'No barcode'}
                  </p>
                </div>
                <div className="text-right flex items-center gap-3">
                  <p className="font-bold text-primary">
                    {formatCurrency(Number(product.price))}
                  </p>
                  <Button
                    size="sm"
                    onClick={() => handleAssignBarcode(product.id, product.name)}
                    disabled={isAssigning}
                  >
                    {isAssigning ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Assign'
                    )}
                  </Button>
                </div>
              </Card>
            ))}
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
