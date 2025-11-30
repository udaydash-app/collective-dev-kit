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
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

interface ConvertToPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: any;
}

const currencies = ["USD", "EUR", "INR", "FCFA", "GBP"];
const chargeTypes = [
  { value: "freight", label: "Freight" },
  { value: "clearing", label: "Clearing" },
  { value: "customs", label: "Customs" },
  { value: "handling", label: "Handling" },
  { value: "other", label: "Other" },
];

export function ConvertToPurchaseDialog({
  open,
  onOpenChange,
  purchaseOrder,
}: ConvertToPurchaseDialogProps) {
  const queryClient = useQueryClient();
  const [charges, setCharges] = useState<any[]>([]);
  const [wholesaleMargin, setWholesaleMargin] = useState(20);
  const [retailMargin, setRetailMargin] = useState(50);

  const { data: responses } = useQuery({
    queryKey: ["po-responses", purchaseOrder?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_order_responses")
        .select(`
          *,
          purchase_order_items (
            *,
            products (id, name),
            product_variants (id)
          )
        `)
        .eq("purchase_order_id", purchaseOrder.id);

      if (error) throw error;
      return data;
    },
    enabled: !!purchaseOrder?.id && open,
  });

  useEffect(() => {
    if (open) {
      setCharges([]);
      setWholesaleMargin(20);
      setRetailMargin(50);
    }
  }, [open]);

  const addCharge = () => {
    setCharges([
      ...charges,
      { type: "freight", description: "", amount: 0, currency: "USD" },
    ]);
  };

  const removeCharge = (index: number) => {
    setCharges(charges.filter((_, i) => i !== index));
  };

  const updateCharge = (index: number, field: string, value: any) => {
    const newCharges = [...charges];
    newCharges[index][field] = value;
    setCharges(newCharges);
  };

  const calculateLandedCosts = () => {
    if (!responses || responses.length === 0) return [];

    // Calculate total charge amount (assume same currency for simplicity)
    const totalCharges = charges.reduce((sum, charge) => sum + parseFloat(charge.amount || 0), 0);

    // Calculate total value of all items
    const totalValue = responses.reduce(
      (sum: number, r: any) => sum + r.price * r.purchase_order_items.requested_quantity,
      0
    );

    // Calculate landed cost for each item
    return responses.map((response: any) => {
      const itemValue = response.price * response.purchase_order_items.requested_quantity;
      const itemChargeShare = totalValue > 0 ? (itemValue / totalValue) * totalCharges : 0;
      const landedCostPerUnit = response.price + itemChargeShare / response.purchase_order_items.requested_quantity;
      
      const wholesalePrice = landedCostPerUnit * (1 + wholesaleMargin / 100);
      const retailPrice = landedCostPerUnit * (1 + retailMargin / 100);

      return {
        ...response,
        landedCostPerUnit: landedCostPerUnit.toFixed(2),
        wholesalePrice: wholesalePrice.toFixed(2),
        retailPrice: retailPrice.toFixed(2),
      };
    });
  };

  const convertMutation = useMutation({
    mutationFn: async () => {
      const costData = calculateLandedCosts();

      // Create purchase record
      const { data: purchase, error: purchaseError } = await supabase
        .from("purchases")
        .insert({
          store_id: purchaseOrder.store_id,
          supplier_name: purchaseOrder.supplier_name,
          supplier_contact: purchaseOrder.supplier_email || purchaseOrder.supplier_phone,
          purchased_by: (await supabase.auth.getUser()).data.user?.id,
          payment_status: "pending",
          total_amount: costData.reduce(
            (sum: number, item: any) =>
              sum + parseFloat(item.landedCostPerUnit) * item.purchase_order_items.requested_quantity,
            0
          ),
        })
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      // Create purchase items
      const purchaseItems = costData.map((item: any) => ({
        purchase_id: purchase.id,
        product_id: item.purchase_order_items.products.id,
        variant_id: item.purchase_order_items.product_variants?.id || null,
        quantity: item.purchase_order_items.requested_quantity,
        unit_cost: parseFloat(item.landedCostPerUnit),
        total_cost: parseFloat(item.landedCostPerUnit) * item.purchase_order_items.requested_quantity,
      }));

      const { error: itemsError } = await supabase.from("purchase_items").insert(purchaseItems);
      if (itemsError) throw itemsError;

      // Save charges
      if (charges.length > 0) {
        const { error: chargesError } = await supabase.from("purchase_order_charges").insert(
          charges.map((charge) => ({
            purchase_order_id: purchaseOrder.id,
            charge_type: charge.type,
            description: charge.description,
            amount: parseFloat(charge.amount),
            currency: charge.currency,
          }))
        );
        if (chargesError) throw chargesError;
      }

      // Update product prices
      for (const item of costData) {
        const updateData: any = {
          cost_price: parseFloat(item.landedCostPerUnit),
          wholesale_price: parseFloat(item.wholesalePrice),
          price: parseFloat(item.retailPrice),
        };

        if (item.purchase_order_items.product_variants?.id) {
          await supabase
            .from("product_variants")
            .update(updateData)
            .eq("id", item.purchase_order_items.product_variants.id);
        } else {
          await supabase
            .from("products")
            .update(updateData)
            .eq("id", item.purchase_order_items.products.id);
        }
      }

      // Update PO status to converted
      const { error: statusError } = await supabase
        .from("purchase_orders")
        .update({ status: "converted", updated_at: new Date().toISOString() })
        .eq("id", purchaseOrder.id);

      if (statusError) throw statusError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Successfully converted to purchase and updated prices");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error("Failed to convert: " + error.message);
    },
  });

  const costData = calculateLandedCosts();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convert to Purchase</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Additional Charges Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <Label className="text-lg font-semibold">Additional Charges</Label>
              <Button type="button" variant="outline" size="sm" onClick={addCharge}>
                <Plus className="h-4 w-4 mr-2" />
                Add Charge
              </Button>
            </div>

            {charges.length === 0 ? (
              <Card className="p-4 text-center text-muted-foreground">
                No additional charges. Click "Add Charge" to include freight, customs, etc.
              </Card>
            ) : (
              <div className="space-y-3">
                {charges.map((charge, index) => (
                  <Card key={index} className="p-4">
                    <div className="grid grid-cols-5 gap-3">
                      <Select
                        value={charge.type}
                        onValueChange={(value) => updateCharge(index, "type", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {chargeTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Description"
                        value={charge.description}
                        onChange={(e) => updateCharge(index, "description", e.target.value)}
                        className="col-span-2"
                      />
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Amount"
                        value={charge.amount}
                        onChange={(e) => updateCharge(index, "amount", e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Select
                          value={charge.currency}
                          onValueChange={(value) => updateCharge(index, "currency", value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {currencies.map((curr) => (
                              <SelectItem key={curr} value={curr}>
                                {curr}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCharge(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Margin Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Wholesale Margin (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={wholesaleMargin}
                onChange={(e) => setWholesaleMargin(parseFloat(e.target.value))}
              />
            </div>
            <div>
              <Label>Retail Margin (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={retailMargin}
                onChange={(e) => setRetailMargin(parseFloat(e.target.value))}
              />
            </div>
          </div>

          {/* Cost Preview */}
          <div>
            <Label className="text-lg font-semibold mb-4">Price Calculation Preview</Label>
            <div className="space-y-3">
              {costData.map((item: any) => (
                <Card key={item.id} className="p-4">
                  <p className="font-semibold mb-3">
                    {item.purchase_order_items.products.name}
                    {item.purchase_order_items.variant_name && (
                      <span className="text-muted-foreground ml-2">
                        ({item.purchase_order_items.variant_name})
                      </span>
                    )}
                  </p>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Landed Cost</p>
                      <p className="font-semibold">{item.landedCostPerUnit} {item.currency}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Wholesale Price</p>
                      <p className="font-semibold">{item.wholesalePrice} {item.currency}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Retail Price</p>
                      <p className="font-semibold">{item.retailPrice} {item.currency}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Quantity</p>
                      <p className="font-semibold">{item.purchase_order_items.requested_quantity}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => convertMutation.mutate()} disabled={convertMutation.isPending}>
            {convertMutation.isPending ? "Converting..." : "Convert to Purchase"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}