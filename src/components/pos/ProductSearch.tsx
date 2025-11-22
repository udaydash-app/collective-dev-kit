import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { VariantSelector } from './VariantSelector';
import { AssignBarcodeDialog } from './AssignBarcodeDialog';
import { formatCurrency } from '@/lib/utils';

interface ProductSearchProps {
  onProductSelect: (product: any) => void;
}

export const ProductSearch = ({ onProductSelect }: ProductSearchProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [variantSelectorOpen, setVariantSelectorOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [assignBarcodeOpen, setAssignBarcodeOpen] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const productRefs = React.useRef<(HTMLDivElement | null)[]>([]);

  // Reset highlighted index when search term changes
  React.useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchTerm]);

  // Scroll highlighted item into view
  React.useEffect(() => {
    if (highlightedIndex >= 0 && productRefs.current[highlightedIndex]) {
      productRefs.current[highlightedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'auto'
      });
    }
  }, [highlightedIndex]);

  const { data: products, isLoading } = useQuery({
    queryKey: ['pos-products', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select(`
          id,
          name,
          price,
          barcode,
          is_available,
          stock_quantity,
          cost_price,
          product_variants (
            id,
            label,
            quantity,
            unit,
            price,
            is_available,
            is_default,
            barcode
          )
        `)
        .eq('is_available', true)
        .order('name');

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,barcode.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query.limit(20);
      if (error) throw error;
      
      // If search term looks like a barcode, check variant barcodes (supporting comma-separated barcodes)
      if (searchTerm && data) {
        const enhancedData = data.map(product => {
          const matchingVariant = product.product_variants?.find((v: any) => {
            if (!v.barcode) return false;
            // Split barcode by comma and check if any matches
            const barcodes = v.barcode.split(',').map((b: string) => b.trim().toLowerCase());
            return barcodes.some((b: string) => b.includes(searchTerm.toLowerCase()));
          });
          return {
            ...product,
            _matchingVariant: matchingVariant
          };
        });
        return enhancedData;
      }
      
      return data;
    },
    enabled: searchTerm.length > 0,
    staleTime: 30000, // Cache for 30 seconds for faster repeated scans
    gcTime: 60000, // Keep in memory for 1 minute
  });

  const handleProductSelect = (product: any, fromClick: boolean = false) => {
    const availableVariants = product.product_variants?.filter((v: any) => v.is_available) || [];
    const matchingVariant = product._matchingVariant;
    
    if (matchingVariant) {
      onProductSelect({
        ...product,
        price: matchingVariant.price,
        selectedVariant: matchingVariant,
      });
      setSearchTerm('');
      return;
    }
    
    if (fromClick && availableVariants.length > 1) {
      setSelectedProduct(product);
      setVariantSelectorOpen(true);
    } else if (availableVariants.length > 0) {
      const defaultVariant = availableVariants.find((v: any) => v.is_default) || availableVariants[0];
      onProductSelect({
        ...product,
        price: defaultVariant.price,
        selectedVariant: defaultVariant,
      });
      setSearchTerm('');
    } else {
      onProductSelect(product);
      setSearchTerm('');
    }
  };

  // Handle barcode scan from search field
  const handleSearchKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle arrow key navigation
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => 
        products && prev < products.length - 1 ? prev + 1 : prev
      );
      return;
    }
    
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
      return;
    }

    if (e.key === 'Enter' && searchTerm.trim()) {
      e.preventDefault();
      
      // If a product is highlighted, select it
      if (highlightedIndex >= 0 && products && products[highlightedIndex]) {
        handleProductSelect(products[highlightedIndex], false);
        return;
      }
      
      const barcode = searchTerm.trim().toLowerCase();
      
      const { data: allVariants } = await supabase
        .from('product_variants')
        .select(`
          id,
          label,
          quantity,
          unit,
          price,
          barcode,
          is_available,
          product_id
        `)
        .eq('is_available', true)
        .ilike('barcode', `%${barcode}%`);
      
      const matchedVariant = allVariants?.find((v: any) => {
        if (!v.barcode) return false;
        const barcodes = v.barcode.split(',').map((b: string) => b.trim().toLowerCase());
        return barcodes.some((b: string) => b === barcode || b.includes(barcode) || barcode.includes(b));
      });
      
      if (matchedVariant) {
        const { data: fullProduct } = await supabase
          .from('products')
          .select(`
            id,
            name,
            price,
            barcode,
            stock_quantity,
            cost_price,
            product_variants (
              id,
              label,
              quantity,
              unit,
              price,
              is_available,
              is_default,
              barcode
            )
          `)
          .eq('id', matchedVariant.product_id)
          .single();
        
        if (fullProduct) {
          onProductSelect({
            ...fullProduct,
            price: matchedVariant.price,
            selectedVariant: matchedVariant,
          });
          setSearchTerm('');
          return;
        }
      }
      
      const { data: directProducts } = await supabase
        .from('products')
        .select(`
          id,
          name,
          price,
          barcode,
          stock_quantity,
          cost_price,
          product_variants (
            id,
            label,
            quantity,
            unit,
            price,
            is_available,
            is_default,
            barcode
          )
        `)
        .eq('is_available', true)
        .not('barcode', 'is', null);

      const matchedDirectProduct = directProducts?.find((p: any) => {
        if (!p.barcode) return false;
        const productBarcodes = p.barcode.split(',').map((b: string) => b.trim().toLowerCase());
        return productBarcodes.includes(barcode);
      });

      if (matchedDirectProduct) {
        if (matchedDirectProduct.product_variants && matchedDirectProduct.product_variants.length > 0) {
          const availableVariants = matchedDirectProduct.product_variants.filter((v: any) => v.is_available);
          const defaultVariant = availableVariants.find((v: any) => v.is_default);
          const selectedVariant = defaultVariant || availableVariants[0];
          
          if (selectedVariant) {
            onProductSelect({
              ...matchedDirectProduct,
              price: selectedVariant.price,
              selectedVariant,
            });
          }
        } else {
          onProductSelect(matchedDirectProduct);
        }
        setSearchTerm('');
        return;
      }

      setScannedBarcode(barcode);
      setAssignBarcodeOpen(true);
      setSearchTerm('');
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
      // Clear search but don't refocus - user might want to navigate cart
      setSearchTerm('');
    }
  };


  return (
    <div ref={containerRef} className="space-y-4">
      <Input
        ref={searchInputRef}
        placeholder="Scan barcode..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onKeyDown={handleSearchKeyDown}
      />

      {products && products.length > 0 && (
        <Card className="max-h-[400px] overflow-hidden">
          <div className="overflow-y-auto max-h-[400px]">
            <div className="min-w-full">
              <div className="grid grid-cols-[120px_1fr_100px_80px] gap-2 px-3 py-2 bg-muted/50 border-b sticky top-0 z-10">
                <div className="font-semibold text-xs">Barcode</div>
                <div className="font-semibold text-xs">Product Name</div>
                <div className="font-semibold text-xs text-right">Price</div>
                <div className="font-semibold text-xs text-right">Stock</div>
              </div>
              
              {products.map((product, index) => {
                const availableVariants = product.product_variants?.filter((v: any) => v.is_available) || [];
                const defaultVariant = availableVariants.find((v: any) => v.is_default) || availableVariants[0];
                const displayPrice = availableVariants.length > 0 
                  ? defaultVariant?.price 
                  : product.price;
                const displayStock = availableVariants.length > 0
                  ? defaultVariant?.quantity || 0
                  : product.stock_quantity || 0;
                const isHighlighted = index === highlightedIndex;

                return (
                  <div
                    key={product.id}
                    ref={(el) => (productRefs.current[index] = el)}
                    className={`grid grid-cols-[120px_1fr_100px_80px] gap-2 px-3 py-2 cursor-pointer border-b last:border-b-0 ${
                      isHighlighted ? 'bg-primary/10' : ''
                    }`}
                    onClick={() => handleProductSelect(product, true)}
                  >
                    <div className="text-sm truncate">{product.barcode || '-'}</div>
                    <div className="text-sm font-medium truncate">{product.name}</div>
                    <div className="text-sm font-semibold text-right">{displayPrice ? formatCurrency(Number(displayPrice)) : '-'}</div>
                    <div className="text-sm text-right">{displayStock}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      <VariantSelector
        isOpen={variantSelectorOpen}
        onClose={() => setVariantSelectorOpen(false)}
        product={selectedProduct}
        onSelectVariant={handleVariantSelect}
      />

      <AssignBarcodeDialog
        isOpen={assignBarcodeOpen}
        onClose={() => {
          setAssignBarcodeOpen(false);
          setSearchTerm('');
        }}
        barcode={scannedBarcode}
        onBarcodeAssigned={() => {
          setSearchTerm('');
        }}
      />
    </div>
  );
};
