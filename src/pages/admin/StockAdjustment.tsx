import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Package, Search, Filter } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ReturnToPOSButton } from '@/components/layout/ReturnToPOSButton';
import { formatCurrency } from '@/lib/utils';
import { ExcelTable, type ExcelColumn } from '@/components/admin/ExcelTable';

export default function StockAdjustment() {
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [stockInputs, setStockInputs] = useState<Record<string, string>>({});
  const [costInputs, setCostInputs] = useState<Record<string, string>>({});
  const [reasonInputs, setReasonInputs] = useState<Record<string, string>>({});
  const [barcodeInputs, setBarcodeInputs] = useState<Record<string, string>>({});
  const [variantInputs, setVariantInputs] = useState<Record<string, string>>({});
  const [categoryInputs, setCategoryInputs] = useState<Record<string, string>>({});
  const [suggestedCosts, setSuggestedCosts] = useState<Record<string, any>>({});
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

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await supabase
        .from('categories')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ['stock-products', selectedStoreId, selectedCategoryId, searchQuery],
    queryFn: async () => {
      if (!selectedStoreId) return [];

      let query = supabase
        .from('products')
        .select(`
          *,
          categories(name),
          product_variants(id, label, stock_quantity, is_available, barcode, cost_price)
        `)
        .eq('store_id', selectedStoreId)
        .eq('is_available', true)
        .order('name')
        .limit(1000);

      if (selectedCategoryId !== 'all') {
        query = query.eq('category_id', selectedCategoryId);
      }

      if (searchQuery.trim()) {
        query = query.or(`name.ilike.%${searchQuery}%,barcode.ilike.%${searchQuery}%`);
      }

      const { data } = await query;
      return data || [];
    },
    enabled: !!selectedStoreId,
  });

  const updateStockMutation = useMutation({
    mutationFn: async ({ productId, variantId, systemStock, currentStock, unitCost, reason, key }: any) => {
      console.log('=== updateStockMutation.mutationFn called ===');
      console.log('Params:', { productId, variantId, systemStock, currentStock, unitCost, reason, key });
      
      const { data: { user } } = await supabase.auth.getUser();
      console.log('User:', user?.id);
      
      const adjustmentQuantity = currentStock - systemStock;
      console.log('Adjustment Quantity:', adjustmentQuantity);
      
      if (adjustmentQuantity === 0) {
        console.log('No adjustment needed');
        return { key };
      }

      if (variantId) {
        console.log('Updating variant stock...');
        const { data, error } = await supabase
          .from('product_variants')
          .update({ stock_quantity: currentStock })
          .eq('id', variantId)
          .select();

        console.log('Variant update result:', { data, error });
        if (error) {
          console.error('Variant update error:', error);
          throw error;
        }
      } else {
        console.log('Updating product stock...');
        const { data, error } = await supabase
          .from('products')
          .update({ stock_quantity: currentStock })
          .eq('id', productId)
          .select();

        console.log('Product update result:', { data, error });
        if (error) {
          console.error('Product update error:', error);
          throw error;
        }
      }

      // Log the adjustment
      console.log('Inserting stock adjustment log...');
      const { data: logData, error: logError } = await supabase
        .from('stock_adjustments')
        .insert({
          product_id: productId,
          variant_id: variantId,
          adjustment_type: 'manual',
          quantity_change: adjustmentQuantity,
          unit_cost: unitCost || 0,
          cost_source: unitCost ? 'manual' : 'system',
          reason: reason || 'Physical stock count adjustment',
          adjusted_by: user?.id,
          store_id: selectedStoreId,
        })
        .select();

      console.log('Stock adjustment log result:', { logData, logError });
      if (logError) {
        console.error('Stock adjustment log error:', logError);
        throw logError;
      }

      console.log('=== Stock update completed successfully ===');
      return { key };
    },
    onSuccess: (data) => {
      console.log('=== updateStockMutation.onSuccess ===');
      console.log('Success data:', data);
      
      if (data?.key) {
        // Clear inputs only after successful save
        setStockInputs(prev => ({ ...prev, [data.key]: '' }));
        setCostInputs(prev => ({ ...prev, [data.key]: '' }));
        setReasonInputs(prev => ({ ...prev, [data.key]: '' }));
      }
      queryClient.invalidateQueries({ queryKey: ['stock-products'] });
      queryClient.invalidateQueries({ queryKey: ['products-stock-price'] });
      toast.success('Stock adjusted successfully');
    },
    onError: (error: any) => {
      console.error('=== updateStockMutation.onError ===');
      console.error('Error:', error);
      toast.error('Failed to adjust stock: ' + error.message);
    },
  });

  const updateBarcodeMutation = useMutation({
    mutationFn: async ({ productId, variantId, newBarcode }: any) => {
      if (variantId) {
        // Update variant barcode
        const { error } = await supabase
          .from('product_variants')
          .update({ barcode: newBarcode || null })
          .eq('id', variantId);

        if (error) throw error;
      } else {
        // Update product barcode
        const { error } = await supabase
          .from('products')
          .update({ barcode: newBarcode || null })
          .eq('id', productId);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-products'] });
      queryClient.invalidateQueries({ queryKey: ['products-stock-price'] });
      toast.success('Barcode updated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to update barcode: ' + error.message);
    },
  });

  const updateVariantMutation = useMutation({
    mutationFn: async ({ variantId, newLabel }: any) => {
      const { error } = await supabase
        .from('product_variants')
        .update({ label: newLabel })
        .eq('id', variantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-products'] });
      queryClient.invalidateQueries({ queryKey: ['products-stock-price'] });
      toast.success('Variant label updated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to update variant: ' + error.message);
    },
  });

  const createVariantMutation = useMutation({
    mutationFn: async ({ productId, label, price }: any) => {
      const { error } = await supabase
        .from('product_variants')
        .insert({
          product_id: productId,
          label: label,
          price: price,
          unit: 'pcs',
          is_default: true,
          is_available: true,
          stock_quantity: 0,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-products'] });
      queryClient.invalidateQueries({ queryKey: ['products-stock-price'] });
      toast.success('Variant created successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to create variant: ' + error.message);
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ productId, categoryId }: any) => {
      const { error } = await supabase
        .from('products')
        .update({ category_id: categoryId || null })
        .eq('id', productId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-products'] });
      queryClient.invalidateQueries({ queryKey: ['products-stock-price'] });
      toast.success('Category updated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to update category: ' + error.message);
    },
  });

  const fetchSuggestedCost = async (productId: string, variantId?: string) => {
    const key = variantId ? `variant-${variantId}` : `product-${productId}`;
    
    try {
      const { data, error } = await supabase
        .rpc('get_suggested_adjustment_cost', {
          p_product_id: productId,
          p_variant_id: variantId || null,
        });

      if (error) throw error;
      
      if (data && data.length > 0) {
        setSuggestedCosts(prev => ({ ...prev, [key]: data[0] }));
      }
    } catch (error) {
      console.error('Error fetching suggested cost:', error);
    }
  };

  const handleStockUpdate = (key: string, systemStock: number, productId: string, variantId?: string) => {
    console.log('=== handleStockUpdate called ===');
    console.log('Key:', key);
    console.log('System Stock:', systemStock);
    console.log('Product ID:', productId);
    console.log('Variant ID:', variantId);
    
    const inputValue = stockInputs[key];
    console.log('Input Value:', inputValue);
    
    if (!inputValue || inputValue === '') {
      console.log('No input value, returning');
      return;
    }

    const currentStock = parseInt(inputValue);
    console.log('Parsed Current Stock:', currentStock);
    
    if (isNaN(currentStock) || currentStock < 0) {
      console.log('Invalid quantity');
      toast.error('Please enter a valid quantity');
      return;
    }

    if (currentStock === systemStock) {
      console.log('No change in stock, returning');
      return;
    }

    const difference = currentStock - systemStock;
    const unitCost = parseFloat(costInputs[key] || '0');
    const reason = reasonInputs[key] || 'count';
    
    console.log('Difference:', difference);
    console.log('Unit Cost:', unitCost);
    console.log('Reason:', reason);

    // Only require cost for stock increases if a cost was provided
    // For physical count adjustments, cost is optional
    if (difference > 0 && costInputs[key] && unitCost <= 0) {
      console.log('Invalid cost input');
      toast.error('Please enter a valid unit cost or leave it empty');
      return;
    }

    console.log('Calling mutation with:', {
      productId,
      variantId,
      systemStock,
      currentStock,
      unitCost,
      reason,
      key,
    });

    updateStockMutation.mutate({
      productId,
      variantId,
      systemStock,
      currentStock,
      unitCost,
      reason,
      key,
    });
  };

  const handleBarcodeUpdate = (key: string, originalBarcode: string, productId: string, variantId?: string) => {
    const inputValue = barcodeInputs[key];
    if (inputValue === undefined) return; // Not edited
    
    const newBarcode = inputValue.trim();
    if (newBarcode === originalBarcode) {
      // No change
      return;
    }

    updateBarcodeMutation.mutate({
      productId,
      variantId,
      newBarcode,
    });
  };

  const handleVariantUpdate = (key: string, originalLabel: string, variantId: string) => {
    const inputValue = variantInputs[key];
    if (inputValue === undefined) return; // Not edited
    
    const newLabel = inputValue.trim();
    if (!newLabel) {
      toast.error('Variant label cannot be empty');
      return;
    }
    
    if (newLabel === originalLabel) {
      // No change
      return;
    }

    updateVariantMutation.mutate({
      variantId,
      newLabel,
    });
  };

  const handleVariantCreate = (key: string, productId: string, productPrice: number) => {
    const inputValue = variantInputs[key];
    if (inputValue === undefined || inputValue.trim() === '') return; // Not edited or empty
    
    const label = inputValue.trim();
    if (!label) {
      return;
    }

    createVariantMutation.mutate({
      productId,
      label,
      price: productPrice,
    });
  };

  const handleCategoryUpdate = (productId: string, originalCategoryId: string | null, newCategoryId: string) => {
    if (newCategoryId === originalCategoryId) {
      // No change
      return;
    }

    updateCategoryMutation.mutate({
      productId,
      categoryId: newCategoryId === 'none' ? null : newCategoryId,
    });
  };

  // Products are already filtered by the query, no need to filter again
  const filteredProducts = products || [];

  const calculateDifference = (key: string, systemStock: number) => {
    const inputValue = stockInputs[key];
    if (!inputValue || inputValue === '') return null;
    const currentStock = parseInt(inputValue);
    if (isNaN(currentStock)) return null;
    return currentStock - systemStock;
  };

  const handleBarcodeScanned = (barcode: string) => {
    if (!barcode.trim() || !filteredProducts) return;
    
    // Find product by barcode
    const product = filteredProducts.find((p) => {
      // Check main product barcode
      if (p.barcode === barcode) return true;
      // Check variant barcodes
      if (p.product_variants?.some((v: any) => v.barcode === barcode)) return true;
      return false;
    });

    if (product) {
      // Check if it's a variant match
      const variant = product.product_variants?.find((v: any) => v.barcode === barcode);
      const key = variant ? `variant-${variant.id}` : `product-${product.id}`;
      
      // Focus on the input field
      setTimeout(() => {
        const input = document.querySelector(`input[data-key="${key}"]`) as HTMLInputElement;
        if (input) {
          input.focus();
          input.select();
        }
      }, 100);
      
      toast.success(`Found: ${product.name}${variant ? ` (${variant.label})` : ''}`);
    } else {
      toast.error('Product not found with barcode: ' + barcode);
    }
    
    setBarcodeInput('');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Stock Adjustment</h1>
          <p className="text-muted-foreground">View and adjust inventory after physical verification</p>
        </div>
        <ReturnToPOSButton hideDashboard />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search Products</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name or barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="store">Store *</Label>
              <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                <SelectTrigger>
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

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories?.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      {!selectedStoreId ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Please select a store to view products</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Loading products...</p>
          </CardContent>
        </Card>
      ) : filteredProducts && filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-2">
              {selectedCategoryId === 'all' && !searchQuery.trim() 
                ? 'Please select a category or search for products to begin'
                : 'No products found matching your filters'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="text-sm text-muted-foreground mb-2">Products ({filteredProducts?.length || 0})</div>
          {(() => {
            type Row = {
              id: string;
              key: string;
              product: any;
              variant: any | null;
              isFirstOfProduct: boolean;
              systemStock: number;
            };
            const rows: Row[] = [];
            (filteredProducts || []).forEach((product: any) => {
              const hasVariants = product.product_variants && product.product_variants.length > 0;
              if (!hasVariants) {
                rows.push({
                  id: product.id,
                  key: `product-${product.id}`,
                  product, variant: null, isFirstOfProduct: true,
                  systemStock: product.stock_quantity || 0,
                });
              } else {
                product.product_variants.forEach((v: any, idx: number) => {
                  rows.push({
                    id: `${product.id}-${v.id}`,
                    key: `variant-${v.id}`,
                    product, variant: v, isFirstOfProduct: idx === 0,
                    systemStock: v.stock_quantity || 0,
                  });
                });
              }
            });

            const stockClass = (s: number) =>
              s < 0 ? 'text-red-600' : s > 0 ? 'text-green-600' : 'text-muted-foreground';

            const columns: ExcelColumn<Row>[] = [
              { key: 'name', label: 'Product Name', width: 220, render: r => (
                <span className="font-medium truncate" title={r.product.name}>
                  {r.isFirstOfProduct ? r.product.name : ''}
                </span>
              ) },
              { key: 'category', label: 'Category', width: 160, render: r => r.isFirstOfProduct ? (
                <Select
                  value={categoryInputs[r.product.id] || r.product.category_id || 'none'}
                  onValueChange={(value) => {
                    setCategoryInputs({ ...categoryInputs, [r.product.id]: value });
                    handleCategoryUpdate(r.product.id, r.product.category_id, value);
                  }}
                >
                  <SelectTrigger className="w-full h-6 border-0 focus:ring-0 bg-transparent text-xs px-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Category</SelectItem>
                    {categories?.map((category) => (
                      <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null },
              { key: 'barcode', label: 'Barcode', width: 140, render: r => {
                const bcKey = r.variant ? r.key : `product-${r.product.id}`;
                const original = r.variant ? (r.variant.barcode || '') : (r.product.barcode || '');
                return (
                  <Input
                    type="text"
                    value={barcodeInputs[bcKey] !== undefined ? barcodeInputs[bcKey] : original}
                    onChange={(e) => setBarcodeInputs({ ...barcodeInputs, [bcKey]: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleBarcodeUpdate(bcKey, original, r.product.id, r.variant?.id); }}
                    onBlur={() => handleBarcodeUpdate(bcKey, original, r.product.id, r.variant?.id)}
                    className="w-full h-6 px-1 text-xs border-0 focus-visible:ring-1 bg-transparent"
                  />
                );
              } },
              { key: 'variant', label: 'Variant', width: 140, render: r => {
                if (r.variant) {
                  return (
                    <Input
                      type="text"
                      value={variantInputs[r.key] !== undefined ? variantInputs[r.key] : r.variant.label}
                      onChange={(e) => setVariantInputs({ ...variantInputs, [r.key]: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleVariantUpdate(r.key, r.variant.label, r.variant.id); }}
                      onBlur={() => handleVariantUpdate(r.key, r.variant.label, r.variant.id)}
                      className="w-full h-6 px-1 text-xs border-0 focus-visible:ring-1 bg-transparent"
                    />
                  );
                }
                return (
                  <Input
                    type="text" placeholder="Add variant"
                    value={variantInputs[r.key] || ''}
                    onChange={(e) => setVariantInputs({ ...variantInputs, [r.key]: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleVariantCreate(r.key, r.product.id, r.product.price || 0); }}
                    onBlur={() => handleVariantCreate(r.key, r.product.id, r.product.price || 0)}
                    className="w-full h-6 px-1 text-xs border-0 focus-visible:ring-1 bg-transparent"
                  />
                );
              } },
              { key: 'sysstock', label: 'System Stock', width: 90, align: 'right', render: r => (
                <span className={`font-semibold ${stockClass(r.systemStock)}`}>
                  {r.systemStock < 0 ? '-' : ''}{Math.abs(r.systemStock)}
                </span>
              ) },
              { key: 'curstock', label: 'Current Stock', width: 100, align: 'right', render: r => (
                <Input
                  type="number" min="0"
                  value={stockInputs[r.key] || ''}
                  data-key={r.key}
                  onChange={(e) => setStockInputs({ ...stockInputs, [r.key]: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleStockUpdate(r.key, r.systemStock, r.product.id, r.variant?.id); }}
                  onBlur={() => handleStockUpdate(r.key, r.systemStock, r.product.id, r.variant?.id)}
                  className="w-full h-6 px-1 text-xs text-right border-0 focus-visible:ring-1 bg-transparent"
                />
              ) },
              { key: 'diff', label: 'Difference', width: 90, align: 'right', render: r => {
                const d = calculateDifference(r.key, r.systemStock);
                const cls = d === null ? '' : d > 0 ? 'text-green-600' : d < 0 ? 'text-red-600' : 'text-muted-foreground';
                return <span className={`font-semibold ${cls}`}>{d !== null ? (d > 0 ? `+${d}` : d) : '-'}</span>;
              } },
              { key: 'costprice', label: 'Cost Price', width: 100, align: 'right', render: r => {
                const c = r.variant?.cost_price ?? r.product.cost_price;
                return <span className="text-muted-foreground">{c ? formatCurrency(c) : '-'}</span>;
              } },
              { key: 'unitcost', label: 'Unit Cost', width: 110, align: 'right', render: r => {
                const suggested = suggestedCosts[r.key];
                const d = calculateDifference(r.key, r.systemStock);
                return (
                  <Input
                    type="number" step="0.01" min="0"
                    placeholder={suggested?.weighted_avg_cost?.toFixed(2) || '0.00'}
                    value={costInputs[r.key] || ''}
                    onChange={(e) => setCostInputs({ ...costInputs, [r.key]: e.target.value })}
                    onFocus={() => !suggested && fetchSuggestedCost(r.product.id, r.variant?.id)}
                    className="w-full h-6 px-1 text-xs text-right border-0 focus-visible:ring-1 bg-transparent"
                    disabled={d !== null && d <= 0}
                  />
                );
              } },
              { key: 'reason', label: 'Reason', width: 130, render: r => (
                <Select
                  value={reasonInputs[r.key] || 'count'}
                  onValueChange={(value) => setReasonInputs({ ...reasonInputs, [r.key]: value })}
                >
                  <SelectTrigger className="w-full h-6 border-0 focus:ring-0 bg-transparent text-xs px-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="count">Physical Count</SelectItem>
                    <SelectItem value="damage">Damage</SelectItem>
                    <SelectItem value="loss">Loss/Theft</SelectItem>
                    <SelectItem value="found">Found</SelectItem>
                    <SelectItem value="correction">Correction</SelectItem>
                    <SelectItem value="return">Return</SelectItem>
                  </SelectContent>
                </Select>
              ) },
            ];

            return (
              <ExcelTable
                storageKey="stock_adjustment_cols_v1"
                columns={columns}
                rows={rows}
                getRowId={r => r.id}
                loading={isLoading}
                empty="No products found matching your filters"
              />
            );
          })()}
        </>
      )}
    </div>
  );
}
