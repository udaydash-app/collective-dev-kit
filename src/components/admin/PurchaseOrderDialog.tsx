import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Search } from "lucide-react";
import { Card } from "@/components/ui/card";

interface PurchaseOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder?: any;
}

export function PurchaseOrderDialog({
  open,
  onOpenChange,
  purchaseOrder,
}: PurchaseOrderDialogProps) {
  const queryClient = useQueryClient();
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [showProductSearch, setShowProductSearch] = useState(false);

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("is_supplier", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: stores } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("*").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const [selectedStore, setSelectedStore] = useState("");

  const { data: products } = useQuery({
    queryKey: ["products-for-po", productSearch],
    queryFn: async () => {
      if (!productSearch || productSearch.length < 2) return [];
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          product_variants (*)
        `)
        .ilike("name", `%${productSearch}%`)
        .eq("is_available", true)
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: showProductSearch && productSearch.length >= 2,
  });

  useEffect(() => {
    if (purchaseOrder) {
      setSupplierId(purchaseOrder.supplier_id || "");
      setSupplierName(purchaseOrder.supplier_name || "");
      setSupplierEmail(purchaseOrder.supplier_email || "");
      setSupplierPhone(purchaseOrder.supplier_phone || "");
      setValidUntil(purchaseOrder.valid_until || "");
      setNotes(purchaseOrder.notes || "");
      setSelectedStore(purchaseOrder.store_id || "");
      setItems(
        purchaseOrder.purchase_order_items?.map((item: any) => ({
          productId: item.product_id,
          variantId: item.variant_id,
          productName: item.product_name,
          variantName: item.variant_name,
          requestedQuantity: item.requested_quantity,
        })) || []
      );
    } else {
      resetForm();
    }
  }, [purchaseOrder, open]);

  const resetForm = () => {
    setSupplierId("");
    setSupplierName("");
    setSupplierEmail("");
    setSupplierPhone("");
    setValidUntil("");
    setNotes("");
    setItems([]);
    setProductSearch("");
    setSelectedStore(stores?.[0]?.id || "");
  };

  const handleSupplierChange = (id: string) => {
    setSupplierId(id);
    const supplier = suppliers?.find((s) => s.id === id);
    if (supplier) {
      setSupplierName(supplier.name);
      setSupplierEmail(supplier.email || "");
      setSupplierPhone(supplier.phone || "");
    }
  };

  const addProduct = (product: any, variant?: any) => {
    const existing = items.find(
      (i) => i.productId === product.id && i.variantId === variant?.id
    );
    if (existing) {
      toast.error("Product already added");
      return;
    }

    setItems([
      ...items,
      {
        productId: product.id,
        variantId: variant?.id || null,
        productName: product.name,
        variantName: variant?.label || null,
        requestedQuantity: 1,
      },
    ]);
    setProductSearch("");
    setShowProductSearch(false);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateQuantity = (index: number, quantity: number) => {
    const newItems = [...items];
    newItems[index].requestedQuantity = Math.max(1, quantity);
    setItems(newItems);
  };

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (purchaseOrder) {
        // Update
        const { error: poError } = await supabase
          .from("purchase_orders")
          .update({
            supplier_id: data.supplierId || null,
            supplier_name: data.supplierName,
            supplier_email: data.supplierEmail,
            supplier_phone: data.supplierPhone,
            valid_until: data.validUntil || null,
            notes: data.notes,
            store_id: data.storeId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", purchaseOrder.id);

        if (poError) throw poError;

        // Delete existing items
        await supabase
          .from("purchase_order_items")
          .delete()
          .eq("purchase_order_id", purchaseOrder.id);

        // Insert new items
        if (data.items.length > 0) {
          const { error: itemsError } = await supabase.from("purchase_order_items").insert(
            data.items.map((item: any) => ({
              purchase_order_id: purchaseOrder.id,
              product_id: item.productId,
              variant_id: item.variantId,
              product_name: item.productName,
              variant_name: item.variantName,
              requested_quantity: item.requestedQuantity,
            }))
          );
          if (itemsError) throw itemsError;
        }
      } else {
        // Create
        const { data: po, error: poError } = await supabase
          .from("purchase_orders")
          .insert({
            supplier_id: data.supplierId || null,
            supplier_name: data.supplierName,
            supplier_email: data.supplierEmail,
            supplier_phone: data.supplierPhone,
            valid_until: data.validUntil || null,
            notes: data.notes,
            store_id: data.storeId,
            status: "draft",
          })
          .select()
          .single();

        if (poError) throw poError;

        if (data.items.length > 0) {
          const { error: itemsError } = await supabase.from("purchase_order_items").insert(
            data.items.map((item: any) => ({
              purchase_order_id: po.id,
              product_id: item.productId,
              variant_id: item.variantId,
              product_name: item.productName,
              variant_name: item.variantName,
              requested_quantity: item.requestedQuantity,
            }))
          );
          if (itemsError) throw itemsError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success(purchaseOrder ? "Purchase order updated" : "Purchase order created");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error("Failed to save: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!supplierName.trim()) {
      toast.error("Supplier name is required");
      return;
    }

    if (items.length === 0) {
      toast.error("Add at least one product");
      return;
    }

    if (!selectedStore) {
      toast.error("Please select a store");
      return;
    }

    saveMutation.mutate({
      supplierId,
      supplierName,
      supplierEmail,
      supplierPhone,
      validUntil,
      notes,
      items,
      storeId: selectedStore,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {purchaseOrder ? "Edit Purchase Order" : "New Purchase Order"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label>Store *</Label>
              <Select value={selectedStore} onValueChange={setSelectedStore} required>
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

            <div>
              <Label>Select Supplier (Optional)</Label>
              <Select value={supplierId} onValueChange={handleSupplierChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier or enter manually" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers?.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Supplier Name *</Label>
                <Input
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  required
                  placeholder="Enter supplier name"
                />
              </div>
              <div>
                <Label>Supplier Email</Label>
                <Input
                  type="email"
                  value={supplierEmail}
                  onChange={(e) => setSupplierEmail(e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Supplier Phone</Label>
                <Input
                  value={supplierPhone}
                  onChange={(e) => setSupplierPhone(e.target.value)}
                  placeholder="+1234567890"
                />
              </div>
              <div>
                <Label>Valid Until</Label>
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any special instructions or notes..."
                rows={3}
              />
            </div>

            <div>
              <Label>Products *</Label>
              <div className="space-y-2">
                {items.map((item, index) => (
                  <Card key={index} className="p-3 flex items-center gap-3">
                    <div className="flex-1">
                      <p className="font-medium">
                        {item.productName}
                        {item.variantName && (
                          <span className="text-muted-foreground ml-2">({item.variantName})</span>
                        )}
                      </p>
                    </div>
                    <Input
                      type="number"
                      min="1"
                      value={item.requestedQuantity}
                      onChange={(e) => updateQuantity(index, parseInt(e.target.value))}
                      className="w-24"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </Card>
                ))}

                {!showProductSearch ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowProductSearch(true)}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Product
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Search products..."
                        className="pl-9"
                        autoFocus
                      />
                    </div>
                    {products && products.length > 0 && (
                      <Card className="p-2 max-h-48 overflow-y-auto">
                        {products.map((product: any) => (
                          <div key={product.id} className="space-y-1">
                            <Button
                              type="button"
                              variant="ghost"
                              className="w-full justify-start"
                              onClick={() => addProduct(product)}
                            >
                              {product.name}
                            </Button>
                            {product.product_variants?.map((variant: any) => (
                              <Button
                                key={variant.id}
                                type="button"
                                variant="ghost"
                                className="w-full justify-start pl-8 text-sm"
                                onClick={() => addProduct(product, variant)}
                              >
                                {product.name} - {variant.label}
                              </Button>
                            ))}
                          </div>
                        ))}
                      </Card>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}