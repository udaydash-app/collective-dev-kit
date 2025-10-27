import React, { useState } from 'react';
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
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Auto-focus search input on mount
  React.useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Maintain focus on search input for scanner input
  React.useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Allow clicks on these elements
      if (
        target.matches('input[type="number"]') ||
        target.closest('[role="dialog"]') ||
        target.closest('button') ||
        target.closest('[role="button"]') ||
        target === searchInputRef.current
      ) {
        return;
      }
      
      // Prevent blur by stopping the event and refocusing
      e.preventDefault();
      searchInputRef.current?.focus();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // If not focused on an input, focus the search field for scanner input
      const activeElement = document.activeElement as HTMLElement;
      if (
        activeElement?.tagName !== 'INPUT' &&
        activeElement?.tagName !== 'TEXTAREA' &&
        !activeElement?.closest('[role="dialog"]')
      ) {
        searchInputRef.current?.focus();
      }
    };

    // Periodically check and refocus (for scanner reliability)
    const focusInterval = setInterval(() => {
      const activeElement = document.activeElement as HTMLElement;
      if (
        !document.querySelector('[role="dialog"]') &&
        !activeElement?.matches('input[type="number"]') &&
        activeElement !== searchInputRef.current
      ) {
        searchInputRef.current?.focus();
      }
    }, 100);

    document.addEventListener('mousedown', handleMouseDown, true); // Use capture phase
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('keydown', handleKeyDown);
      clearInterval(focusInterval);
    };
  }, []);

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
      // Clear search and refocus
      setSearchTerm('');
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      // No variants, use product price
      onProductSelect(product);
      // Clear search and refocus
      setSearchTerm('');
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  };

  // Handle barcode scan from search field
  const handleSearchKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      e.preventDefault();
      
      // Try to find exact barcode match first
      const { data: exactMatch } = await supabase
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
        .eq('barcode', searchTerm.trim())
        .eq('is_available', true)
        .maybeSingle();

      if (exactMatch) {
        // Found exact barcode match - add directly to cart
        handleProductSelect(exactMatch);
      }
      // If no exact match, the regular search results will show
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
      // Clear search and refocus
      setSearchTerm('');
      setTimeout(() => searchInputRef.current?.focus(), 50);
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
      // Refocus search after barcode search
      setTimeout(() => searchInputRef.current?.focus(), 200);
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
      // Refocus search after barcode scan
      setTimeout(() => searchInputRef.current?.focus(), 200);
    }
  };

  return (
    <div ref={containerRef} className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Scan barcode or search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearchKeyDown}
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
