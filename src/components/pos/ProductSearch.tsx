import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { VariantSelector } from './VariantSelector';
import { AssignBarcodeDialog } from './AssignBarcodeDialog';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

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
    console.log('📋 handleProductSelect called', { 
      productName: product.name, 
      fromClick, 
      hasMatchingVariant: !!product._matchingVariant,
      variantCount: product.product_variants?.length 
    });
    
    const availableVariants = product.product_variants?.filter((v: any) => v.is_available) || [];
    
    // Check if a specific variant matched the barcode search
    const matchingVariant = product._matchingVariant;
    
    // If a specific variant matched the search (barcode match), auto-select it
    if (matchingVariant) {
      console.log('✅ Auto-selecting matching variant from search');
      onProductSelect({
        ...product,
        price: matchingVariant.price,
        selectedVariant: matchingVariant,
      });
      setSearchTerm('');
      return;
    }
    
    // If clicked manually and has multiple variants, show selector
    if (fromClick && availableVariants.length > 1) {
      console.log('🎯 Opening variant selector (clicked with multiple variants)');
      setSelectedProduct(product);
      setVariantSelectorOpen(true);
    } else if (availableVariants.length > 0) {
      // Auto-select default variant or first variant (for scanned barcodes)
      const defaultVariant = availableVariants.find((v: any) => v.is_default) || availableVariants[0];
      onProductSelect({
        ...product,
        price: defaultVariant.price,
        selectedVariant: defaultVariant,
      });
      // Clear search
      setSearchTerm('');
    } else {
      // No variants, use product price
      onProductSelect(product);
      // Clear search
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
      
      // Otherwise, treat as barcode scan
      const barcode = searchTerm.trim().toLowerCase();
      
      console.log('🔍 Scanning barcode:', barcode);
      
      // Step 1: Check variant barcodes first
      const { data: allVariants } = await supabase
        .from('product_variants')
        .select(`
          id,
          label,
          quantity,
          unit,
          price,
          barcode,
          product:products!inner (
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
          )
        `)
        .eq('is_available', true)
        .eq('products.is_available', true)
        .not('barcode', 'is', null)
        .limit(100);
      
      // Find matching variant
      const matchedVariant = allVariants?.find((v: any) => {
        if (!v.barcode) return false;
        const barcodes = v.barcode.split(',').map((b: string) => b.trim().toLowerCase());
        return barcodes.includes(barcode);
      });
      
      if (matchedVariant?.product) {
        console.log('✅ Found variant match:', matchedVariant.label);
        onProductSelect({
          ...matchedVariant.product,
          price: matchedVariant.price,
          selectedVariant: matchedVariant,
        });
        setSearchTerm('');
        return;
      }
      
      // Step 2: Check main product barcodes
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
        .not('barcode', 'is', null)
        .limit(100);

      // Find direct product barcode match
      const matchedDirectProduct = directProducts?.find((p: any) => {
        if (!p.barcode) return false;
        const productBarcodes = p.barcode.split(',').map((b: string) => b.trim().toLowerCase());
        return productBarcodes.includes(barcode);
      });

      if (matchedDirectProduct) {
        console.log('✅ Found main product match:', matchedDirectProduct.name);
        
        // If product has variants, select default or first available
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

      // Step 3: No match found - open assign dialog
      console.log('❌ No barcode match found - opening assign dialog');
      toast.error(`No product found with barcode: ${barcode}`);
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
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          placeholder="Search by name or scan barcode..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          className="pl-10"
        />
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground text-center py-4">Searching...</p>
      )}

      {products && products.length > 0 && (
        <Card className="max-h-[400px] overflow-hidden">
          <div className="overflow-y-auto max-h-[400px]">
            <div className="min-w-full">
              {/* Header Row */}
              <div className="grid grid-cols-[120px_1fr_100px_80px] gap-2 px-3 py-2 bg-muted/50 border-b sticky top-0 z-10">
                <div className="font-semibold text-xs">Barcode</div>
                <div className="font-semibold text-xs">Product Name</div>
                <div className="font-semibold text-xs text-right">Price</div>
                <div className="font-semibold text-xs text-right">Stock</div>
              </div>
              
              {/* Data Rows */}
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
                    className={`grid grid-cols-[120px_1fr_100px_80px] gap-2 px-3 py-2 cursor-pointer transition-none border-b last:border-b-0 ${
                      isHighlighted 
                        ? 'bg-primary/10 border-l-2 border-l-primary' 
                        : 'hover:bg-accent'
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

      {searchTerm && products && products.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No products found</p>
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
