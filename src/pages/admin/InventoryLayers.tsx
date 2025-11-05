import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronDown, ChevronRight, Package } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";

interface InventoryLayer {
  id: string;
  product_id: string;
  variant_id: string | null;
  quantity_purchased: number;
  quantity_remaining: number;
  unit_cost: number;
  purchased_at: string;
  purchase_id: string | null;
}

interface ProductWithLayers {
  id: string;
  name: string;
  barcode: string | null;
  stock_quantity: number;
  cost_price: number;
  price: number;
  layers: InventoryLayer[];
}

export default function InventoryLayers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  // Fetch products with their inventory layers
  const { data: products, isLoading } = useQuery({
    queryKey: ['inventory-layers', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('id, name, barcode, stock_quantity, cost_price, price')
        .eq('is_available', true)
        .order('name');

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,barcode.ilike.%${searchTerm}%`);
      }

      const { data: productsData, error: productsError } = await query;
      if (productsError) throw productsError;

      // Fetch layers for each product
      const productsWithLayers = await Promise.all(
        (productsData || []).map(async (product) => {
          const { data: layers, error: layersError } = await supabase
            .from('inventory_layers')
            .select('*')
            .eq('product_id', product.id)
            .is('variant_id', null)
            .gt('quantity_remaining', 0)
            .order('purchased_at', { ascending: true });

          if (layersError) throw layersError;

          return {
            ...product,
            layers: layers || []
          };
        })
      );

      return productsWithLayers as ProductWithLayers[];
    }
  });

  const toggleExpanded = (productId: string) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedProducts(newExpanded);
  };

  const calculateTotalValue = (layers: InventoryLayer[]) => {
    return layers.reduce((sum, layer) => sum + (layer.quantity_remaining * layer.unit_cost), 0);
  };

  const calculateWeightedAvgCost = (layers: InventoryLayer[]) => {
    const totalQty = layers.reduce((sum, layer) => sum + layer.quantity_remaining, 0);
    const totalValue = calculateTotalValue(layers);
    return totalQty > 0 ? totalValue / totalQty : 0;
  };

  const getNextFIFOCost = (layers: InventoryLayer[]) => {
    return layers.length > 0 ? layers[0].unit_cost : 0;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Inventory Layers (FIFO)</h1>
          <p className="text-muted-foreground">
            View detailed cost tracking for each product batch
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Search className="w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search by product name or barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !products || products.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No products found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {products.map((product) => (
                <div key={product.id} className="border rounded-lg">
                  <div
                    className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => toggleExpanded(product.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-0 h-6 w-6"
                        >
                          {expandedProducts.has(product.id) ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </Button>
                        <div>
                          <p className="font-semibold">{product.name}</p>
                          {product.barcode && (
                            <p className="text-sm text-muted-foreground">
                              Barcode: {product.barcode}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Total Stock</p>
                            <p className="font-semibold">{product.stock_quantity}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Next FIFO Cost</p>
                            <p className="font-semibold">
                              {formatCurrency(getNextFIFOCost(product.layers))}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Avg Cost</p>
                            <p className="font-semibold">
                              {formatCurrency(calculateWeightedAvgCost(product.layers))}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Total Value</p>
                            <p className="font-semibold">
                              {formatCurrency(calculateTotalValue(product.layers))}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {expandedProducts.has(product.id) && (
                    <div className="border-t p-4 bg-accent/20">
                      {product.layers.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No inventory layers found
                        </p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Purchased</TableHead>
                              <TableHead>Qty Purchased</TableHead>
                              <TableHead>Qty Remaining</TableHead>
                              <TableHead>Unit Cost</TableHead>
                              <TableHead>Layer Value</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {product.layers.map((layer, index) => (
                              <TableRow key={layer.id}>
                                <TableCell>
                                  {format(new Date(layer.purchased_at), 'MMM dd, yyyy HH:mm')}
                                  {index === 0 && (
                                    <Badge variant="outline" className="ml-2 text-xs">
                                      Next FIFO
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>{layer.quantity_purchased}</TableCell>
                                <TableCell className="font-semibold">
                                  {layer.quantity_remaining}
                                </TableCell>
                                <TableCell>{formatCurrency(layer.unit_cost)}</TableCell>
                                <TableCell className="font-semibold">
                                  {formatCurrency(layer.quantity_remaining * layer.unit_cost)}
                                </TableCell>
                                <TableCell>
                                  {layer.quantity_remaining === layer.quantity_purchased ? (
                                    <Badge variant="default">Full</Badge>
                                  ) : layer.quantity_remaining > 0 ? (
                                    <Badge variant="secondary">Partial</Badge>
                                  ) : (
                                    <Badge variant="outline">Depleted</Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
