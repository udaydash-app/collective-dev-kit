import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Barcode as BarcodeIcon, Printer, Save, RefreshCw, Tag } from 'lucide-react';
import Barcode from 'react-barcode';
import { ReturnToPOSButton } from '@/components/layout/ReturnToPOSButton';
import { useReactToPrint } from 'react-to-print';
import { formatCurrency } from '@/lib/utils';
import { offlineDB } from '@/lib/offlineDB';
import { shouldUseLocalData } from '@/lib/localModeHelper';

interface SelectedItem {
  id: string;
  name: string;
  type: 'product' | 'variant';
  barcode: string;
  price: number;
  productId?: string;
  variantLabel?: string;
  manufacturingDate?: string;
  expiryDate?: string;
  batchNumber?: string;
}

export default function BarcodeManagement() {
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [generatedBarcodes, setGeneratedBarcodes] = useState<Map<string, string>>(new Map());
  const [itemDetails, setItemDetails] = useState<Map<string, { manufacturingDate: string; expiryDate: string; batchNumber: string }>>(new Map());
  const printRef = useRef<HTMLDivElement>(null);
  const priceTagPrintRef = useRef<HTMLDivElement>(null);
  const allStockPriceTagRef = useRef<HTMLDivElement>(null);
  const [allStockItems, setAllStockItems] = useState<SelectedItem[]>([]);
  const [loadingAllStock, setLoadingAllStock] = useState(false);

  // Customization settings — persisted to localStorage so last-used values are the default
  const BARCODE_PREFS_KEY = 'barcode-customization-prefs-v1';
  const defaultPrefs = {
    barcodeWidth: 6,
    barcodeHeight: 200,
    productNameSize: 72,
    variantLabelSize: 48,
    priceSize: 96,
    detailsSize: 36,
    expirySize: 84,
    customPrice: 0,
    printProductName: true,
    printVariantLabel: true,
    printBarcode: true,
    printPrice: true,
    printBatch: true,
    printManufacturingDate: true,
    printExpiryDate: true,
  };
  const loadedPrefs = (() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(BARCODE_PREFS_KEY) : null;
      return raw ? { ...defaultPrefs, ...JSON.parse(raw) } : defaultPrefs;
    } catch {
      return defaultPrefs;
    }
  })();
  const [barcodeWidth, setBarcodeWidth] = useState(loadedPrefs.barcodeWidth);
  const [barcodeHeight, setBarcodeHeight] = useState(loadedPrefs.barcodeHeight);
  const [productNameSize, setProductNameSize] = useState(loadedPrefs.productNameSize);
  const [variantLabelSize, setVariantLabelSize] = useState(loadedPrefs.variantLabelSize);
  const [priceSize, setPriceSize] = useState(loadedPrefs.priceSize);
  const [detailsSize, setDetailsSize] = useState(loadedPrefs.detailsSize);
  const [expirySize, setExpirySize] = useState(loadedPrefs.expirySize);
  const [customPrice, setCustomPrice] = useState<number>(loadedPrefs.customPrice ?? 0);
  const [printProductName, setPrintProductName] = useState<boolean>(loadedPrefs.printProductName ?? true);
  const [printVariantLabel, setPrintVariantLabel] = useState<boolean>(loadedPrefs.printVariantLabel ?? true);
  const [printBarcode, setPrintBarcode] = useState<boolean>(loadedPrefs.printBarcode ?? true);
  const [printPrice, setPrintPrice] = useState<boolean>(loadedPrefs.printPrice ?? true);
  const [printBatch, setPrintBatch] = useState<boolean>(loadedPrefs.printBatch ?? true);
  const [printManufacturingDate, setPrintManufacturingDate] = useState<boolean>(loadedPrefs.printManufacturingDate ?? true);
  const [printExpiryDate, setPrintExpiryDate] = useState<boolean>(loadedPrefs.printExpiryDate ?? true);

  useEffect(() => {
    try {
      localStorage.setItem(
        BARCODE_PREFS_KEY,
        JSON.stringify({
          barcodeWidth,
          barcodeHeight,
          productNameSize,
          variantLabelSize,
          priceSize,
          detailsSize,
          expirySize,
          customPrice,
          printProductName,
          printVariantLabel,
          printBarcode,
          printPrice,
          printBatch,
          printManufacturingDate,
          printExpiryDate,
        })
      );
    } catch {
      /* ignore quota errors */
    }
  }, [barcodeWidth, barcodeHeight, productNameSize, variantLabelSize, priceSize, detailsSize, expirySize, customPrice, printProductName, printVariantLabel, printBarcode, printPrice, printBatch, printManufacturingDate, printExpiryDate]);

  const { data: stores } = useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const cachedStoresWithFallback = async () => {
        const cachedStores = await offlineDB.getStores().catch(() => []);
        if (cachedStores.length > 0) return cachedStores;
        const cachedProducts = await offlineDB.getProducts().catch(() => []);
        const storeIds = [...new Set(cachedProducts.map((p: any) => p.store_id).filter(Boolean))];
        return storeIds.map((id) => ({ id, name: 'Cached Store' }));
      };
      if (shouldUseLocalData()) return cachedStoresWithFallback();
      try {
      const { data } = await supabase
        .from('stores')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (data) await offlineDB.saveStores(data);
      return data || [];
      } catch (error) {
        console.warn('[barcode] online stores failed, using cached stores', error);
        return cachedStoresWithFallback();
      }
    },
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ['products-for-barcode', selectedStoreId, searchTerm],
    queryFn: async () => {
      if (!selectedStoreId) return null;

      const loadCachedProducts = async () => {
        const [cachedProducts, cachedVariants] = await Promise.all([
          offlineDB.getProducts().catch(() => []),
          offlineDB.getProductVariants().catch(() => []),
        ]);
        const variantsByProduct = new Map<string, any[]>();
        cachedVariants.forEach((variant: any) => {
          const list = variantsByProduct.get(variant.product_id) || [];
          list.push({ ...variant, is_available: variant.is_available === true || variant.is_available === 1 });
          variantsByProduct.set(variant.product_id, list);
        });
        const search = searchTerm.trim().toLowerCase();
        return cachedProducts
          .filter((product: any) => selectedStoreId === '__all__' || product.store_id === selectedStoreId)
          .filter((product: any) => product.is_available === true || product.is_available === 1)
          .filter((product: any) => !search || product.name?.toLowerCase().includes(search))
          .map((product: any) => ({
            ...product,
            product_variants: variantsByProduct.get(product.id) || product.product_variants || [],
          }))
          .sort((a: any, b: any) => a.name.localeCompare(b.name))
          .slice(0, 50);
      };

      if (shouldUseLocalData()) return loadCachedProducts();

      try {
      let query = supabase
        .from('products')
        .select(`
          id,
          name,
          barcode,
          price,
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

      if (selectedStoreId !== '__all__') {
        query = query.eq('store_id', selectedStoreId);
      }

      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
      }

      const { data } = await query.limit(50);
      if (data) {
        await Promise.all([
          offlineDB.saveProducts(data as any),
          offlineDB.saveProductVariants(data.flatMap((product: any) => product.product_variants || [])),
        ]).catch(() => undefined);
      }
      return data || [];
      } catch (error) {
        console.warn('[barcode] online products failed, using cached products', error);
        return loadCachedProducts();
      }
    },
    enabled: !!selectedStoreId,
  });

  const handleItemToggle = (item: SelectedItem) => {
    setSelectedItems((prev) => {
      const exists = prev.find((i) => i.id === item.id && i.type === item.type);
      if (exists) {
        return prev.filter((i) => !(i.id === item.id && i.type === item.type));
      }
      return [...prev, item];
    });
  };

  const updateItemDetails = (itemKey: string, field: 'manufacturingDate' | 'expiryDate' | 'batchNumber', value: string) => {
    setItemDetails((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(itemKey) || { manufacturingDate: '', expiryDate: '', batchNumber: '' };
      newMap.set(itemKey, { ...current, [field]: value });
      return newMap;
    });
  };

  const isItemSelected = (id: string, type: 'product' | 'variant') => {
    return selectedItems.some((i) => i.id === id && i.type === type);
  };

  const generateBarcode = (itemId: string) => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `${timestamp}${random}`.slice(0, 13);
  };

  const handleGenerateBarcodes = () => {
    if (selectedItems.length === 0) {
      toast.error('Please select at least one item');
      return;
    }

    const newBarcodes = new Map(generatedBarcodes);
    selectedItems.forEach((item) => {
      if (!item.barcode) {
        const newBarcode = generateBarcode(item.id);
        newBarcodes.set(`${item.type}-${item.id}`, newBarcode);
      }
    });
    setGeneratedBarcodes(newBarcodes);
    toast.success(`Generated barcodes for ${selectedItems.length} items`);
  };

  const handleSaveBarcodes = async () => {
    if (generatedBarcodes.size === 0) {
      toast.error('No new barcodes to save');
      return;
    }

    try {
      for (const item of selectedItems) {
        const key = `${item.type}-${item.id}`;
        const barcode = generatedBarcodes.get(key);
        
        if (barcode && !item.barcode) {
          if (item.type === 'product') {
            await supabase
              .from('products')
              .update({ barcode })
              .eq('id', item.id);
          } else {
            await supabase
              .from('product_variants')
              .update({ barcode })
              .eq('id', item.id);
          }
        }
      }

      toast.success('Barcodes saved successfully');
      setGeneratedBarcodes(new Map());
      setSelectedItems([]);
    } catch (error) {
      console.error('Error saving barcodes:', error);
      toast.error('Failed to save barcodes');
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Product Barcodes',
    onAfterPrint: () => toast.success('Barcodes sent to printer'),
  });

  const handlePrintPriceTags = useReactToPrint({
    contentRef: priceTagPrintRef,
    documentTitle: 'Price Tags',
    onAfterPrint: () => toast.success('Price tags sent to printer'),
  });

  const handlePrintAllStockPriceTags = useReactToPrint({
    contentRef: allStockPriceTagRef,
    documentTitle: 'All In-Stock Price Tags',
    onAfterPrint: () => toast.success('Price tags sent to printer'),
  });

  const handlePrintAllInStock = async () => {
    setLoadingAllStock(true);
    try {
      const loadCached = async (): Promise<SelectedItem[]> => {
        const [cachedProducts, cachedVariants] = await Promise.all([
          offlineDB.getProducts().catch(() => []),
          offlineDB.getProductVariants().catch(() => []),
        ]);
        const variantsByProduct = new Map<string, any[]>();
        cachedVariants.forEach((v: any) => {
          const list = variantsByProduct.get(v.product_id) || [];
          list.push(v);
          variantsByProduct.set(v.product_id, list);
        });
        const items: SelectedItem[] = [];
        cachedProducts
          .filter((p: any) =>
            (selectedStoreId === '__all__' || !selectedStoreId || p.store_id === selectedStoreId) &&
            (p.is_available === true || p.is_available === 1) &&
            Number(p.stock_quantity) > 0
          )
          .forEach((p: any) => {
            const variants = (variantsByProduct.get(p.id) || []).filter(
              (v: any) => (v.is_available === true || v.is_available === 1) && Number(v.stock_quantity) > 0
            );
            if (variants.length > 0) {
              variants.forEach((v: any) =>
                items.push({
                  id: v.id,
                  name: p.name,
                  type: 'variant',
                  barcode: v.barcode,
                  price: v.price,
                  productId: p.id,
                  variantLabel: v.label,
                })
              );
            } else {
              items.push({ id: p.id, name: p.name, type: 'product', barcode: p.barcode, price: p.price });
            }
          });
        return items;
      };

      let items: SelectedItem[] = [];
      if (shouldUseLocalData()) {
        items = await loadCached();
      } else {
        try {
          let query = supabase
            .from('products')
            .select(`id, name, barcode, price, stock_quantity, product_variants(id, label, barcode, price, stock_quantity, is_available)`)
            .eq('is_available', true)
            .gt('stock_quantity', 0)
            .order('name');
          if (selectedStoreId && selectedStoreId !== '__all__') {
            query = query.eq('store_id', selectedStoreId);
          }
          const { data, error } = await query.limit(2000);
          if (error) throw error;
          (data || []).forEach((p: any) => {
            const variants = (p.product_variants || []).filter(
              (v: any) => v.is_available && Number(v.stock_quantity) > 0
            );
            if (variants.length > 0) {
              variants.forEach((v: any) =>
                items.push({
                  id: v.id,
                  name: p.name,
                  type: 'variant',
                  barcode: v.barcode,
                  price: v.price,
                  productId: p.id,
                  variantLabel: v.label,
                })
              );
            } else {
              items.push({ id: p.id, name: p.name, type: 'product', barcode: p.barcode, price: p.price });
            }
          });
        } catch (err) {
          console.warn('[barcode] online in-stock fetch failed, using cache', err);
          items = await loadCached();
        }
      }

      if (items.length === 0) {
        toast.error('No in-stock products found');
        return;
      }
      setAllStockItems(items);
      toast.success(`Preparing ${items.length} price tags...`);
      // Wait for render before printing
      await new Promise((r) => setTimeout(r, 200));
      handlePrintAllStockPriceTags();
    } finally {
      setLoadingAllStock(false);
    }
  };

  const getBarcodeValue = (item: SelectedItem) => {
    const key = `${item.type}-${item.id}`;
    return generatedBarcodes.get(key) || item.barcode || generateBarcode(item.id);
  };

  const getBarcodeValues = (item: SelectedItem): string[] => {
    const barcodeValue = getBarcodeValue(item);
    // Split by comma and trim whitespace
    return barcodeValue.split(',').map(b => b.trim()).filter(b => b.length > 0);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-screen-xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Barcode Management</h1>
            <p className="text-muted-foreground">Generate and print barcodes for products and variants</p>
          </div>
          <ReturnToPOSButton inline />
        </div>

        {/* Store and Search Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Store and Search Products</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="store">Store</Label>
                <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                  <SelectTrigger id="store">
                    <SelectValue placeholder="Select store" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All cached stores</SelectItem>
                    {stores?.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="search">Search Products</Label>
                <Input
                  id="search"
                  placeholder="Search by product name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            {selectedStoreId && (
              <div className="flex flex-wrap gap-3 pt-2 border-t">
                <Button
                  onClick={handlePrintAllInStock}
                  disabled={loadingAllStock}
                  variant="outline"
                  className="gap-2"
                >
                  <Tag className="h-4 w-4" />
                  {loadingAllStock ? 'Loading...' : 'Print Price Tags For All In-Stock Products'}
                </Button>
                <p className="text-xs text-muted-foreground self-center">
                  Prints a price tag for every available product (and variant) with stock greater than zero in the selected store.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Product Selection */}
        {selectedStoreId && (
          <Card>
            <CardHeader>
              <CardTitle>
                Select Products/Variants ({selectedItems.length} selected)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground">Loading products...</p>
              ) : products && products.length > 0 ? (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {products.map((product: any) => (
                    <div key={product.id} className="border rounded-lg p-4 space-y-2">
                      {/* Main Product */}
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isItemSelected(product.id, 'product')}
                          onCheckedChange={() =>
                            handleItemToggle({
                              id: product.id,
                              name: product.name,
                              type: 'product',
                              barcode: product.barcode,
                              price: product.price,
                            })
                          }
                        />
                        <div className="flex-1">
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {product.barcode ? `Barcode: ${product.barcode}` : 'No barcode'}
                          </p>
                        </div>
                      </div>

                      {/* Variants */}
                      {product.product_variants && product.product_variants.length > 0 && (
                        <div className="ml-8 space-y-2 pt-2 border-t">
                          <p className="text-sm font-medium text-muted-foreground">Variants:</p>
                          {product.product_variants
                            .filter((v: any) => v.is_available)
                            .map((variant: any) => (
                              <div key={variant.id} className="flex items-center gap-3">
                                <Checkbox
                                  checked={isItemSelected(variant.id, 'variant')}
                                  onCheckedChange={() =>
                                    handleItemToggle({
                                      id: variant.id,
                                      name: product.name,
                                      type: 'variant',
                                      barcode: variant.barcode,
                                      price: variant.price,
                                      productId: product.id,
                                      variantLabel: variant.label,
                                    })
                                  }
                                />
                                <div className="flex-1">
                                  <p className="text-sm">{variant.label}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {variant.barcode ? `Barcode: ${variant.barcode}` : 'No barcode'}
                                  </p>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No products found. Try a different search.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Item Details */}
        {selectedItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Product Details for Barcode</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedItems.map((item) => {
                const itemKey = `${item.type}-${item.id}`;
                const details = itemDetails.get(itemKey) || { manufacturingDate: '', expiryDate: '', batchNumber: '' };
                return (
                  <div key={itemKey} className="border rounded-lg p-4 space-y-3">
                    <p className="font-medium">
                      {item.name} {item.variantLabel && `- ${item.variantLabel}`}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor={`mfg-${itemKey}`}>Manufacturing Date</Label>
                        <Input
                          id={`mfg-${itemKey}`}
                          type="date"
                          value={details.manufacturingDate}
                          onChange={(e) => updateItemDetails(itemKey, 'manufacturingDate', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`exp-${itemKey}`}>Expiry Date</Label>
                        <Input
                          id={`exp-${itemKey}`}
                          type="date"
                          value={details.expiryDate}
                          onChange={(e) => updateItemDetails(itemKey, 'expiryDate', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`batch-${itemKey}`}>Batch Number</Label>
                        <Input
                          id={`batch-${itemKey}`}
                          type="text"
                          placeholder="Enter batch number"
                          value={details.batchNumber}
                          onChange={(e) => updateItemDetails(itemKey, 'batchNumber', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Customization Settings */}
        {selectedItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Customize Barcode Appearance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-base">What to print</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Disabling Barcode also hides the SKU number printed below it.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={printProductName} onCheckedChange={(v) => setPrintProductName(!!v)} />
                    Product Name
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={printVariantLabel} onCheckedChange={(v) => setPrintVariantLabel(!!v)} />
                    Variant Label
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={printBarcode} onCheckedChange={(v) => setPrintBarcode(!!v)} />
                    Barcode + SKU
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={printPrice} onCheckedChange={(v) => setPrintPrice(!!v)} />
                    Price
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={printBatch} onCheckedChange={(v) => setPrintBatch(!!v)} />
                    Batch Number
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={printManufacturingDate} onCheckedChange={(v) => setPrintManufacturingDate(!!v)} />
                    Manufacturing Date
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={printExpiryDate} onCheckedChange={(v) => setPrintExpiryDate(!!v)} />
                    Expiry Date
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="barcode-width">Barcode Width (1-10)</Label>
                  <Input
                    id="barcode-width"
                    type="number"
                    min="1"
                    max="10"
                    value={barcodeWidth}
                    onChange={(e) => setBarcodeWidth(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="barcode-height">Barcode Height (50-400)</Label>
                  <Input
                    id="barcode-height"
                    type="number"
                    min="50"
                    max="400"
                    value={barcodeHeight}
                    onChange={(e) => setBarcodeHeight(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="product-name-size">Product Name Size (px)</Label>
                  <Input
                    id="product-name-size"
                    type="number"
                    min="24"
                    max="120"
                    value={productNameSize}
                    onChange={(e) => setProductNameSize(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="variant-label-size">Variant Label Size (px)</Label>
                  <Input
                    id="variant-label-size"
                    type="number"
                    min="18"
                    max="80"
                    value={variantLabelSize}
                    onChange={(e) => setVariantLabelSize(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="details-size">Details Text Size (px)</Label>
                  <Input
                    id="details-size"
                    type="number"
                    min="18"
                    max="72"
                    value={detailsSize}
                    onChange={(e) => setDetailsSize(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="expiry-size">Expiry Date Size (px)</Label>
                  <Input
                    id="expiry-size"
                    type="number"
                    min="24"
                    max="120"
                    value={expirySize}
                    onChange={(e) => setExpirySize(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="custom-price">Price</Label>
                  <Input
                    id="custom-price"
                    type="number"
                    min="0"
                    step="1"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(Number(e.target.value))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        {selectedItems.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-3">
                <Button onClick={handleGenerateBarcodes} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Generate Barcodes
                </Button>
                <Button onClick={handleSaveBarcodes} variant="outline" className="gap-2">
                  <Save className="h-4 w-4" />
                  Save to Database
                </Button>
                <Button onClick={handlePrint} variant="outline" className="gap-2">
                  <Printer className="h-4 w-4" />
                  Print Barcodes
                </Button>
                <Button onClick={handlePrintPriceTags} variant="outline" className="gap-2">
                  <Tag className="h-4 w-4" />
                  Print Price Tags
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Barcode Preview */}
        {selectedItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarcodeIcon className="h-5 w-5" />
                Barcode Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <style>
                {`
                  @media print {
                    @page {
                      size: 38cm 25cm;
                      margin: 0;
                    }
                    body {
                      margin: 0;
                      padding: 0;
                    }
                    .barcode-container {
                      display: block !important;
                    }
                    .barcode-label {
                      width: 38cm !important;
                      height: 25cm !important;
                      padding: 1cm !important;
                      margin: 0 !important;
                      box-sizing: border-box;
                      display: flex !important;
                      flex-direction: column;
                      justify-content: center;
                      align-items: center;
                      page-break-after: always;
                      gap: 1cm !important;
                    }
                    .barcode-label p {
                      margin: 0 !important;
                      padding: 0 !important;
                    }
                    .barcode-label svg {
                      width: 32cm !important;
                      height: auto !important;
                    }
                    .product-name {
                      font-size: ${productNameSize}px !important;
                      font-weight: bold !important;
                    }
                    .variant-label {
                      font-size: ${variantLabelSize}px !important;
                    }
                    .price-text {
                      font-size: ${priceSize}px !important;
                      font-weight: bold !important;
                    }
                    .details-text {
                      font-size: ${detailsSize}px !important;
                    }
                    .expiry-date {
                      font-size: ${expirySize}px !important;
                      font-weight: bold !important;
                    }
                  }
                `}
              </style>
              <div ref={printRef} className="barcode-container flex flex-wrap gap-2">
                {selectedItems.map((item) => {
                  const barcodeValues = getBarcodeValues(item);
                  const itemKey = `${item.type}-${item.id}`;
                  const details = itemDetails.get(itemKey);
                  return (
                    <div
                      key={itemKey}
                      className="barcode-label rounded-lg p-8 flex flex-col items-center justify-center gap-6"
                      style={{ width: '36cm', height: '23cm' }}
                    >
                      <div className="w-full text-center">
                        {printProductName && (
                          <p className="product-name font-bold text-7xl leading-tight px-2">{item.name}</p>
                        )}
                        {printVariantLabel && item.variantLabel && (
                          <p className="variant-label text-5xl leading-tight px-2 mt-4">{item.variantLabel}</p>
                        )}
                      </div>
                      {printBarcode && barcodeValues.map((barcodeValue, index) => (
                        <div key={index} className="flex justify-center w-full">
                          <Barcode
                            value={barcodeValue}
                            width={barcodeWidth}
                            height={barcodeHeight}
                            fontSize={48}
                            background="#ffffff"
                            margin={10}
                          />
                        </div>
                      ))}
                      {printPrice && (
                        <p className="price-text text-8xl font-bold">{formatCurrency(customPrice)}</p>
                      )}
                      {details && (
                        <div className="details-text text-4xl leading-relaxed w-full text-center space-y-3">
                          {printBatch && details.batchNumber && (
                            <p><span className="font-semibold">Batch:</span> {details.batchNumber}</p>
                          )}
                          {printManufacturingDate && details.manufacturingDate && (
                            <p><span className="font-semibold">Manufacturing Date:</span> {new Date(details.manufacturingDate).toLocaleDateString('en-GB')}</p>
                          )}
                          {printExpiryDate && details.expiryDate && (
                            <p className="expiry-date font-bold text-black"><span className="font-bold">Expiry Date:</span> {new Date(details.expiryDate).toLocaleDateString('en-GB')}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Price Tag Print Section (hidden, used for printing) */}
        {selectedItems.length > 0 && (
          <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
            <style>
              {`
                @media print {
                  @page {
                    size: 6cm 3.5cm;
                    margin: 0;
                  }
                  body {
                    margin: 0;
                    padding: 0;
                  }
                  .price-tag-container {
                    display: block !important;
                  }
                  .price-tag-label {
                    width: 6cm !important;
                    height: 3.5cm !important;
                    padding: 2mm !important;
                    margin: 0 !important;
                    box-sizing: border-box;
                    display: flex !important;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    page-break-after: always;
                    border: 1px solid #ccc;
                  }
                  .price-tag-name {
                    font-size: 10pt !important;
                    font-weight: bold !important;
                    text-align: center;
                    line-height: 1.2;
                    margin-bottom: 2mm;
                  }
                  .price-tag-price {
                    font-size: 14pt !important;
                    font-weight: bold !important;
                    text-align: center;
                    color: #000 !important;
                  }
                }
              `}
            </style>
            <div ref={priceTagPrintRef} className="price-tag-container">
              {selectedItems.map((item) => {
                const itemKey = `${item.type}-${item.id}`;
                return (
                  <div
                    key={itemKey}
                    className="price-tag-label"
                    style={{
                      width: '6cm',
                      height: '3.5cm',
                      padding: '2mm',
                      border: '1px solid #ccc',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div
                      className="price-tag-name"
                      style={{
                        fontSize: '10pt',
                        fontWeight: 'bold',
                        textAlign: 'center',
                        lineHeight: 1.2,
                        marginBottom: '2mm',
                        wordBreak: 'break-word',
                      }}
                    >
                      {item.name}
                      {item.variantLabel ? ` - ${item.variantLabel}` : ''}
                    </div>
                    <div
                      className="price-tag-price"
                      style={{
                        fontSize: '14pt',
                        fontWeight: 'bold',
                        textAlign: 'center',
                        color: '#000',
                      }}
                    >
                      {formatCurrency(customPrice || item.price)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* All In-Stock Price Tag Print Section (hidden) */}
        {allStockItems.length > 0 && (
          <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
            <div ref={allStockPriceTagRef} className="price-tag-container">
              {allStockItems.map((item) => {
                const itemKey = `all-${item.type}-${item.id}`;
                return (
                  <div
                    key={itemKey}
                    className="price-tag-label"
                    style={{
                      width: '5cm',
                      height: '3cm',
                      padding: '2mm',
                      border: '1px solid #ccc',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div
                      className="price-tag-name"
                      style={{
                        fontSize: '10pt',
                        fontWeight: 'bold',
                        textAlign: 'center',
                        lineHeight: 1.2,
                        marginBottom: '2mm',
                        wordBreak: 'break-word',
                      }}
                    >
                      {item.name}
                      {item.variantLabel ? ` - ${item.variantLabel}` : ''}
                    </div>
                    <div
                      className="price-tag-price"
                      style={{
                        fontSize: '14pt',
                        fontWeight: 'bold',
                        textAlign: 'center',
                        color: '#000',
                      }}
                    >
                      {formatCurrency(item.price)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
