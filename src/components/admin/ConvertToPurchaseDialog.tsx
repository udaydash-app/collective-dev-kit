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
  const [exchangeRate, setExchangeRate] = useState(1);

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
      setExchangeRate(1);
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

    // Convert all charges to base currency (FCFA)
    const totalCharges = charges.reduce(
      (sum, charge) => {
        const amount = parseFloat(charge.amount || 0);
        const convertedAmount = charge.currency === 'FCFA' ? amount : amount * exchangeRate;
        return sum + convertedAmount;
      },
      0
    );

    // Calculate total weight of all items
    const totalWeight = responses.reduce(
      (sum: number, response: any) => sum + (response.weight || 0),
      0
    );

    // Calculate charges per kg
    const chargesPerKg = totalWeight > 0 ? totalCharges / totalWeight : 0;

    console.log('Total charges:', totalCharges);
    console.log('Total weight:', totalWeight);
    console.log('Charges per kg:', chargesPerKg);

    return responses.map((item: any) => {
      const cartons = item.cartons || 0;
      const totalPieces = item.pieces || 0;
      const piecesPerCarton = cartons > 0 ? totalPieces / cartons : 0;
      const pricePerCarton = item.price;
      const weightPerCarton = cartons > 0 ? (item.weight || 0) / cartons : 0;
      
      // Base cost = (total price / total pieces) × exchange rate
      const totalPrice = cartons * pricePerCarton;
      const baseCostPerPiece = totalPieces > 0 ? (totalPrice / totalPieces) * exchangeRate : 0;
      
      // Additional charges per piece:
      // 1. charges per kg × weight per carton = charges per carton
      const chargesPerCarton = chargesPerKg * weightPerCarton;
      // 2. charges per carton / pcs in carton = charges per piece
      const chargePerPiece = piecesPerCarton > 0 ? chargesPerCarton / piecesPerCarton : 0;
      
      console.log(`Item: ${item.purchase_order_items?.products?.name}`);
      console.log('  Base cost per piece:', baseCostPerPiece);
      console.log('  Charge per piece:', chargePerPiece);
      console.log('  Weight per carton:', weightPerCarton);
      console.log('  Charges per carton:', chargesPerCarton);
      console.log('  Pieces per carton:', piecesPerCarton);
      
      // Landed cost = base cost + additional charges per piece
      const landedCostPerUnit = baseCostPerPiece + chargePerPiece;
      
      const wholesalePrice = landedCostPerUnit * (1 + wholesaleMargin / 100);
      const retailPrice = landedCostPerUnit * (1 + retailMargin / 100);

      return {
        ...item,
        landedCostPerUnit,
        wholesalePrice,
        retailPrice,
        totalPieces,
        totalLandedCost: landedCostPerUnit * totalPieces,
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
              sum + item.landedCostPerUnit * item.totalPieces,
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
        quantity: item.totalPieces,
        unit_cost: item.landedCostPerUnit,
        total_cost: item.landedCostPerUnit * item.totalPieces,
      }));

      const { error: itemsError } = await supabase.from("purchase_items").insert(purchaseItems);
      if (itemsError) throw itemsError;

      // Save charges (converted to base currency)
      if (charges.length > 0) {
        const { error: chargesError } = await supabase.from("purchase_order_charges").insert(
          charges.map((charge) => ({
            purchase_order_id: purchaseOrder.id,
            charge_type: charge.type,
            description: charge.description,
            amount: charge.currency === 'FCFA' 
              ? parseFloat(charge.amount) 
              : parseFloat(charge.amount) * exchangeRate,
            currency: "FCFA",
          }))
        );
        if (chargesError) throw chargesError;
      }

      // Update product prices
      for (const item of costData) {
        const updateData: any = {
          cost_price: item.landedCostPerUnit,
          wholesale_price: item.wholesalePrice,
          price: item.retailPrice,
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
      <DialogContent className="max-w-[95vw] w-full max-h-[95vh] overflow-y-auto">
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

          {/* Exchange Rate and Margin Settings */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Exchange Rate to FCFA</Label>
              <Input
                type="number"
                step="0.01"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1)}
                placeholder="1.00"
              />
              <p className="text-xs text-muted-foreground mt-1">
                1 {responses?.[0]?.currency || "USD"} = {exchangeRate} FCFA
              </p>
            </div>
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

          {/* Cost Preview Table */}
          <div>
            <Label className="text-lg font-semibold mb-4">Price Calculation Preview</Label>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted">
                    <th className="text-left p-4 font-semibold text-base">Product Name</th>
                    <th className="text-right p-4 font-semibold text-base">Quantity</th>
                    <th className="text-right p-4 font-semibold text-base">Landed Cost/pcs</th>
                    <th className="text-right p-4 font-semibold text-base">Wholesale Price/pcs</th>
                    <th className="text-right p-4 font-semibold text-base">Retail Price/pcs</th>
                    <th className="text-right p-4 font-semibold text-base">Total (Landed)</th>
                  </tr>
                </thead>
                <tbody>
                  {costData.map((item: any, index: number) => (
                    <tr key={item.id} className={index % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                      <td className="p-4 text-base">
                        <div className="font-medium">
                          {item.purchase_order_items.products.name}
                          {item.purchase_order_items.variant_name && (
                            <span className="text-muted-foreground text-sm ml-2">
                              ({item.purchase_order_items.variant_name})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right text-base font-medium">
                        {item.totalPieces}
                      </td>
                      <td className="p-4 text-right text-base font-medium">
                        {item.landedCostPerUnit.toFixed(2)} FCFA
                      </td>
                      <td className="p-4 text-right text-base font-medium">
                        {item.wholesalePrice.toFixed(2)} FCFA
                      </td>
                      <td className="p-4 text-right text-base font-medium">
                        {item.retailPrice.toFixed(2)} FCFA
                      </td>
                      <td className="p-4 text-right text-base font-semibold">
                        {item.totalLandedCost.toFixed(2)} FCFA
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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