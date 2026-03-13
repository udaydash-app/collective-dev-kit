// @ts-nocheck
import { useState } from "react";
import { formatDate } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, Factory, Edit, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ReturnToPOSButton } from "@/components/layout/ReturnToPOSButton";

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
  dbId?: string; // existing DB record id for edits
}

export default function Production() {
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [viewingProduction, setViewingProduction] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteProductionId, setDeleteProductionId] = useState<string | null>(null);

  // Form state (create)
  const [sourceType, setSourceType] = useState<'product' | 'variant'>('product');
  const [sourceId, setSourceId] = useState("");
  const [sourceQuantity, setSourceQuantity] = useState("");
  const [productionDate, setProductionDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState("");
  const [outputs, setOutputs] = useState<OutputItem[]>([]);
  const [sourceOpen, setSourceOpen] = useState(false);

  // Edit form state
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editOutputs, setEditOutputs] = useState<OutputItem[]>([]);

  // Fetch products
  const { data: productsData } = useQuery({
    queryKey: ['products-for-production'],
    queryFn: async (): Promise<any> => {
      const result: any = await supabase
        .from('products')
        .select('id, name, stock_quantity, barcode')
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
        .select(`*, production_outputs(*)`)
        .order('created_at', { ascending: false });
      if (result.error) throw result.error;
      return result.data ?? [];
    },
  });

  // Helper: resolve name from id
  const getItemName = (productId: string | null, variantId: string | null): string => {
    if (variantId) {
      const v = variants.find(x => x.id === variantId);
      return v ? `${v.product?.name} - ${v.label || v.unit}` : variantId;
    }
    if (productId) {
      const p = products.find(x => x.id === productId);
      return p ? p.name : productId;
    }
    return '-';
  };

  // Create production mutation
  const createProductionMutation = useMutation({
    mutationFn: async () => {
      let userId: string | null = null;
      const offlineSessionRaw = localStorage.getItem('offline_pos_session');
      if (offlineSessionRaw) {
        try { userId = JSON.parse(offlineSessionRaw).pos_user_id; } catch {}
      }
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id ?? null;
      }
      if (!userId) throw new Error("Not authenticated");

      const sourceItem = sourceType === 'product'
        ? products.find(p => p.id === sourceId)
        : variants.find(v => v.id === sourceId);

      if (!sourceItem) throw new Error("Source item not found");
      if (sourceItem.stock_quantity < parseFloat(sourceQuantity)) {
        throw new Error(`Insufficient stock. Available: ${sourceItem.stock_quantity}`);
      }

      const { data: production, error: prodError } = await supabase
        .from('productions')
        .insert({
          source_product_id: sourceType === 'product' ? sourceId : null,
          source_variant_id: sourceType === 'variant' ? sourceId : null,
          source_quantity: parseFloat(sourceQuantity),
          production_date: productionDate,
          notes: notes || null,
          created_by: userId,
        })
        .select()
        .single();

      if (prodError) throw prodError;

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

      const newSourceStock = sourceItem.stock_quantity - parseFloat(sourceQuantity);
      if (sourceType === 'product') {
        await supabase.from('products').update({ stock_quantity: newSourceStock }).eq('id', sourceId);
      } else {
        await supabase.from('product_variants').update({ stock_quantity: newSourceStock }).eq('id', sourceId);
      }

      for (const output of outputs) {
        if (output.type === 'product') {
          const product = products.find(p => p.id === output.id);
          if (product) {
            await supabase.from('products').update({ stock_quantity: product.stock_quantity + output.quantity }).eq('id', output.id);
          }
        } else {
          const variant = variants.find(v => v.id === output.id);
          if (variant) {
            await supabase.from('product_variants').update({ stock_quantity: (variant.stock_quantity || 0) + output.quantity }).eq('id', output.id);
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
      resetForm();
      setShowCreateDialog(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create production: ${error.message}`);
    },
  });

  // Update production mutation
  const updateProductionMutation = useMutation({
    mutationFn: async () => {
      const prod = viewingProduction;

      // Update main production record
      const { error: updateError } = await supabase
        .from('productions')
        .update({
          production_date: editDate,
          notes: editNotes || null,
        })
        .eq('id', prod.id);
      if (updateError) throw updateError;

      // Delete existing outputs and re-insert
      const { error: delError } = await supabase
        .from('production_outputs')
        .delete()
        .eq('production_id', prod.id);
      if (delError) throw delError;

      if (editOutputs.length > 0) {
        const outputRecords = editOutputs.map(o => ({
          production_id: prod.id,
          product_id: o.type === 'product' ? o.id : null,
          variant_id: o.type === 'variant' ? o.id : null,
          quantity: o.quantity,
        }));
        const { error: insError } = await supabase
          .from('production_outputs')
          .insert(outputRecords);
        if (insError) throw insError;
      }
    },
    onSuccess: () => {
      toast.success("Production updated successfully");
      queryClient.invalidateQueries({ queryKey: ['productions'] });
      setIsEditing(false);
      setViewingProduction(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update production: ${error.message}`);
    },
  });

  // Delete production mutation
  const deleteProductionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('productions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Production record deleted successfully");
      queryClient.invalidateQueries({ queryKey: ['productions'] });
      queryClient.invalidateQueries({ queryKey: ['products-for-production'] });
      queryClient.invalidateQueries({ queryKey: ['variants-for-production'] });
      setDeleteProductionId(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete production: ${error.message}`);
    },
  });

  const resetForm = () => {
    setSourceType('product');
    setSourceId("");
    setSourceQuantity("");
    setProductionDate(new Date().toISOString().split('T')[0]);
    setNotes("");
    setOutputs([]);
    setSourceOpen(false);
  };

  const addOutput = () => {
    setOutputs([...outputs, { tempId: `temp-${Date.now()}`, type: 'product', id: '', name: '', quantity: 0 }]);
  };

  const updateOutput = (tempId: string, field: keyof OutputItem, value: any) => {
    setOutputs(outputs.map(output => {
      if (output.tempId === tempId) {
        const updated = { ...output, [field]: value };
        if (field === 'id') {
          if (updated.type === 'product') {
            const product = products.find(p => p.id === value);
            if (product) updated.name = product.name;
          } else {
            const variant = variants.find(v => v.id === value);
            if (variant) updated.name = `${variant.product.name} - ${variant.label || variant.unit}`;
          }
        }
        return updated;
      }
      return output;
    }));
  };

  const removeOutput = (tempId: string) => setOutputs(outputs.filter(o => o.tempId !== tempId));

  // Edit outputs helpers
  const addEditOutput = () => {
    setEditOutputs([...editOutputs, { tempId: `temp-${Date.now()}`, type: 'product', id: '', name: '', quantity: 0 }]);
  };

  const updateEditOutput = (tempId: string, field: keyof OutputItem, value: any) => {
    setEditOutputs(editOutputs.map(output => {
      if (output.tempId === tempId) {
        const updated = { ...output, [field]: value };
        if (field === 'id') {
          if (updated.type === 'product') {
            const product = products.find(p => p.id === value);
            if (product) updated.name = product.name;
          } else {
            const variant = variants.find(v => v.id === value);
            if (variant) updated.name = `${variant.product.name} - ${variant.label || variant.unit}`;
          }
        }
        return updated;
      }
      return output;
    }));
  };

  const removeEditOutput = (tempId: string) => setEditOutputs(editOutputs.filter(o => o.tempId !== tempId));

  const openEditMode = () => {
    const prod = viewingProduction;
    setEditDate(prod.production_date?.split('T')[0] || new Date().toISOString().split('T')[0]);
    setEditNotes(prod.notes || '');
    const mappedOutputs: OutputItem[] = (prod.production_outputs || []).map((o: any) => ({
      tempId: o.id,
      dbId: o.id,
      type: o.variant_id ? 'variant' : 'product',
      id: o.variant_id || o.product_id || '',
      name: getItemName(o.product_id, o.variant_id),
      quantity: o.quantity,
    }));
    setEditOutputs(mappedOutputs);
    setIsEditing(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceId) { toast.error("Please select a source product/variant"); return; }
    if (!sourceQuantity || parseFloat(sourceQuantity) <= 0) { toast.error("Please enter a valid source quantity"); return; }
    if (outputs.length === 0) { toast.error("Please add at least one output item"); return; }
    if (outputs.some(o => !o.id || o.quantity <= 0)) { toast.error("Please complete all output items"); return; }
    createProductionMutation.mutate();
  };

  const getSourceOptions = () => sourceType === 'product' ? products : variants;
  const getOutputOptions = (type: 'product' | 'variant') => type === 'product' ? products : variants;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Factory className="w-8 h-8" />
            Production
          </h1>
          <p className="text-muted-foreground mt-1">Convert products/variants into smaller units</p>
        </div>
        <div className="flex items-center gap-2">
          <ReturnToPOSButton />
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Production
          </Button>
        </div>
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
            <p className="text-muted-foreground text-center py-8">No production records found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Production #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Qty Used</TableHead>
                  <TableHead>Outputs</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productions.map((production: any) => (
                  <TableRow key={production.id}>
                    <TableCell className="font-medium">{production.production_number}</TableCell>
                    <TableCell>{formatDate(production.production_date)}</TableCell>
                    <TableCell>
                      {getItemName(production.source_product_id, production.source_variant_id)}
                    </TableCell>
                    <TableCell>{production.source_quantity}</TableCell>
                    <TableCell>{production.production_outputs?.length || 0} items</TableCell>
                    <TableCell className="max-w-xs truncate">{production.notes || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setViewingProduction(production); setIsEditing(false); }}
                          title="View / Edit Details"
                        >
                          <Eye className="w-4 h-4 text-primary" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteProductionId(production.id)}
                          title="Delete Production"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Production Record</DialogTitle>
            <DialogDescription>Convert a product/variant into smaller units</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="production-date">Production Date</Label>
                <Input id="production-date" type="date" value={productionDate} onChange={(e) => setProductionDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source-type">Source Type</Label>
                <Select value={sourceType} onValueChange={(v: any) => { setSourceType(v); setSourceId(""); }}>
                  <SelectTrigger id="source-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product">Product</SelectItem>
                    <SelectItem value="variant">Variant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Source {sourceType === 'product' ? 'Product' : 'Variant'}</Label>
                <Popover open={sourceOpen} onOpenChange={setSourceOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={sourceOpen} className="w-full justify-between">
                      {sourceId
                        ? (() => {
                            const item = getSourceOptions().find((i: any) => i.id === sourceId);
                            return item
                              ? sourceType === 'product'
                                ? `${item.name} (Stock: ${item.stock_quantity})`
                                : `${item.product.name} - ${item.label || item.unit} (Stock: ${item.stock_quantity || 0})`
                              : "Select source";
                          })()
                        : "Select source"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0 bg-popover z-50">
                    <Command>
                      <CommandInput placeholder={`Search ${sourceType}...`} />
                      <CommandEmpty>No {sourceType} found.</CommandEmpty>
                      <CommandGroup className="max-h-64 overflow-auto">
                        {getSourceOptions().map((item: any) => (
                          <CommandItem
                            key={item.id}
                            value={sourceType === 'product' ? item.name : `${item.product.name} ${item.label} ${item.unit}`}
                            onSelect={() => { setSourceId(item.id); setSourceOpen(false); }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", sourceId === item.id ? "opacity-100" : "opacity-0")} />
                            {sourceType === 'product'
                              ? `${item.name} (Stock: ${item.stock_quantity})`
                              : `${item.product.name} - ${item.label || item.unit} (Stock: ${item.stock_quantity || 0})`}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="source-quantity">Quantity to Convert</Label>
                <Input id="source-quantity" type="number" step="0.01" min="0" value={sourceQuantity} onChange={(e) => setSourceQuantity(e.target.value)} placeholder="0.00" required />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Output Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addOutput}>
                  <Plus className="w-4 h-4 mr-1" /> Add Output
                </Button>
              </div>
              <div className="border rounded-lg">
                {outputs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No output items added yet</p>
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
                            <Select value={output.type} onValueChange={(v: any) => updateOutput(output.tempId, 'type', v)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="product">Product</SelectItem>
                                <SelectItem value="variant">Variant</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select value={output.id} onValueChange={(v) => updateOutput(output.tempId, 'id', v)}>
                              <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                              <SelectContent>
                                {getOutputOptions(output.type).map((item: any) => (
                                  <SelectItem key={item.id} value={item.id}>
                                    {output.type === 'product' ? item.name : `${item.product.name} - ${item.label || item.unit}`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input type="number" step="0.01" min="0" value={output.quantity || ''} onChange={(e) => updateOutput(output.tempId, 'quantity', parseFloat(e.target.value) || 0)} placeholder="0.00" />
                          </TableCell>
                          <TableCell>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeOutput(output.tempId)}>
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
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add any notes about this production..." rows={3} />
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={createProductionMutation.isPending}>
                {createProductionMutation.isPending ? "Creating..." : "Create Production"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View / Edit Details Dialog */}
      <Dialog open={!!viewingProduction} onOpenChange={(open) => { if (!open) { setViewingProduction(null); setIsEditing(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Production" : "Production Details"}</DialogTitle>
            <DialogDescription>{viewingProduction?.production_number}</DialogDescription>
          </DialogHeader>

          {viewingProduction && !isEditing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Production Number</p>
                  <p className="font-medium mt-1">{viewingProduction.production_number}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Date</p>
                  <p className="font-medium mt-1">{formatDate(viewingProduction.production_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Source</p>
                  <p className="font-medium mt-1">
                    {getItemName(viewingProduction.source_product_id, viewingProduction.source_variant_id)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Quantity Used</p>
                  <p className="font-medium mt-1">{viewingProduction.source_quantity}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Status</p>
                  <p className="font-medium mt-1 capitalize">{viewingProduction.status || 'completed'}</p>
                </div>
              </div>

              {viewingProduction.notes && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Notes</p>
                  <p className="mt-1 text-sm border rounded-md p-3 bg-muted/40">{viewingProduction.notes}</p>
                </div>
              )}

              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Output Items</p>
                {viewingProduction.production_outputs?.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Quantity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingProduction.production_outputs.map((output: any) => (
                        <TableRow key={output.id}>
                          <TableCell className="capitalize">{output.variant_id ? 'Variant' : 'Product'}</TableCell>
                          <TableCell>{getItemName(output.product_id, output.variant_id)}</TableCell>
                          <TableCell>{output.quantity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground text-sm">No output items</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setViewingProduction(null)}>Close</Button>
                <Button onClick={openEditMode}>
                  <Edit className="w-4 h-4 mr-2" /> Edit
                </Button>
              </div>
            </div>
          )}

          {viewingProduction && isEditing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Production Date</Label>
                  <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Source (read-only)</p>
                  <p className="font-medium mt-2 text-sm">
                    {getItemName(viewingProduction.source_product_id, viewingProduction.source_variant_id)}
                    {' — '}{viewingProduction.source_quantity} units
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Add any notes..." rows={3} />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Output Items</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addEditOutput}>
                    <Plus className="w-4 h-4 mr-1" /> Add Output
                  </Button>
                </div>
                <div className="border rounded-lg">
                  {editOutputs.length === 0 ? (
                    <p className="text-muted-foreground text-center py-6">No output items</p>
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
                        {editOutputs.map((output) => (
                          <TableRow key={output.tempId}>
                            <TableCell>
                              <Select value={output.type} onValueChange={(v: any) => updateEditOutput(output.tempId, 'type', v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="product">Product</SelectItem>
                                  <SelectItem value="variant">Variant</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select value={output.id} onValueChange={(v) => updateEditOutput(output.tempId, 'id', v)}>
                                <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                                <SelectContent>
                                  {getOutputOptions(output.type).map((item: any) => (
                                    <SelectItem key={item.id} value={item.id}>
                                      {output.type === 'product' ? item.name : `${item.product.name} - ${item.label || item.unit}`}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input type="number" step="0.01" min="0" value={output.quantity || ''} onChange={(e) => updateEditOutput(output.tempId, 'quantity', parseFloat(e.target.value) || 0)} placeholder="0.00" />
                            </TableCell>
                            <TableCell>
                              <Button type="button" variant="ghost" size="icon" onClick={() => removeEditOutput(output.tempId)}>
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

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                <Button onClick={() => updateProductionMutation.mutate()} disabled={updateProductionMutation.isPending}>
                  {updateProductionMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteProductionId} onOpenChange={() => setDeleteProductionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Production Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this production record? This action cannot be undone. Note: This will not restore the stock quantities.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteProductionId) deleteProductionMutation.mutate(deleteProductionId); }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, Factory, Edit } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ReturnToPOSButton } from "@/components/layout/ReturnToPOSButton";

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
  const [editingProduction, setEditingProduction] = useState<any>(null);
  const [viewingProduction, setViewingProduction] = useState<any>(null);
  const [deleteProductionId, setDeleteProductionId] = useState<string | null>(null);
  
  // Form state
  const [sourceType, setSourceType] = useState<'product' | 'variant'>('product');
  const [sourceId, setSourceId] = useState("");
  const [sourceQuantity, setSourceQuantity] = useState("");
  const [productionDate, setProductionDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState("");
  const [outputs, setOutputs] = useState<OutputItem[]>([]);
  const [sourceOpen, setSourceOpen] = useState(false);

  // Fetch products
  const { data: productsData } = useQuery({
    queryKey: ['products-for-production'],
    queryFn: async (): Promise<any> => {
      const result: any = await supabase
        .from('products')
        .select('id, name, stock_quantity, barcode')
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
      // Support both online auth users and offline/POS sessions
      let userId: string | null = null;
      const offlineSessionRaw = localStorage.getItem('offline_pos_session');
      if (offlineSessionRaw) {
        try { userId = JSON.parse(offlineSessionRaw).pos_user_id; } catch {}
      }
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id ?? null;
      }
      if (!userId) throw new Error("Not authenticated");

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
          created_by: userId,
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

  // Delete production mutation
  const deleteProductionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('productions')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Production record deleted successfully");
      queryClient.invalidateQueries({ queryKey: ['productions'] });
      queryClient.invalidateQueries({ queryKey: ['products-for-production'] });
      queryClient.invalidateQueries({ queryKey: ['variants-for-production'] });
      setDeleteProductionId(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete production: ${error.message}`);
    },
  });

  const resetForm = () => {
    setSourceType('product');
    setSourceId("");
    setSourceQuantity("");
    setProductionDate(new Date().toISOString().split('T')[0]);
    setNotes("");
    setOutputs([]);
    setSourceOpen(false);
    setEditingProduction(null);
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
        <div className="flex items-center gap-2">
          <ReturnToPOSButton />
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Production
          </Button>
        </div>
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
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productions.map((production: any) => (
                  <TableRow key={production.id}>
                    <TableCell className="font-medium">
                      {production.production_number}
                    </TableCell>
                    <TableCell>
                      {formatDate(production.production_date)}
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
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setViewingProduction(production)}
                          title="View Details"
                        >
                          <Edit className="w-4 h-4 text-primary" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteProductionId(production.id)}
                          title="Delete Production"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
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
                <Popover open={sourceOpen} onOpenChange={setSourceOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={sourceOpen}
                      className="w-full justify-between"
                    >
                      {sourceId
                        ? (() => {
                            const item = getSourceOptions().find((i: any) => i.id === sourceId);
                            return item
                              ? sourceType === 'product'
                                ? `${item.name} (Stock: ${item.stock_quantity})`
                                : `${item.product.name} - ${item.label || item.unit} (Stock: ${item.stock_quantity || 0})`
                              : "Select source";
                          })()
                        : "Select source"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0 bg-popover z-50">
                    <Command>
                      <CommandInput placeholder={`Search ${sourceType}...`} />
                      <CommandEmpty>No {sourceType} found.</CommandEmpty>
                      <CommandGroup className="max-h-64 overflow-auto">
                        {getSourceOptions().map((item: any) => (
                          <CommandItem
                            key={item.id}
                            value={sourceType === 'product' ? item.name : `${item.product.name} ${item.label} ${item.unit}`}
                            onSelect={() => {
                              setSourceId(item.id);
                              setSourceOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                sourceId === item.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {sourceType === 'product'
                              ? `${item.name} (Stock: ${item.stock_quantity})`
                              : `${item.product.name} - ${item.label || item.unit} (Stock: ${item.stock_quantity || 0})`
                            }
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
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

      {/* View Details Dialog */}
      <Dialog open={!!viewingProduction} onOpenChange={() => setViewingProduction(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Production Details</DialogTitle>
            <DialogDescription>
              {viewingProduction?.production_number}
            </DialogDescription>
          </DialogHeader>

          {viewingProduction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs uppercase tracking-wide">Production Number</Label>
                  <p className="font-medium mt-1">{viewingProduction.production_number}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs uppercase tracking-wide">Date</Label>
                  <p className="font-medium mt-1">{formatDate(viewingProduction.production_date)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs uppercase tracking-wide">Source Type</Label>
                  <p className="font-medium mt-1">{viewingProduction.source_product_id ? 'Product' : 'Variant'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs uppercase tracking-wide">Quantity Used</Label>
                  <p className="font-medium mt-1">{viewingProduction.source_quantity}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs uppercase tracking-wide">Source ID</Label>
                  <p className="font-medium mt-1 text-xs text-muted-foreground break-all">
                    {viewingProduction.source_product_id || viewingProduction.source_variant_id || '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs uppercase tracking-wide">Status</Label>
                  <p className="font-medium mt-1 capitalize">{viewingProduction.status || 'completed'}</p>
                </div>
              </div>

              {viewingProduction.notes && (
                <div>
                  <Label className="text-muted-foreground text-xs uppercase tracking-wide">Notes</Label>
                  <p className="mt-1 text-sm border rounded-md p-3 bg-muted/40">{viewingProduction.notes}</p>
                </div>
              )}

              <div>
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Output Items</Label>
                {viewingProduction.production_outputs?.length > 0 ? (
                  <Table className="mt-2">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Item ID</TableHead>
                        <TableHead>Quantity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingProduction.production_outputs.map((output: any) => (
                        <TableRow key={output.id}>
                          <TableCell className="capitalize">
                            {output.variant_id ? 'Variant' : 'Product'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {output.product_id || output.variant_id || '-'}
                          </TableCell>
                          <TableCell>{output.quantity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground text-sm mt-1">No output items</p>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={() => setViewingProduction(null)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteProductionId} onOpenChange={() => setDeleteProductionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Production Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this production record? This action cannot be undone.
              Note: This will not restore the stock quantities.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteProductionId) {
                  deleteProductionMutation.mutate(deleteProductionId);
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
