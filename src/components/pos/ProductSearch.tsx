import { useState } from 'react';
import { Search, Barcode } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BarcodeScanner } from './BarcodeScanner';
import { VariantSelector } from './VariantSelector';
import { formatCurrency } from '@/lib/utils';

interface ProductSearchProps {
  onProductSelect: (product: any) => void;
}

export const ProductSearch = ({ onProductSelect }: ProductSearchProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [variantSelectorOpen, setVariantSelectorOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ['pos-products', searchTerm],
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
            is_available,
            is_default
          )
        `)
        .eq('is_available', true)
        .order('name');

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,barcode.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query.limit(20);
      if (error) throw error;
      return data;
    },
    enabled: searchTerm.length > 0,
  });

  const handleProductSelect = (product: any) => {
    const availableVariants = product.product_variants?.filter((v: any) => v.is_available) || [];
    
    if (availableVariants.length > 1) {
      // Show variant selector if multiple variants
      setSelectedProduct(product);
      setVariantSelectorOpen(true);
    } else if (availableVariants.length === 1) {
      // Auto-select single variant
      onProductSelect({
        ...product,
        price: availableVariants[0].price,
        selectedVariant: availableVariants[0],
      });
    } else {
      // No variants, use product price
      onProductSelect(product);
    }
  };

  const handleVariantSelect = (variant: any) => {
    if (selectedProduct) {
      onProductSelect({
        ...selectedProduct,
        price: variant.price,
        selectedVariant: variant,
      });
      setVariantSelectorOpen(false);
    }
  };

  const handleBarcodeSearch = async () => {
    if (!barcodeInput.trim()) return;

    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        product_variants (
          id,
          label,
          quantity,
          unit,
          price,
          is_available,
          is_default
        )
      `)
      .eq('barcode', barcodeInput.trim())
      .eq('is_available', true)
      .maybeSingle();

    if (error) {
      console.error('Barcode search error:', error);
      return;
    }

    if (data) {
      handleProductSelect(data);
      setBarcodeInput('');
    }
  };

  const handleBarcodeScan = async (barcode: string) => {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        product_variants (
          id,
          label,
          quantity,
          unit,
          price,
          is_available,
          is_default
        )
      `)
      .eq('barcode', barcode)
      .eq('is_available', true)
      .maybeSingle();

    if (error) {
      console.error('Barcode scan error:', error);
      return;
    }

    if (data) {
      handleProductSelect(data);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <BarcodeScanner onScan={handleBarcodeScan} />
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Barcode className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Enter barcode manually..."
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleBarcodeSearch()}
            className="pl-10"
          />
        </div>
        <Button onClick={handleBarcodeSearch}>Search</Button>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground text-center py-4">Searching...</p>
      )}

      {products && products.length > 0 && (
        <div className="grid gap-2 max-h-[400px] overflow-y-auto">
          {products.map((product) => {
            const availableVariants = product.product_variants?.filter((v: any) => v.is_available) || [];
            const defaultVariant = availableVariants.find((v: any) => v.is_default) || availableVariants[0];
            const displayPrice = availableVariants.length > 0 
              ? defaultVariant?.price 
              : product.price;

            return (
              <Card
                key={product.id}
                className="p-3 flex items-center gap-3 cursor-pointer hover:bg-accent transition-colors"
                onClick={() => handleProductSelect(product)}
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
                    {product.barcode || 'No barcode'}
                    {availableVariants.length > 0 && ` • ${availableVariants.length} variants`}
                  </p>
                </div>
                <p className="font-bold text-primary">
                  {displayPrice ? formatCurrency(Number(displayPrice)) : 'N/A'}
                </p>
              </Card>
            );
          })}
        </div>
      )}

      {searchTerm && products && products.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No products found</p>
      )}

      <VariantSelector
        isOpen={variantSelectorOpen}
        onClose={() => setVariantSelectorOpen(false)}
        product={selectedProduct}
        onSelectVariant={handleVariantSelect}
      />
    </div>
  );
};
