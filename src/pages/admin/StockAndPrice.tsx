import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { MinimizableDialog } from '@/components/ui/minimizable-dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, Grid, List, Pencil, Save, X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { ReturnToPOSButton } from '@/components/layout/ReturnToPOSButton';
import { toast } from 'sonner';
import { offlineDB } from '@/lib/offlineDB';
import { shouldUseLocalData } from '@/lib/localModeHelper';
import { BulkSellPriceUpdateDialog } from '@/components/admin/BulkSellPriceUpdateDialog';
import { ExcelTable, type ExcelColumn } from '@/components/admin/ExcelTable';
import { usePriceMasking } from '@/hooks/usePriceMasking';
import { computeMaskedPrice } from '@/lib/priceMasking';

type EditedPrices = {
  [key: string]: {
    costPrice: number | null;
    retailPrice: number | null;
    wholesalePrice: number | null;
    vipPrice: number | null;
    isVariant: boolean;
  };
};

export default function StockAndPrice() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'zero' | 'positive' | 'negative'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const { showMasked } = usePriceMasking();
  /** Return the masked sell price when a POS session is active and F12 is not held. */
  const maskSell = (real: number | null | undefined, product: any, variant?: any): number | null => {
    if (real == null) return null;
    if (!showMasked) return Number(real);
    const masked = computeMaskedPrice(
      {
        price: Number(real),
        cost_price: variant?.cost_price ?? product?.cost_price,
        local_charges: product?.local_charges,
      },
      { local_charges: product?.local_charges, price: Number(real) },
    );
    return masked || Number(real);
  };
  
  // Bulk edit mode state
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [editedPrices, setEditedPrices] = useState<EditedPrices>({});
  
  // Edit prices dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [bulkSellOpen, setBulkSellOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    id: string;
    name: string;
    variantId?: string;
    variantLabel?: string;
    costPrice: number | null;
    wholesalePrice: number | null;
    vipPrice: number | null;
  } | null>(null);
  
  const queryClient = useQueryClient();

  // Fetch products with variants, category and store info
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['products-stock-price'],
    queryFn: async () => {
      const loadCachedProducts = async () => {
        const [cachedProducts, cachedVariants, cachedCategories, cachedStores] = await Promise.all([
          offlineDB.getProducts().catch(() => []),
          offlineDB.getProductVariants().catch(() => []),
          offlineDB.getCategories().catch(() => []),
          offlineDB.getStores().catch(() => []),
        ]);
        const categoriesById = new Map<string, any>(cachedCategories.map((c: any) => [c.id, c] as [string, any]));
        const storesById = new Map<string, any>(cachedStores.map((s: any) => [s.id, s] as [string, any]));
        const variantsByProduct = new Map<string, any[]>();
        cachedVariants.forEach((variant: any) => {
          const list = variantsByProduct.get(variant.product_id) || [];
          list.push({ ...variant, is_available: variant.is_available === true || variant.is_available === 1 });
          variantsByProduct.set(variant.product_id, list);
        });
        return cachedProducts
          .filter((product: any) => product.is_available === true || product.is_available === 1)
          .map((product: any) => ({
            ...product,
            categories: categoriesById.get(product.category_id) ? { name: categoriesById.get(product.category_id).name } : null,
            stores: storesById.get(product.store_id) ? { name: storesById.get(product.store_id).name } : null,
            product_variants: variantsByProduct.get(product.id) || product.product_variants || [],
          }))
          .sort((a: any, b: any) => a.name.localeCompare(b.name));
      };

      if (shouldUseLocalData()) return loadCachedProducts();

      try {
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name), stores(name), product_variants(*)')
        .eq('is_available', true)
        .order('name');
      if (error) throw error;
      if (data) {
        await Promise.all([
          offlineDB.saveProducts(data as any),
          offlineDB.saveProductVariants(data.flatMap((product: any) => product.product_variants || [])),
        ]).catch(() => undefined);
      }
      return data;
      } catch (error) {
        console.warn('[stock-price] online products failed, using cached data', error);
        return loadCachedProducts();
      }
    },
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      if (shouldUseLocalData()) return offlineDB.getCategories();
      try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      if (data) await offlineDB.saveCategories(data);
      return data;
      } catch (error) {
        console.warn('[stock-price] online categories failed, using cached data', error);
        return offlineDB.getCategories();
      }
    },
  });

  const filteredProducts = products?.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.barcode?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.category_id === selectedCategory;
    
    // For products with variants, check if ANY variant matches the stock filter
    // For products without variants, check the product's stock
    let matchesStock = false;
    
    if (stockFilter === 'all') {
      matchesStock = true;
    } else if (product.product_variants && product.product_variants.length > 0) {
      // Check variants
      matchesStock = product.product_variants.some((variant: any) => {
        const stock = variant.stock_quantity ?? 0;
        return (
          (stockFilter === 'zero' && stock === 0) ||
          (stockFilter === 'positive' && stock > 0) ||
          (stockFilter === 'negative' && stock < 0)
        );
      });
    } else {
      // Check product stock
      const stock = product.stock_quantity ?? 0;
      matchesStock = 
        (stockFilter === 'zero' && stock === 0) ||
        (stockFilter === 'positive' && stock > 0) ||
        (stockFilter === 'negative' && stock < 0);
    }
    
    return matchesSearch && matchesCategory && matchesStock;
  });

  // Helper function to check if a stock value matches the filter
  const stockMatchesFilter = (stock: number) => {
    if (stockFilter === 'all') return true;
    if (stockFilter === 'zero') return stock === 0;
    if (stockFilter === 'positive') return stock > 0;
    if (stockFilter === 'negative') return stock < 0;
    return true;
  };

  const calculateMargin = (price: number, cost?: number) => {
    if (!cost || cost === 0) return null;
    return ((price - cost) / price * 100).toFixed(1);
  };

  // Mutation for updating prices
  const updatePricesMutation = useMutation({
    mutationFn: async (data: {
      productId: string;
      variantId?: string;
      costPrice: number | null;
      wholesalePrice: number | null;
      vipPrice: number | null;
    }) => {
      if (data.variantId) {
        const { error } = await supabase
          .from('product_variants')
          .update({
            cost_price: data.costPrice,
            wholesale_price: data.wholesalePrice,
            vip_price: data.vipPrice,
          })
          .eq('id', data.variantId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('products')
          .update({
            cost_price: data.costPrice,
            wholesale_price: data.wholesalePrice,
            vip_price: data.vipPrice,
          })
          .eq('id', data.productId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products-stock-price'] });
      toast.success('Prices updated successfully');
      setEditDialogOpen(false);
      setEditingItem(null);
    },
    onError: (error) => {
      toast.error('Failed to update prices: ' + error.message);
    },
  });

  const handleEditPrices = (
    productId: string,
    productName: string,
    costPrice: number | null,
    wholesalePrice: number | null,
    vipPrice: number | null,
    variantId?: string,
    variantLabel?: string
  ) => {
    setEditingItem({
      id: productId,
      name: productName,
      variantId,
      variantLabel,
      costPrice,
      wholesalePrice,
      vipPrice,
    });
    setEditDialogOpen(true);
  };

  const handleSavePrices = () => {
    if (!editingItem) return;
    updatePricesMutation.mutate({
      productId: editingItem.id,
      variantId: editingItem.variantId,
      costPrice: editingItem.costPrice,
      wholesalePrice: editingItem.wholesalePrice,
      vipPrice: editingItem.vipPrice,
    });
  };

  // Bulk save mutation
  const bulkSaveMutation = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(editedPrices);
      for (const [key, prices] of updates) {
        if (prices.isVariant) {
          const { error } = await supabase
            .from('product_variants')
            .update({
              cost_price: prices.costPrice,
              price: prices.retailPrice,
              wholesale_price: prices.wholesalePrice,
              vip_price: prices.vipPrice,
            })
            .eq('id', key);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('products')
            .update({
              cost_price: prices.costPrice,
              price: prices.retailPrice,
              wholesale_price: prices.wholesalePrice,
              vip_price: prices.vipPrice,
            })
            .eq('id', key);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products-stock-price'] });
      toast.success('All prices saved successfully');
      setBulkEditMode(false);
      setEditedPrices({});
    },
    onError: (error) => {
      toast.error('Failed to save prices: ' + error.message);
    },
  });

  const handleBulkPriceChange = (
    id: string,
    field: 'costPrice' | 'retailPrice' | 'wholesalePrice' | 'vipPrice',
    value: string,
    isVariant: boolean,
    currentPrices: { costPrice: number | null; retailPrice: number | null; wholesalePrice: number | null; vipPrice: number | null }
  ) => {
    setEditedPrices(prev => ({
      ...prev,
      [id]: {
        ...currentPrices,
        ...(prev[id] || {}),
        [field]: value ? parseFloat(value) : null,
        isVariant,
      },
    }));
  };

  const getEditedPrice = (id: string, field: 'costPrice' | 'retailPrice' | 'wholesalePrice' | 'vipPrice', originalValue: number | null) => {
    if (editedPrices[id] && editedPrices[id][field] !== undefined) {
      return editedPrices[id][field];
    }
    return originalValue;
  };

  const cancelBulkEdit = () => {
    setBulkEditMode(false);
    setEditedPrices({});
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stock & Price List</h1>
          <p className="text-muted-foreground">
            View all product details, stock levels, and pricing
          </p>
        </div>
        <div className="flex items-center gap-2">
          {bulkEditMode ? (
            <>
              <Button
                variant="outline"
                onClick={cancelBulkEdit}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={() => bulkSaveMutation.mutate()}
                disabled={bulkSaveMutation.isPending || Object.keys(editedPrices).length === 0}
              >
                <Save className="h-4 w-4 mr-2" />
                {bulkSaveMutation.isPending ? 'Saving...' : 'Save All'}
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={() => setBulkEditMode(true)}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit All Prices
            </Button>
          )}
          <Button variant="outline" onClick={() => setBulkSellOpen(true)}>
            Bulk Sell Price Update
          </Button>
          <ReturnToPOSButton inline hideDashboard />
        </div>
      </div>

      <BulkSellPriceUpdateDialog open={bulkSellOpen} onOpenChange={setBulkSellOpen} />

      {/* Filters and View Toggle */}
      <Card className="p-4">
        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by product name or barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Categories" />
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
          <Select value={stockFilter} onValueChange={(value: 'all' | 'zero' | 'positive' | 'negative') => setStockFilter(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Stock Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stock</SelectItem>
              <SelectItem value="zero">Zero Stock</SelectItem>
              <SelectItem value="positive">In Stock</SelectItem>
              <SelectItem value="negative">Negative Stock</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex border rounded-lg">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-r-none"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-l-none"
            >
              <Grid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Products Display */}
      {viewMode === 'list' ? (
        (() => {
          type Row = {
            id: string;
            product: any;
            variant: any | null;
            name: string;
            barcode: string;
            category: string;
            store: string;
            stock: number;
            costTotal: number;
            retail: number | null;
            wholesale: number | null;
            vip: number | null;
            available: boolean;
          };
          const rows: Row[] = [];
          (filteredProducts || []).forEach((product: any) => {
            const lc = Number(product.local_charges) || 0;
            if (product.product_variants && product.product_variants.length > 0) {
              product.product_variants
                .filter((v: any) => stockMatchesFilter(v.stock_quantity ?? 0))
                .forEach((v: any) => {
                  const base = Number(v.cost_price ?? product.cost_price ?? 0);
                  rows.push({
                    id: `${product.id}-${v.id}`,
                    product, variant: v,
                    name: `${product.name} (${v.label})`,
                    barcode: v.barcode || product.barcode || '-',
                    category: product.categories?.name || '-',
                    store: product.stores?.name || '-',
                    stock: v.stock_quantity ?? 0,
                    costTotal: base + lc,
                    retail: v.price ?? product.price ?? null,
                    wholesale: v.wholesale_price ?? product.wholesale_price ?? null,
                    vip: v.vip_price ?? product.vip_price ?? null,
                    available: !!product.is_available,
                  });
                });
            } else {
              const base = Number(product.cost_price ?? 0);
              rows.push({
                id: product.id,
                product, variant: null,
                name: product.name,
                barcode: product.barcode || '-',
                category: product.categories?.name || '-',
                store: product.stores?.name || '-',
                stock: product.stock_quantity ?? 0,
                costTotal: base + lc,
                retail: product.price ?? null,
                wholesale: product.wholesale_price ?? null,
                vip: product.vip_price ?? null,
                available: !!product.is_available,
              });
            }
          });

          const stockCell = (s: number) => {
            const cls = s < 0 ? 'text-red-600' : s > 0 ? 'text-green-600' : 'text-muted-foreground';
            return <span className={`font-semibold ${cls}`}>{s < 0 ? '-' : ''}{Math.abs(s)}</span>;
          };

          const priceInput = (
            row: Row,
            field: 'costPrice' | 'retailPrice' | 'wholesalePrice' | 'vipPrice',
            current: number | null,
          ) => {
            const id = row.variant ? row.variant.id : row.product.id;
            const isVariant = !!row.variant;
            const v = row.variant;
            const p = row.product;
            const currentPrices = {
              costPrice: v?.cost_price ?? p.cost_price,
              retailPrice: v?.price ?? p.price,
              wholesalePrice: v?.wholesale_price ?? p.wholesale_price,
              vipPrice: v?.vip_price ?? p.vip_price,
            };
            return (
              <Input
                type="number" step="0.01"
                className="w-full h-6 text-right text-xs px-1"
                value={getEditedPrice(id, field, current) ?? ''}
                onChange={(e) => handleBulkPriceChange(id, field, e.target.value, isVariant, currentPrices)}
                onClick={(e) => e.stopPropagation()}
              />
            );
          };

          const columns: ExcelColumn<Row>[] = [
            { key: 'name', label: 'Product', width: 240, render: r => <span className="font-medium truncate" title={r.name}>{r.name}</span> },
            { key: 'barcode', label: 'Barcode', width: 130, render: r => <span className="text-muted-foreground">{r.barcode}</span> },
            { key: 'category', label: 'Category', width: 130, render: r => <span className="text-muted-foreground">{r.category}</span> },
            { key: 'store', label: 'Store', width: 110, render: r => <span className="text-muted-foreground">{r.store}</span> },
            { key: 'stock', label: 'Stock', width: 70, align: 'right', render: r => stockCell(r.stock) },
            { key: 'cost', label: 'Cost', width: 100, align: 'right', render: r => bulkEditMode
              ? priceInput(r, 'costPrice', (r.variant?.cost_price ?? r.product.cost_price) ?? null)
              : <>{r.costTotal ? formatCurrency(r.costTotal) : '-'}</> },
            { key: 'retail', label: 'Retail', width: 110, align: 'right', render: r => bulkEditMode
              ? priceInput(r, 'retailPrice', r.retail)
              : (() => { const d = maskSell(r.retail, r.product, r.variant); return <span className="font-medium">{d != null ? formatCurrency(d) : '-'}</span>; })() },
            { key: 'wholesale', label: 'Wholesale', width: 110, align: 'right', render: r => bulkEditMode
              ? priceInput(r, 'wholesalePrice', r.wholesale)
              : (() => { const d = maskSell(r.wholesale, r.product, r.variant); return <span className="text-blue-600">{d != null ? formatCurrency(d) : '-'}</span>; })() },
            { key: 'vip', label: 'VIP', width: 110, align: 'right', render: r => bulkEditMode
              ? priceInput(r, 'vipPrice', r.vip)
              : (() => { const d = maskSell(r.vip, r.product, r.variant); return <span className="text-purple-600">{d != null ? formatCurrency(d) : '-'}</span>; })() },
            { key: 'margin', label: 'Margin %', width: 90, align: 'right', render: r => {
              const rp = maskSell(r.retail, r.product, r.variant);
              if (!rp || !r.costTotal) return '-';
              const m = calculateMargin(rp, r.costTotal);
              return m != null ? <Badge variant="outline" className="text-[10px] h-5">{m}%</Badge> : '-';
            } },
            { key: 'status', label: 'Status', width: 90, render: r => (
              <span className={r.available ? 'text-emerald-600 font-semibold' : 'text-muted-foreground'}>
                {r.available ? 'Yes' : 'No'}
              </span>
            ) },
            { key: 'actions', label: 'Edit', width: 60, align: 'center', render: r => !bulkEditMode && (
              <button
                className="inline-flex items-center justify-center h-6 w-6 hover:text-primary"
                onClick={(e) => { e.stopPropagation(); handleEditPrices(
                  r.product.id, r.product.name,
                  r.variant?.cost_price ?? r.product.cost_price,
                  r.variant?.wholesale_price ?? r.product.wholesale_price,
                  r.variant?.vip_price ?? r.product.vip_price,
                  r.variant?.id, r.variant?.label
                ); }}
                title="Edit prices">
                <Pencil className="h-3 w-3" />
              </button>
            ) },
          ];

          return (
            <ExcelTable
              storageKey="stock_price_table_cols_v1"
              columns={columns}
              rows={rows}
              getRowId={r => r.id}
              loading={!!productsLoading}
              empty="No products found"
            />
          );
        })()
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {productsLoading ? (
            <div className="col-span-full text-center py-8">Loading products...</div>
          ) : filteredProducts?.length === 0 ? (
            <div className="col-span-full text-center py-8">No products found</div>
          ) : (
            filteredProducts?.map((product) => (
              <Card key={product.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{product.name}</CardTitle>
                  <CardDescription>
                    {product.categories?.name || 'Uncategorized'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Barcode:</span>
                    <span className="font-medium">{product.barcode || '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Stock:</span>
                    {(() => {
                      const stock = product.stock_quantity ?? 0;
                      const isNegative = stock < 0;
                      const isPositive = stock > 0;
                      return (
                        <span 
                          className={`font-semibold ${
                            isNegative 
                              ? 'text-red-600' 
                              : isPositive 
                              ? 'text-green-600' 
                              : 'text-muted-foreground'
                          }`}
                        >
                          {isNegative ? '-' : ''}{Math.abs(stock)}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cost:</span>
                    <span>{(() => {
                      const total = (Number(product.cost_price) || 0) + (Number(product.local_charges) || 0);
                      return total ? formatCurrency(total) : '-';
                    })()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Retail:</span>
                    <span className="font-semibold">
                      {product.price ? formatCurrency(product.price) : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Wholesale:</span>
                    <span className="text-blue-600">
                      {product.wholesale_price ? formatCurrency(product.wholesale_price) : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">VIP:</span>
                    <span className="text-purple-600">
                      {product.vip_price ? formatCurrency(product.vip_price) : '-'}
                    </span>
                  </div>
                  {(() => {
                    const cost = (Number(product.cost_price) || 0) + (Number(product.local_charges) || 0);
                    return product.price && cost ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Margin:</span>
                      <Badge variant="outline">
                        {calculateMargin(product.price, cost)}%
                      </Badge>
                    </div>
                    ) : null;
                  })()}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant={product.is_available ? 'default' : 'secondary'}>
                      {product.is_available ? 'Available' : 'Unavailable'}
                    </Badge>
                  </div>
                  {product.stores?.name && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Store:</span>
                      <span className="text-xs">{product.stores.name}</span>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => handleEditPrices(
                      product.id,
                      product.name,
                      product.cost_price,
                      product.wholesale_price,
                      product.vip_price
                    )}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Prices
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {filteredProducts && filteredProducts.length > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          Showing {filteredProducts.length} of {products?.length || 0} products
        </div>
      )}

      {/* Edit Prices Dialog */}
      <MinimizableDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        title={`Edit Prices - ${editingItem?.name ?? ''}${editingItem?.variantLabel ? ` (${editingItem.variantLabel})` : ''}`}
      >
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="costPrice">Cost Price</Label>
              <Input
                id="costPrice"
                type="number"
                step="0.01"
                value={editingItem?.costPrice ?? ''}
                onChange={(e) => setEditingItem(prev => 
                  prev ? { ...prev, costPrice: e.target.value ? parseFloat(e.target.value) : null } : null
                )}
                placeholder="Enter cost price"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wholesalePrice">Wholesale Price</Label>
              <Input
                id="wholesalePrice"
                type="number"
                step="0.01"
                value={editingItem?.wholesalePrice ?? ''}
                onChange={(e) => setEditingItem(prev => 
                  prev ? { ...prev, wholesalePrice: e.target.value ? parseFloat(e.target.value) : null } : null
                )}
                placeholder="Enter wholesale price"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vipPrice">VIP Price</Label>
              <Input
                id="vipPrice"
                type="number"
                step="0.01"
                value={editingItem?.vipPrice ?? ''}
                onChange={(e) => setEditingItem(prev => 
                  prev ? { ...prev, vipPrice: e.target.value ? parseFloat(e.target.value) : null } : null
                )}
                placeholder="Enter VIP price"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePrices} disabled={updatePricesMutation.isPending}>
              {updatePricesMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
      </MinimizableDialog>
    </div>
  );
}
