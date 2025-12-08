import React, { useState, useImperativeHandle, forwardRef, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { VariantSelector } from './VariantSelector';
import { AssignBarcodeDialog } from './AssignBarcodeDialog';
import { formatCurrency } from '@/lib/utils';
import { offlineDB } from '@/lib/offlineDB';
import { shouldUseLocalData } from '@/lib/localModeHelper';

export interface ProductSearchRef {
  focus: () => void;
}

interface ProductSearchProps {
  onProductSelect: (product: any) => void;
}

export const ProductSearch = forwardRef<ProductSearchRef, ProductSearchProps>(({ onProductSelect }, ref) => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [variantSelectorOpen, setVariantSelectorOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [assignBarcodeOpen, setAssignBarcodeOpen] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  // Use memoized local data check for performance
  const useLocalData = useMemo(() => shouldUseLocalData(), []);
  const [isLocalMode, setIsLocalMode] = useState(useLocalData);
  
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const productRefs = React.useRef<(HTMLDivElement | null)[]>([]);

  // Track offline status changes
  useEffect(() => {
    const handleOnline = () => setIsLocalMode(shouldUseLocalData());
    const handleOffline = () => setIsLocalMode(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Expose focus method to parent via ref
  useImperativeHandle(ref, () => ({
    focus: () => {
      searchInputRef.current?.focus();
    }
  }));

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

  // Listen for real-time stock updates (only when online and not local mode)
  useEffect(() => {
    if (isLocalMode) return;
    
    const channel = supabase
      .channel('product-stock-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products'
        },
        () => {
          console.log('Product stock changed - invalidating queries');
          queryClient.invalidateQueries({ 
            queryKey: ['pos-products']
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'product_variants'
        },
        () => {
          console.log('Variant stock changed - invalidating queries');
          queryClient.invalidateQueries({ 
            queryKey: ['pos-products']
          });
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, isLocalMode]);

  const { data: products, isLoading } = useQuery({
    queryKey: ['pos-products', searchTerm, isLocalMode],
    queryFn: async () => {
      // Use IndexedDB for offline OR local mode (faster)
      if (isLocalMode) {
        try {
          const cachedProducts = await offlineDB.getProducts();
          console.log('Using local products:', cachedProducts.length);
          
          if (!searchTerm) return cachedProducts.slice(0, 10);
          
          const term = searchTerm.toLowerCase();
          const filtered = cachedProducts.filter((p: any) => 
            p.name?.toLowerCase().includes(term) || 
            p.barcode?.toLowerCase() === term ||
            p.barcode?.toLowerCase().includes(term)
          );
          return filtered.slice(0, 10);
        } catch (e) {
          console.error('Failed to get local products:', e);
          return [];
        }
      }
      
      // Online query
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
            barcode,
            stock_quantity
          )
        `)
        .eq('is_available', true)
        .order('name');

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,barcode.eq.${searchTerm}`);
      }

      const { data, error } = await query.limit(10);
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
    staleTime: 0, // Always fetch fresh data to show realtime stock updates
    gcTime: 10 * 60 * 1000, // Keep in memory for 10 minutes
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
      
      // Use IndexedDB for local mode
      if (isLocalMode) {
        try {
          const cachedProducts = await offlineDB.getProducts();
          
          // Find product by barcode
          const matchedProduct = cachedProducts.find((p: any) => {
            if (!p.barcode) return false;
            const productBarcodes = p.barcode.split(',').map((b: string) => b.trim().toLowerCase());
            return productBarcodes.some((b: string) => b === barcode);
          });
          
          if (matchedProduct) {
            const availableVariants = matchedProduct.product_variants?.filter((v: any) => v.is_available) || [];
            if (availableVariants.length > 0) {
              const defaultVariant = availableVariants.find((v: any) => v.is_default) || availableVariants[0];
              onProductSelect({
                ...matchedProduct,
                price: defaultVariant.price,
                selectedVariant: defaultVariant,
              });
            } else {
              onProductSelect(matchedProduct);
            }
            setSearchTerm('');
            return;
          }
          
          // Check variant barcodes
          for (const product of cachedProducts) {
            const matchingVariant = product.product_variants?.find((v: any) => {
              if (!v.barcode || !v.is_available) return false;
              const barcodes = v.barcode.split(',').map((b: string) => b.trim().toLowerCase());
              return barcodes.some((b: string) => b === barcode);
            });
            
            if (matchingVariant) {
              onProductSelect({
                ...product,
                price: matchingVariant.price,
                selectedVariant: matchingVariant,
              });
              setSearchTerm('');
              return;
            }
          }
          
          // Barcode not found
          setScannedBarcode(barcode);
          setAssignBarcodeOpen(true);
          setSearchTerm('');
          return;
        } catch (e) {
          console.error('Failed to search local products:', e);
          return;
        }
      }
      
      // Online mode - Single optimized query with exact barcode match
      const { data: exactProducts, error } = await supabase
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
            barcode,
            stock_quantity
          )
        `)
        .eq('is_available', true)
        .or(`barcode.eq.${barcode},barcode.ilike.%${barcode}%`);
      
      if (error) throw error;
      
      // Quick barcode matching with early exit
      if (exactProducts && exactProducts.length > 0) {
        // Check variants first (most common case)
        for (const product of exactProducts) {
          const matchingVariant = product.product_variants?.find((v: any) => {
            if (!v.barcode || !v.is_available) return false;
            const barcodes = v.barcode.split(',').map((b: string) => b.trim().toLowerCase());
            return barcodes.some((b: string) => b === barcode);
          });
          
          if (matchingVariant) {
            onProductSelect({
              ...product,
              price: matchingVariant.price,
              selectedVariant: matchingVariant,
            });
            setSearchTerm('');
            return;
          }
        }
        
        // Check product-level barcodes
        const matchedProduct = exactProducts.find((p: any) => {
          if (!p.barcode) return false;
          const productBarcodes = p.barcode.split(',').map((b: string) => b.trim().toLowerCase());
          return productBarcodes.some((b: string) => b === barcode);
        });
        
        if (matchedProduct) {
          const availableVariants = matchedProduct.product_variants?.filter((v: any) => v.is_available) || [];
          if (availableVariants.length > 0) {
            const defaultVariant = availableVariants.find((v: any) => v.is_default) || availableVariants[0];
            onProductSelect({
              ...matchedProduct,
              price: defaultVariant.price,
              selectedVariant: defaultVariant,
            });
          } else {
            onProductSelect(matchedProduct);
          }
          setSearchTerm('');
          return;
        }
      }

      // If no product-level match, check if barcode exists in any variant
      const { data: variantProducts, error: variantError } = await supabase
        .from('product_variants')
        .select(`
          id,
          barcode,
          label,
          quantity,
          unit,
          price,
          is_available,
          product_id,
          products (
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
              stock_quantity
            )
          )
        `)
        .eq('is_available', true)
        .not('barcode', 'is', null);

      if (variantError) throw variantError;

      if (variantProducts && variantProducts.length > 0) {
        for (const variant of variantProducts) {
          const barcodes = variant.barcode!.split(',').map((b: string) => b.trim().toLowerCase());
          if (barcodes.some((b: string) => b === barcode)) {
            const product = variant.products as any;
            onProductSelect({
              ...product,
              price: variant.price,
              selectedVariant: variant,
            });
            setSearchTerm('');
            return;
          }
        }
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
                  ? defaultVariant?.stock_quantity || 0
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
});

ProductSearch.displayName = 'ProductSearch';
