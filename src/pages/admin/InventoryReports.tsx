import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { FileText, Package, AlertTriangle, TrendingUp, Printer, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { ReturnToPOSButton } from '@/components/layout/ReturnToPOSButton';

type ReportType = 
  | 'stock-levels-by-category'
  | 'stock-levels-by-product'
  | 'low-stock-items'
  | 'out-of-stock-items'
  | 'inventory-valuation';

export default function InventoryReports() {
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [reportType, setReportType] = useState<ReportType>('stock-levels-by-category');
  const [lowStockThreshold, setLowStockThreshold] = useState('10');
  const [showReport, setShowReport] = useState(false);

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

  const { data: reportData, isLoading, refetch } = useQuery({
    queryKey: ['inventory-report', selectedStoreId, reportType, lowStockThreshold],
    queryFn: async () => {
      if (!selectedStoreId) return null;

      // Stock Levels by Category
      if (reportType === 'stock-levels-by-category') {
        const { data: products } = await supabase
          .from('products')
          .select(`
            *,
            categories(name),
            product_variants(stock_quantity)
          `)
          .eq('store_id', selectedStoreId)
          .eq('is_available', true);

        const categoryMap = new Map<string, { 
          totalStock: number; 
          totalValue: number; 
          productCount: number;
          products: any[];
        }>();

        products?.forEach((product: any) => {
          const categoryName = product.categories?.name || 'Uncategorized';
          const stock = product.stock_quantity || 0;
          const variantStock = product.product_variants?.reduce((sum: number, v: any) => sum + (v.stock_quantity || 0), 0) || 0;
          const totalStock = stock + variantStock;
          const value = totalStock * parseFloat(product.price?.toString() || '0');

          const current = categoryMap.get(categoryName) || { 
            totalStock: 0, 
            totalValue: 0, 
            productCount: 0,
            products: []
          };
          
          categoryMap.set(categoryName, {
            totalStock: current.totalStock + totalStock,
            totalValue: current.totalValue + value,
            productCount: current.productCount + 1,
            products: [...current.products, { ...product, totalStock, value }]
          });
        });

        return {
          type: 'stock-levels-by-category',
          data: Array.from(categoryMap.entries()).map(([category, stats]) => ({
            category,
            ...stats,
          })).sort((a, b) => b.totalValue - a.totalValue),
        };
      }

      // Stock Levels by Product
      if (reportType === 'stock-levels-by-product') {
        const { data: products } = await supabase
          .from('products')
          .select(`
            *,
            categories(name),
            product_variants(stock_quantity, label)
          `)
          .eq('store_id', selectedStoreId)
          .eq('is_available', true)
          .order('name');

        const productsWithStock = products?.map((product: any) => {
          const baseStock = product.stock_quantity || 0;
          const variantStock = product.product_variants?.reduce((sum: number, v: any) => sum + (v.stock_quantity || 0), 0) || 0;
          const totalStock = baseStock + variantStock;
          const value = totalStock * parseFloat(product.price?.toString() || '0');

          return {
            name: product.name,
            category: product.categories?.name || 'Uncategorized',
            baseStock,
            variantStock,
            totalStock,
            price: parseFloat(product.price?.toString() || '0'),
            value,
            variants: product.product_variants || [],
          };
        });

        return {
          type: 'stock-levels-by-product',
          data: productsWithStock || [],
        };
      }

      // Low Stock Items
      if (reportType === 'low-stock-items') {
        const threshold = parseInt(lowStockThreshold);
        const { data: products } = await supabase
          .from('products')
          .select(`
            *,
            categories(name),
            product_variants(stock_quantity, label)
          `)
          .eq('store_id', selectedStoreId)
          .eq('is_available', true);

        const lowStockProducts = products
          ?.map((product: any) => {
            const baseStock = product.stock_quantity || 0;
            const variantStock = product.product_variants?.reduce((sum: number, v: any) => sum + (v.stock_quantity || 0), 0) || 0;
            const totalStock = baseStock + variantStock;

            return {
              name: product.name,
              category: product.categories?.name || 'Uncategorized',
              totalStock,
              threshold,
              price: parseFloat(product.price?.toString() || '0'),
            };
          })
          .filter((p: any) => p.totalStock > 0 && p.totalStock <= threshold)
          .sort((a: any, b: any) => a.totalStock - b.totalStock);

        return {
          type: 'low-stock-items',
          data: lowStockProducts || [],
        };
      }

      // Out of Stock Items
      if (reportType === 'out-of-stock-items') {
        const { data: products } = await supabase
          .from('products')
          .select(`
            *,
            categories(name),
            product_variants(stock_quantity, label)
          `)
          .eq('store_id', selectedStoreId)
          .eq('is_available', true);

        const outOfStockProducts = products
          ?.map((product: any) => {
            const baseStock = product.stock_quantity || 0;
            const variantStock = product.product_variants?.reduce((sum: number, v: any) => sum + (v.stock_quantity || 0), 0) || 0;
            const totalStock = baseStock + variantStock;

            return {
              name: product.name,
              category: product.categories?.name || 'Uncategorized',
              totalStock,
              price: parseFloat(product.price?.toString() || '0'),
            };
          })
          .filter((p: any) => p.totalStock === 0);

        return {
          type: 'out-of-stock-items',
          data: outOfStockProducts || [],
        };
      }

      // Inventory Valuation
      if (reportType === 'inventory-valuation') {
        const { data: products } = await supabase
          .from('products')
          .select(`
            *,
            categories(name),
            product_variants(stock_quantity)
          `)
          .eq('store_id', selectedStoreId)
          .eq('is_available', true);

        const categoryMap = new Map<string, { 
          totalStock: number; 
          totalValue: number; 
          productCount: number;
        }>();

        let grandTotalValue = 0;
        let grandTotalStock = 0;

        products?.forEach((product: any) => {
          const categoryName = product.categories?.name || 'Uncategorized';
          const stock = product.stock_quantity || 0;
          const variantStock = product.product_variants?.reduce((sum: number, v: any) => sum + (v.stock_quantity || 0), 0) || 0;
          const totalStock = stock + variantStock;
          const value = totalStock * parseFloat(product.price?.toString() || '0');

          grandTotalValue += value;
          grandTotalStock += totalStock;

          const current = categoryMap.get(categoryName) || { 
            totalStock: 0, 
            totalValue: 0, 
            productCount: 0,
          };
          
          categoryMap.set(categoryName, {
            totalStock: current.totalStock + totalStock,
            totalValue: current.totalValue + value,
            productCount: current.productCount + 1,
          });
        });

        return {
          type: 'inventory-valuation',
          data: {
            categories: Array.from(categoryMap.entries()).map(([category, stats]) => ({
              category,
              ...stats,
            })).sort((a, b) => b.totalValue - a.totalValue),
            grandTotalValue,
            grandTotalStock,
            totalProducts: products?.length || 0,
          },
        };
      }

      return null;
    },
    enabled: false,
  });

  const handleGenerateReport = () => {
    if (!selectedStoreId) {
      toast.error('Please select a store');
      return;
    }
    setShowReport(true);
    refetch();
  };

  const handlePrint = () => {
    window.print();
  };

  const storeName = stores?.find(s => s.id === selectedStoreId)?.name || 'Store';

  const renderReportContent = () => {
    if (!reportData) return null;

    // Stock Levels by Category
    if (reportData.type === 'stock-levels-by-category') {
      const data = reportData.data as Array<{ 
        category: string; 
        totalStock: number; 
        totalValue: number; 
        productCount: number;
      }>;
      const totalValue = data.reduce((sum, item) => sum + item.totalValue, 0);

      return (
        <Card>
          <CardHeader>
            <CardTitle>Stock Levels by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-4 bg-primary/10 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Inventory Value</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Categories</p>
                  <p className="text-2xl font-bold">{data.length}</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-5 gap-4 font-semibold text-sm border-b pb-2">
                <div>Category</div>
                <div className="text-right">Products</div>
                <div className="text-right">Total Stock</div>
                <div className="text-right">Value</div>
                <div className="text-right">% of Total</div>
              </div>
              {data.map((item) => (
                <div key={item.category} className="grid grid-cols-5 gap-4 py-2 border-b">
                  <div className="font-medium">{item.category}</div>
                  <div className="text-right">{item.productCount}</div>
                  <div className={`text-right font-semibold ${
                    item.totalStock < 0 
                      ? 'text-red-600' 
                      : item.totalStock > 0 
                      ? 'text-green-600' 
                      : 'text-muted-foreground'
                  }`}>
                    {item.totalStock < 0 ? '-' : ''}{Math.abs(item.totalStock)}
                  </div>
                  <div className="text-right font-semibold">{formatCurrency(item.totalValue)}</div>
                  <div className="text-right text-muted-foreground">
                    {((item.totalValue / totalValue) * 100).toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      );
    }

    // Stock Levels by Product
    if (reportData.type === 'stock-levels-by-product') {
      const data = reportData.data as Array<any>;
      const totalValue = data.reduce((sum, item) => sum + item.value, 0);
      const totalStock = data.reduce((sum, item) => sum + item.totalStock, 0);

      return (
        <Card>
          <CardHeader>
            <CardTitle>Stock Levels by Product</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-4 bg-primary/10 rounded-lg">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Value</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Stock</p>
                  <p className={`text-2xl font-bold ${
                    totalStock < 0 
                      ? 'text-red-600' 
                      : totalStock > 0 
                      ? 'text-green-600' 
                      : 'text-muted-foreground'
                  }`}>
                    {totalStock < 0 ? '-' : ''}{Math.abs(totalStock)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Products</p>
                  <p className="text-2xl font-bold">{data.length}</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-6 gap-4 font-semibold text-sm border-b pb-2">
                <div className="col-span-2">Product</div>
                <div>Category</div>
                <div className="text-right">Stock</div>
                <div className="text-right">Price</div>
                <div className="text-right">Value</div>
              </div>
              {data.map((item, index) => (
                <div key={index} className="grid grid-cols-6 gap-4 py-2 border-b">
                  <div className="col-span-2 font-medium">{item.name}</div>
                  <div className="text-sm text-muted-foreground">{item.category}</div>
                  <div className={`text-right font-semibold ${
                    item.totalStock < 0 
                      ? 'text-red-600' 
                      : item.totalStock > 0 
                      ? 'text-green-600' 
                      : 'text-muted-foreground'
                  }`}>
                    {item.totalStock < 0 ? '-' : ''}{Math.abs(item.totalStock)}
                  </div>
                  <div className="text-right">{formatCurrency(item.price)}</div>
                  <div className="text-right font-semibold">{formatCurrency(item.value)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      );
    }

    // Low Stock Items
    if (reportData.type === 'low-stock-items') {
      const data = reportData.data as Array<any>;

      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Low Stock Items (Below {lowStockThreshold} units)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No low stock items found</p>
            ) : (
              <>
                <div className="mb-4 p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Items Need Restocking</p>
                    <p className="text-2xl font-bold text-orange-600">{data.length}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-4 gap-4 font-semibold text-sm border-b pb-2">
                    <div className="col-span-2">Product</div>
                    <div>Category</div>
                    <div className="text-right">Current Stock</div>
                  </div>
                  {data.map((item, index) => (
                    <div key={index} className="grid grid-cols-4 gap-4 py-2 border-b">
                      <div className="col-span-2 font-medium">{item.name}</div>
                      <div className="text-sm text-muted-foreground">{item.category}</div>
                      <div className="text-right">
                        <span className={`font-semibold ${
                          item.totalStock < 0 
                            ? 'text-red-600' 
                            : item.totalStock > 0 
                            ? 'text-green-600' 
                            : 'text-muted-foreground'
                        }`}>
                          {item.totalStock < 0 ? '-' : ''}{Math.abs(item.totalStock)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      );
    }

    // Out of Stock Items
    if (reportData.type === 'out-of-stock-items') {
      const data = reportData.data as Array<any>;

      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Out of Stock Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No out of stock items found</p>
            ) : (
              <>
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Items Out of Stock</p>
                    <p className="text-2xl font-bold text-red-600">{data.length}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-4 font-semibold text-sm border-b pb-2">
                    <div className="col-span-2">Product</div>
                    <div>Category</div>
                  </div>
                  {data.map((item, index) => (
                    <div key={index} className="grid grid-cols-3 gap-4 py-2 border-b">
                      <div className="col-span-2 font-medium">{item.name}</div>
                      <div className="text-sm text-muted-foreground">{item.category}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      );
    }

    // Inventory Valuation
    if (reportData.type === 'inventory-valuation') {
      const { categories, grandTotalValue, grandTotalStock, totalProducts } = reportData.data as any;

      return (
        <Card>
          <CardHeader>
            <CardTitle>Inventory Valuation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-6 p-6 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Inventory Value</p>
                  <p className="text-3xl font-bold">{formatCurrency(grandTotalValue)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Stock Units</p>
                  <p className={`text-3xl font-bold ${
                    grandTotalStock < 0 
                      ? 'text-red-600' 
                      : grandTotalStock > 0 
                      ? 'text-green-600' 
                      : 'text-muted-foreground'
                  }`}>
                    {grandTotalStock < 0 ? '-' : ''}{Math.abs(grandTotalStock)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Products</p>
                  <p className="text-3xl font-bold">{totalProducts}</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-5 gap-4 font-semibold text-sm border-b pb-2">
                <div>Category</div>
                <div className="text-right">Products</div>
                <div className="text-right">Stock</div>
                <div className="text-right">Value</div>
                <div className="text-right">% of Total</div>
              </div>
              {categories.map((item: any) => (
                <div key={item.category} className="grid grid-cols-5 gap-4 py-2 border-b">
                  <div className="font-medium">{item.category}</div>
                  <div className="text-right">{item.productCount}</div>
                  <div className={`text-right font-semibold ${
                    item.totalStock < 0 
                      ? 'text-red-600' 
                      : item.totalStock > 0 
                      ? 'text-green-600' 
                      : 'text-muted-foreground'
                  }`}>
                    {item.totalStock < 0 ? '-' : ''}{Math.abs(item.totalStock)}
                  </div>
                  <div className="text-right font-semibold">{formatCurrency(item.totalValue)}</div>
                  <div className="text-right text-muted-foreground">
                    {((item.totalValue / grandTotalValue) * 100).toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      );
    }

    return null;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-3xl font-bold">Inventory Reports</h1>
        </div>
        <div className="flex gap-2">
          <ReturnToPOSButton inline />
          {showReport && (
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print Report
            </Button>
          )}
        </div>
      </div>

      {/* Analysis Reports Menu */}
      <Card className="no-print">
        <CardHeader>
          <CardTitle>Analysis Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link to="/admin/cogs-analysis">
              <Button variant="outline" className="w-full h-20 flex flex-col gap-2">
                <DollarSign className="h-5 w-5" />
                <span className="text-sm">COGS Analysis</span>
              </Button>
            </Link>
            <Link to="/admin/profit-margin-analysis">
              <Button variant="outline" className="w-full h-20 flex flex-col gap-2">
                <TrendingUp className="h-5 w-5" />
                <span className="text-sm">Profit Margin</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>


      {/* Report Parameters */}
      <Card className="no-print">
        <CardHeader>
          <CardTitle>Report Parameters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <Label htmlFor="reportType">Report Type *</Label>
              <Select value={reportType} onValueChange={(value) => setReportType(value as ReportType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock-levels-by-category">Stock Levels by Category</SelectItem>
                  <SelectItem value="stock-levels-by-product">Stock Levels by Product</SelectItem>
                  <SelectItem value="low-stock-items">Low Stock Items</SelectItem>
                  <SelectItem value="out-of-stock-items">Out of Stock Items</SelectItem>
                  <SelectItem value="inventory-valuation">Inventory Valuation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {reportType === 'low-stock-items' && (
            <div className="space-y-2">
              <Label htmlFor="threshold">Low Stock Threshold</Label>
              <Input
                id="threshold"
                type="number"
                min="1"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
                placeholder="Enter threshold (e.g., 10)"
              />
            </div>
          )}

          <Button onClick={handleGenerateReport} disabled={isLoading} className="w-full">
            <FileText className="h-4 w-4 mr-2" />
            {isLoading ? 'Generating...' : 'Generate Report'}
          </Button>
        </CardContent>
      </Card>

      {/* Report Content */}
      {showReport && reportData && (
        <div className="space-y-6 print-area">
          {/* Report Header */}
          <div className="text-center space-y-2 print-header">
            <h2 className="text-3xl font-bold">{storeName}</h2>
            <h3 className="text-2xl">
              {reportType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </h3>
            <p className="text-sm text-muted-foreground">Generated on {formatDateTime(new Date())}</p>
          </div>

          <Separator className="print-separator" />

          {renderReportContent()}
        </div>
      )}

      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-area {
            page-break-inside: avoid;
          }
          .print-header {
            margin-bottom: 2rem;
          }
          .print-separator {
            margin: 1.5rem 0;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
