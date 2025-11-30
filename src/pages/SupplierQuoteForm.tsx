import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { format } from "date-fns";
import { CheckCircle, Package } from "lucide-react";

const currencies = ["USD", "EUR", "INR", "FCFA", "GBP", "JPY", "CNY"];
const weightUnits = ["kg", "lb", "g", "ton"];

export default function SupplierQuoteForm() {
  const { shareToken: rawToken } = useParams();
  const shareToken = rawToken ? decodeURIComponent(rawToken) : undefined;
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});

  const { data: poData, isLoading } = useQuery({
    queryKey: ["public-po", shareToken],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          *,
          purchase_order_items (
            *,
            products (name, image_url, unit),
            product_variants (label, unit)
          )
        `)
        .eq("share_token", shareToken)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!shareToken,
  });

  useEffect(() => {
    if (poData?.purchase_order_items) {
      const initialData: Record<string, any> = {};
      poData.purchase_order_items.forEach((item: any) => {
        initialData[item.id] = {
          cartons: 0,
          bags: 0,
          pieces: 0,
          weight: 0,
          weightUnit: "kg",
          price: "",
          currency: "USD",
          notes: "",
        };
      });
      setFormData(initialData);
    }
  }, [poData]);

  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await supabase.functions.invoke("submit-po-quote", {
        body: data,
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Quote submitted successfully!");
    },
    onError: (error: any) => {
      toast.error("Failed to submit quote: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const items = Object.entries(formData).map(([itemId, data]: [string, any]) => ({
      itemId,
      cartons: parseInt(data.cartons) || 0,
      bags: parseInt(data.bags) || 0,
      pieces: parseInt(data.pieces) || 0,
      weight: parseFloat(data.weight) || 0,
      weightUnit: data.weightUnit,
      price: parseFloat(data.price),
      currency: data.currency,
      notes: data.notes,
    }));

    // Validate at least one item has a price
    if (!items.some(item => item.price > 0)) {
      toast.error("Please provide at least one item price");
      return;
    }

    submitMutation.mutate({ shareToken, items });
  };

  const updateField = (itemId: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value,
      },
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading purchase order...</p>
        </div>
      </div>
    );
  }

  if (!poData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold mb-2">Purchase Order Not Found</h1>
          <p className="text-muted-foreground">
            This purchase order link is invalid or has expired.
          </p>
        </Card>
      </div>
    );
  }

  if (poData.status === "converted" || poData.status === "cancelled") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold mb-2">Purchase Order Closed</h1>
          <p className="text-muted-foreground">
            This purchase order is no longer accepting quotes.
          </p>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Card className="p-8 max-w-md text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Quote Submitted!</h1>
          <p className="text-muted-foreground">
            Thank you for submitting your quote. The buyer will review it and get back to you soon.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Card className="p-8">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Package className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">Supplier Quote Form</h1>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">PO Number:</span>
                <span className="ml-2 font-mono font-semibold">{poData.po_number}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Buyer:</span>
                <span className="ml-2 font-semibold">{poData.supplier_name}</span>
              </div>
              {poData.valid_until && (
                <div>
                  <span className="text-muted-foreground">Valid Until:</span>
                  <span className="ml-2">{format(new Date(poData.valid_until), "PP")}</span>
                </div>
              )}
            </div>
            {poData.notes && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Notes:</p>
                <p>{poData.notes}</p>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {poData.purchase_order_items?.map((item: any, index: number) => (
              <Card key={item.id} className="p-6 border-2">
                <div className="flex items-start gap-4 mb-4">
                  {item.products?.image_url && (
                    <img
                      src={item.products.image_url}
                      alt={item.product_name}
                      className="w-20 h-20 object-cover rounded"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">
                      {index + 1}. {item.product_name}
                      {item.variant_name && (
                        <span className="text-muted-foreground ml-2">({item.variant_name})</span>
                      )}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Requested Quantity: {item.requested_quantity}{" "}
                      {item.variant_name ? item.product_variants?.unit : item.products?.unit}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Cartons</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData[item.id]?.cartons || ""}
                      onChange={(e) => updateField(item.id, "cartons", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Bags</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData[item.id]?.bags || ""}
                      onChange={(e) => updateField(item.id, "bags", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Pieces</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData[item.id]?.pieces || ""}
                      onChange={(e) => updateField(item.id, "pieces", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <Label>Weight</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData[item.id]?.weight || ""}
                        onChange={(e) => updateField(item.id, "weight", e.target.value)}
                        className="flex-1"
                      />
                      <Select
                        value={formData[item.id]?.weightUnit || "kg"}
                        onValueChange={(value) => updateField(item.id, "weightUnit", value)}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {weightUnits.map((unit) => (
                            <SelectItem key={unit} value={unit}>
                              {unit}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Price *</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={formData[item.id]?.price || ""}
                        onChange={(e) => updateField(item.id, "price", e.target.value)}
                        className="flex-1"
                      />
                      <Select
                        value={formData[item.id]?.currency || "USD"}
                        onValueChange={(value) => updateField(item.id, "currency", value)}
                      >
                        <SelectTrigger className="w-24">
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
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <Label>Notes (optional)</Label>
                  <Textarea
                    value={formData[item.id]?.notes || ""}
                    onChange={(e) => updateField(item.id, "notes", e.target.value)}
                    placeholder="Any additional information about this item..."
                    rows={2}
                  />
                </div>
              </Card>
            ))}

            <Button type="submit" size="lg" className="w-full" disabled={submitMutation.isPending}>
              {submitMutation.isPending ? "Submitting..." : "Submit Quote"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}