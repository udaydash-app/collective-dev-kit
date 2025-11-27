import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Search, Package, Info } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { ReturnToPOSButton } from "@/components/layout/ReturnToPOSButton";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface InventoryLayer {
  id: string;
  product_id: string;
  variant_id: string | null;
  quantity_purchased: number;
  quantity_remaining: number;
  unit_cost: number;
  purchased_at: string;
  purchase_id: string | null;
  products: { name: string; barcode: string | null };
}

export default function InventoryLayers() {
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch historical inventory layers for reference
  const { data: layers, isLoading } = useQuery({
    queryKey: ['historical-inventory-layers', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('inventory_layers')
        .select('*, products!inner(name, barcode)')
        .order('purchased_at', { ascending: false })
        .limit(100);

      if (searchTerm) {
        query = query.or(`products.name.ilike.%${searchTerm}%,products.barcode.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as InventoryLayer[];
    }
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Historical Purchase Data</h1>
          <p className="text-muted-foreground">
            View historical purchase cost information (FIFO tracking disabled)
          </p>
        </div>
        <ReturnToPOSButton />
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <p className="font-semibold">System Performance Optimization</p>
            <p>
              FIFO inventory tracking has been disabled for improved performance. This page now shows historical purchase data only.
              Current stock quantities are tracked directly on products for faster transaction processing.
            </p>
          </div>
        </AlertDescription>
      </Alert>

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
          ) : !layers || layers.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No historical purchase data found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Purchased Date</TableHead>
                  <TableHead>Qty Purchased</TableHead>
                  <TableHead>Qty Remaining</TableHead>
                  <TableHead>Unit Cost</TableHead>
                  <TableHead>Layer Value</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {layers.map((layer) => (
                  <TableRow key={layer.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{layer.products.name}</p>
                        {layer.products.barcode && (
                          <p className="text-sm text-muted-foreground">
                            {layer.products.barcode}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(layer.purchased_at), 'MMM dd, yyyy HH:mm')}
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
        </CardContent>
      </Card>
    </div>
  );
}
