import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";

interface QuoteReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: any;
}

export function QuoteReviewDialog({
  open,
  onOpenChange,
  purchaseOrder,
}: QuoteReviewDialogProps) {
  const { data: responses } = useQuery({
    queryKey: ["po-responses", purchaseOrder?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_order_responses")
        .select(`
          *,
          purchase_order_items (
            *,
            products (name, image_url),
            product_variants (label)
          )
        `)
        .eq("purchase_order_id", purchaseOrder.id);

      if (error) throw error;
      return data;
    },
    enabled: !!purchaseOrder?.id && open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Supplier Quote Review</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">PO Number</p>
              <p className="font-mono font-semibold">{purchaseOrder.po_number}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Supplier</p>
              <p className="font-semibold">{purchaseOrder.supplier_name}</p>
            </div>
            <Badge>Quote Received</Badge>
          </div>

          {!responses || responses.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No quote submitted yet</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {responses.map((response: any) => (
                <Card key={response.id} className="p-6">
                  <div className="flex items-start gap-4">
                    {response.purchase_order_items?.products?.image_url && (
                      <img
                        src={response.purchase_order_items.products.image_url}
                        alt={response.purchase_order_items.product_name}
                        className="w-20 h-20 object-cover rounded"
                      />
                    )}
                    <div className="flex-1 space-y-3">
                      <div>
                        <h3 className="font-semibold text-lg">
                          {response.purchase_order_items.product_name}
                          {response.purchase_order_items.variant_name && (
                            <span className="text-muted-foreground ml-2">
                              ({response.purchase_order_items.variant_name})
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Requested: {response.purchase_order_items.requested_quantity} units
                        </p>
                      </div>

                      <div className="grid grid-cols-4 gap-4 text-sm">
                        {response.cartons > 0 && (
                          <div>
                            <p className="text-muted-foreground">Cartons</p>
                            <p className="font-semibold">{response.cartons}</p>
                          </div>
                        )}
                        {response.bags > 0 && (
                          <div>
                            <p className="text-muted-foreground">Bags</p>
                            <p className="font-semibold">{response.bags}</p>
                          </div>
                        )}
                        {response.pieces > 0 && (
                          <div>
                            <p className="text-muted-foreground">Pieces</p>
                            <p className="font-semibold">{response.pieces}</p>
                          </div>
                        )}
                        {response.weight > 0 && (
                          <div>
                            <p className="text-muted-foreground">Weight</p>
                            <p className="font-semibold">
                              {response.weight} {response.weight_unit}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t">
                        <div>
                          <p className="text-sm text-muted-foreground">Price per unit</p>
                          <p className="text-2xl font-bold">
                            {response.price} {response.currency}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Total</p>
                          <p className="text-xl font-semibold">
                            {(response.price * response.purchase_order_items.requested_quantity).toFixed(2)}{" "}
                            {response.currency}
                          </p>
                        </div>
                      </div>

                      {response.notes && (
                        <div className="pt-3 border-t">
                          <p className="text-sm text-muted-foreground">Notes:</p>
                          <p className="text-sm">{response.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}

              <Card className="p-6 bg-muted">
                <div className="flex items-center justify-between">
                  <p className="text-lg font-semibold">Total Quote Value</p>
                  <p className="text-2xl font-bold">
                    {responses
                      .reduce(
                        (sum: number, r: any) =>
                          sum + r.price * r.purchase_order_items.requested_quantity,
                        0
                      )
                      .toFixed(2)}{" "}
                    {responses[0]?.currency || "USD"}
                  </p>
                </div>
              </Card>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}