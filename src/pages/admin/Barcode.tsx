import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Barcode as BarcodeIcon, Printer, Save, RefreshCw } from 'lucide-react';
import Barcode from 'react-barcode';
import { ReturnToPOSButton } from '@/components/layout/ReturnToPOSButton';
import { useReactToPrint } from 'react-to-print';

interface SelectedItem {
  id: string;
  name: string;
  type: 'product' | 'variant';
  barcode: string;
  price: number;
  productId?: string;
  variantLabel?: string;
}

export default function BarcodeManagement() {
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [generatedBarcodes, setGeneratedBarcodes] = useState<Map<string, string>>(new Map());
  const printRef = useRef<HTMLDivElement>(null);

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

  const { data: products, isLoading } = useQuery({
    queryKey: ['products-for-barcode', selectedStoreId, searchTerm],
    queryFn: async () => {
      if (!selectedStoreId) return null;

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
        .eq('store_id', selectedStoreId)
        .eq('is_available', true)
        .order('name');

      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
      }

      const { data } = await query.limit(50);
      return data || [];
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
              <div ref={printRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                {selectedItems.map((item) => {
                  const barcodeValues = getBarcodeValues(item);
                  return (
                    <div
                      key={`${item.type}-${item.id}`}
                      className="border rounded-lg p-4 text-center space-y-2"
                    >
                      <p className="font-medium text-sm">{item.name}</p>
                      {item.variantLabel && (
                        <p className="text-xs text-muted-foreground">{item.variantLabel}</p>
                      )}
                      {barcodeValues.map((barcodeValue, index) => (
                        <div key={index} className="flex flex-col items-center gap-1">
                          {barcodeValues.length > 1 && (
                            <p className="text-[10px] text-muted-foreground">Barcode {index + 1}</p>
                          )}
                          <div className="flex justify-center">
                            <Barcode
                              value={barcodeValue}
                              width={1.5}
                              height={50}
                              fontSize={12}
                              background="#ffffff"
                            />
                          </div>
                        </div>
                      ))}
                      <p className="text-sm font-medium">${item.price}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
