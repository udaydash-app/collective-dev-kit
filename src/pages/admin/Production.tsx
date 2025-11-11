// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, Factory } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ProductOption {
  id: string;
  name: string;
  stock_quantity: number;
  barcode?: string;
}

interface VariantOption {
  id: string;
  product_id: string;
  label: string | null;
  unit: string;
  stock_quantity: number | null;
  barcode: string | null;
  product: {
    name: string;
  };
}

interface OutputItem {
  tempId: string;
  type: 'product' | 'variant';
  id: string;
  name: string;
  quantity: number;
}

export default function Production() {
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  // Form state
  const [sourceType, setSourceType] = useState<'product' | 'variant'>('product');
  const [sourceId, setSourceId] = useState("");
  const [sourceQuantity, setSourceQuantity] = useState("");
  const [productionDate, setProductionDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState("");
  const [outputs, setOutputs] = useState<OutputItem[]>([]);

  // Fetch products
  const { data: productsData } = useQuery({
    queryKey: ['products-for-production'],
    queryFn: async (): Promise<any> => {
      const result: any = await supabase
        .from('products')
        .select('id, name, stock_quantity, barcode')
        .eq('is_active', true)
        .order('name');
      
      if (result.error) throw result.error;
      return result.data ?? [];
    },
  });
  
  const products = (productsData || []) as ProductOption[];

  // Fetch variants
  const { data: variantsData } = useQuery({
    queryKey: ['variants-for-production'],
    queryFn: async (): Promise<any> => {
      const result: any = await supabase
        .from('product_variants')
        .select('id, product_id, label, unit, stock_quantity, barcode, products(name)')
        .order('unit');
      
      if (result.error) throw result.error;
      return result.data ?? [];
    },
  });
  
  const variants = ((variantsData || []).map((v: any) => ({
    ...v,
    product: Array.isArray(v.products) ? v.products[0] : v.products
  }))) as VariantOption[];

  // Fetch production records
  const { data: productions = [], isLoading } = useQuery({
    queryKey: ['productions'],
    queryFn: async (): Promise<any> => {
      const result: any = await supabase
        .from('productions')
        .select(`
          *,
          production_outputs(*)
        `)
        .order('created_at', { ascending: false });
      
      if (result.error) throw result.error;
      return result.data ?? [];
    },
  });

  // Create production mutation
  const createProductionMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Validate source has enough stock
      const sourceItem = sourceType === 'product' 
        ? products.find(p => p.id === sourceId)
        : variants.find(v => v.id === sourceId);
      
      if (!sourceItem) throw new Error("Source item not found");
      if (sourceItem.stock_quantity < parseFloat(sourceQuantity)) {
        throw new Error(`Insufficient stock. Available: ${sourceItem.stock_quantity}`);
      }

      // Create production record
      const { data: production, error: prodError } = await supabase
        .from('productions')
        .insert({
          source_product_id: sourceType === 'product' ? sourceId : null,
          source_variant_id: sourceType === 'variant' ? sourceId : null,
          source_quantity: parseFloat(sourceQuantity),
          production_date: productionDate,
          notes: notes || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (prodError) throw prodError;

      // Insert production outputs
      const outputRecords = outputs.map(output => ({
        production_id: production.id,
        product_id: output.type === 'product' ? output.id : null,
        variant_id: output.type === 'variant' ? output.id : null,
        quantity: output.quantity,
      }));

      const { error: outputError } = await supabase
        .from('production_outputs')
        .insert(outputRecords);

      if (outputError) throw outputError;

      // Deduct stock from source
      const newSourceStock = sourceItem.stock_quantity - parseFloat(sourceQuantity);
      if (sourceType === 'product') {
        const { error: updateError } = await supabase
          .from('products')
          .update({ stock_quantity: newSourceStock })
          .eq('id', sourceId);
        if (updateError) throw updateError;
      } else {
        const { error: updateError } = await supabase
          .from('product_variants')
          .update({ stock_quantity: newSourceStock })
          .eq('id', sourceId);
        if (updateError) throw updateError;
      }

      // Add stock to outputs
      for (const output of outputs) {
        if (output.type === 'product') {
          const product = products.find(p => p.id === output.id);
          if (product) {
            const { error: updateError } = await supabase
              .from('products')
              .update({ stock_quantity: product.stock_quantity + output.quantity })
              .eq('id', output.id);
            if (updateError) throw updateError;
          }
        } else {
          const variant = variants.find(v => v.id === output.id);
          if (variant) {
            const { error: updateError } = await supabase
              .from('product_variants')
              .update({ stock_quantity: variant.stock_quantity + output.quantity })
              .eq('id', output.id);
            if (updateError) throw updateError;
          }
        }
      }

      return production;
    },
    onSuccess: () => {
      toast.success("Production record created successfully");
      queryClient.invalidateQueries({ queryKey: ['productions'] });
      queryClient.invalidateQueries({ queryKey: ['products-for-production'] });
      queryClient.invalidateQueries({ queryKey: ['variants-for-production'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-variants'] });
      resetForm();
      setShowCreateDialog(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create production: ${error.message}`);
    },
  });

  const resetForm = () => {
    setSourceType('product');
    setSourceId("");
    setSourceQuantity("");
    setProductionDate(new Date().toISOString().split('T')[0]);
    setNotes("");
    setOutputs([]);
  };

  const addOutput = () => {
    setOutputs([...outputs, {
      tempId: `temp-${Date.now()}`,
      type: 'product',
      id: '',
      name: '',
      quantity: 0,
    }]);
  };

  const updateOutput = (tempId: string, field: keyof OutputItem, value: any) => {
    setOutputs(outputs.map(output => {
      if (output.tempId === tempId) {
        const updated = { ...output, [field]: value };
        
        // Update name when ID changes
        if (field === 'id') {
          if (updated.type === 'product') {
            const product = products.find(p => p.id === value);
            if (product) {
              updated.name = product.name;
            }
          } else {
            const variant = variants.find(v => v.id === value);
            if (variant) {
              updated.name = `${variant.product.name} - ${variant.label || variant.unit}`;
            }
          }
        }
        
        return updated;
      }
      return output;
    }));
  };

  const removeOutput = (tempId: string) => {
    setOutputs(outputs.filter(o => o.tempId !== tempId));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sourceId) {
      toast.error("Please select a source product/variant");
      return;
    }
    
    if (!sourceQuantity || parseFloat(sourceQuantity) <= 0) {
      toast.error("Please enter a valid source quantity");
      return;
    }
    
    if (outputs.length === 0) {
      toast.error("Please add at least one output item");
      return;
    }
    
    if (outputs.some(o => !o.id || o.quantity <= 0)) {
      toast.error("Please complete all output items");
      return;
    }
    
    createProductionMutation.mutate();
  };

  const getSourceOptions = () => {
    return sourceType === 'product' ? products : variants;
  };

  const getOutputOptions = (type: 'product' | 'variant') => {
    return type === 'product' ? products : variants;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Factory className="w-8 h-8" />
            Production
          </h1>
          <p className="text-muted-foreground mt-1">
            Convert products/variants into smaller units
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Production
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Production History</CardTitle>
          <CardDescription>View all production records</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading...</p>
          ) : productions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No production records found
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Production #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Quantity Used</TableHead>
                  <TableHead>Outputs</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productions.map((production: any) => (
                  <TableRow key={production.id}>
                    <TableCell className="font-medium">
                      {production.production_number}
                    </TableCell>
                    <TableCell>
                      {new Date(production.production_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {production.source_product_id ? 'Product' : 'Variant'}
                    </TableCell>
                    <TableCell>{production.source_quantity}</TableCell>
                    <TableCell>
                      {production.production_outputs?.length || 0} items
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {production.notes || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Production Record</DialogTitle>
            <DialogDescription>
              Convert a product/variant into smaller units
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="production-date">Production Date</Label>
                <Input
                  id="production-date"
                  type="date"
                  value={productionDate}
                  onChange={(e) => setProductionDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="source-type">Source Type</Label>
                <Select value={sourceType} onValueChange={(v: any) => {
                  setSourceType(v);
                  setSourceId("");
                }}>
                  <SelectTrigger id="source-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product">Product</SelectItem>
                    <SelectItem value="variant">Variant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="source">Source {sourceType === 'product' ? 'Product' : 'Variant'}</Label>
                <Select value={sourceId} onValueChange={setSourceId}>
                  <SelectTrigger id="source">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {getSourceOptions().map((item: any) => (
                      <SelectItem key={item.id} value={item.id}>
                        {sourceType === 'product' 
                          ? `${item.name} (Stock: ${item.stock_quantity})`
                          : `${item.product.name} - ${item.label || item.unit} (Stock: ${item.stock_quantity || 0})`
                        }
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="source-quantity">Quantity to Convert</Label>
                <Input
                  id="source-quantity"
                  type="number"
                  step="0.01"
                  min="0"
                  value={sourceQuantity}
                  onChange={(e) => setSourceQuantity(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Output Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addOutput}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Output
                </Button>
              </div>

              <div className="border rounded-lg">
                {outputs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No output items added yet
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {outputs.map((output) => (
                        <TableRow key={output.tempId}>
                          <TableCell>
                            <Select
                              value={output.type}
                              onValueChange={(v: any) => updateOutput(output.tempId, 'type', v)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="product">Product</SelectItem>
                                <SelectItem value="variant">Variant</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={output.id}
                              onValueChange={(v) => updateOutput(output.tempId, 'id', v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select item" />
                              </SelectTrigger>
                              <SelectContent>
                                {getOutputOptions(output.type).map((item: any) => (
                                  <SelectItem key={item.id} value={item.id}>
                                    {output.type === 'product'
                                      ? item.name
                                      : `${item.product.name} - ${item.label || item.unit}`
                                    }
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={output.quantity || ''}
                              onChange={(e) => updateOutput(output.tempId, 'quantity', parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeOutput(output.tempId)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this production..."
                rows={3}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createProductionMutation.isPending}
              >
                {createProductionMutation.isPending ? "Creating..." : "Create Production"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
