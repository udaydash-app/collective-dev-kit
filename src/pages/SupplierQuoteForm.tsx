import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import { CheckCircle, Package } from "lucide-react";

const currencies = ["USD", "EUR", "INR", "FCFA", "GBP", "JPY", "CNY"];

export default function SupplierQuoteForm() {
  const { shareToken } = useParams();
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Log component mount
  useEffect(() => {
    console.log("SupplierQuoteForm mounted with shareToken:", shareToken);
  }, [shareToken]);

  const { data: poData, isLoading, error: queryError } = useQuery({
    queryKey: ["public-po", shareToken],
    queryFn: async () => {
      console.log("Fetching PO with share token:", shareToken);
      
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
        .maybeSingle();

      console.log("PO Query result:", { data, error });

      if (error) throw error;
      return data;
    },
    enabled: !!shareToken,
  });

  // Log query state for debugging
  console.log("SupplierQuoteForm state:", { 
    shareToken, 
    isLoading, 
    hasData: !!poData, 
    queryError: queryError?.message 
  });

  // Fetch existing responses if any
  const { data: existingResponses } = useQuery({
    queryKey: ["po-responses", poData?.id],
    queryFn: async () => {
      if (!poData?.id) return null;
      
      const { data, error } = await supabase
        .from("purchase_order_responses")
        .select("*")
        .eq("purchase_order_id", poData.id);

      if (error) throw error;
      return data;
    },
    enabled: !!poData?.id,
  });

  useEffect(() => {
    if (poData?.purchase_order_items) {
      const initialData: Record<string, any> = {};
      
      poData.purchase_order_items.forEach((item: any) => {
        // Check if there's an existing response for this item
        const existingResponse = existingResponses?.find((r: any) => r.item_id === item.id);
        
        if (existingResponse) {
          // Pre-populate with existing data
          initialData[item.id] = {
            noOfCarton: existingResponse.cartons || "",
            pcsInCarton: existingResponse.pieces && existingResponse.cartons 
              ? Math.round(existingResponse.pieces / existingResponse.cartons) 
              : "",
            pricePerCarton: existingResponse.price || "",
            currency: existingResponse.currency || "USD",
          };
        } else {
          // Empty form
          initialData[item.id] = {
            noOfCarton: "",
            pcsInCarton: "",
            pricePerCarton: "",
            currency: "USD",
          };
        }
      });
      setFormData(initialData);
    }
  }, [poData, existingResponses]);

  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await supabase.functions.invoke("submit-po-quote", {
        body: { ...data, isDraft: false },
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

  const saveDraftMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await supabase.functions.invoke("submit-po-quote", {
        body: { ...data, isDraft: true },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      toast.success("Draft saved successfully!");
    },
    onError: (error: any) => {
      toast.error("Failed to save draft: " + error.message);
    },
  });

  const calculateTotalPcs = (noOfCarton: string, pcsInCarton: string) => {
    const cartons = parseInt(noOfCarton) || 0;
    const pcs = parseInt(pcsInCarton) || 0;
    return cartons * pcs;
  };

  const calculateTotalPrice = (noOfCarton: string, pricePerCarton: string) => {
    const cartons = parseInt(noOfCarton) || 0;
    const price = parseFloat(pricePerCarton) || 0;
    return (cartons * price).toFixed(2);
  };

  const handleSaveDraft = () => {
    const items = Object.entries(formData).map(([itemId, data]: [string, any]) => {
      const totalPcs = calculateTotalPcs(data.noOfCarton, data.pcsInCarton);
      return {
        itemId,
        cartons: parseInt(data.noOfCarton) || 0,
        pieces: totalPcs,
        price: parseFloat(data.pricePerCarton) || 0,
        currency: data.currency,
      };
    });

    saveDraftMutation.mutate({ shareToken, items });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const items = Object.entries(formData).map(([itemId, data]: [string, any]) => {
      const totalPcs = calculateTotalPcs(data.noOfCarton, data.pcsInCarton);
      return {
        itemId,
        cartons: parseInt(data.noOfCarton) || 0,
        pieces: totalPcs,
        price: parseFloat(data.pricePerCarton) || 0,
        currency: data.currency,
      };
    });

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

  // Early return if no share token
  if (!shareToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Card className="p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold mb-2 text-destructive">Invalid Link</h1>
          <p className="text-muted-foreground">
            No share token provided in the URL.
          </p>
        </Card>
      </div>
    );
  }

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

  if (queryError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold mb-2 text-destructive">Error Loading Purchase Order</h1>
          <p className="text-muted-foreground mb-4">
            {queryError.message || "An error occurred while loading the purchase order."}
          </p>
          <p className="text-sm text-muted-foreground">
            Share Token: {shareToken || "missing"}
          </p>
        </Card>
      </div>
    );
  }

  if (!poData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold mb-2">Purchase Order Not Found</h1>
          <p className="text-muted-foreground mb-4">
            This purchase order link is invalid or has expired.
          </p>
          <p className="text-sm text-muted-foreground">
            Share Token: {shareToken || "missing"}
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
              {existingResponses && existingResponses.length > 0 && (
                <Badge variant="secondary" className="ml-auto">
                  Draft Saved
                </Badge>
              )}
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

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Product Name</TableHead>
                    <TableHead className="font-semibold w-32">No of Carton</TableHead>
                    <TableHead className="font-semibold w-32">Pcs in Carton</TableHead>
                    <TableHead className="font-semibold w-32">Total Pcs</TableHead>
                    <TableHead className="font-semibold w-40">Price per Carton</TableHead>
                    <TableHead className="font-semibold w-40">Total Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {poData.purchase_order_items?.map((item: any) => {
                    const itemData = formData[item.id] || {};
                    const totalPcs = calculateTotalPcs(itemData.noOfCarton, itemData.pcsInCarton);
                    const totalPrice = calculateTotalPrice(itemData.noOfCarton, itemData.pricePerCarton);
                    
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {item.products?.image_url && (
                              <img
                                src={item.products.image_url}
                                alt={item.product_name}
                                className="w-12 h-12 object-cover rounded"
                              />
                            )}
                            <div>
                              <p className="font-medium">{item.product_name}</p>
                              {item.variant_name && (
                                <p className="text-sm text-muted-foreground">({item.variant_name})</p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                Requested: {item.requested_quantity}{" "}
                                {item.variant_name ? item.product_variants?.unit : item.products?.unit}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={itemData.noOfCarton || ""}
                            onChange={(e) => updateField(item.id, "noOfCarton", e.target.value)}
                            className="w-full"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={itemData.pcsInCarton || ""}
                            onChange={(e) => updateField(item.id, "pcsInCarton", e.target.value)}
                            className="w-full"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center h-10 px-3 bg-muted rounded-md">
                            <span className="font-medium">{totalPcs}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              required
                              value={itemData.pricePerCarton || ""}
                              onChange={(e) => updateField(item.id, "pricePerCarton", e.target.value)}
                              className="flex-1"
                            />
                            <select
                              value={itemData.currency || "USD"}
                              onChange={(e) => updateField(item.id, "currency", e.target.value)}
                              className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm"
                            >
                              {currencies.map((curr) => (
                                <option key={curr} value={curr}>
                                  {curr}
                                </option>
                              ))}
                            </select>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center h-10 px-3 bg-muted rounded-md">
                            <span className="font-semibold">
                              {totalPrice} {itemData.currency || "USD"}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex gap-4">
              <Button 
                type="button"
                variant="outline" 
                size="lg" 
                className="flex-1" 
                onClick={handleSaveDraft}
                disabled={saveDraftMutation.isPending}
              >
                {saveDraftMutation.isPending ? "Saving..." : "Save Draft"}
              </Button>
              <Button 
                type="submit" 
                size="lg" 
                className="flex-1" 
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending ? "Submitting..." : "Submit Quote"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}