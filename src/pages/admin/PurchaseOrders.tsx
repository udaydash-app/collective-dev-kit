import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreVertical, Copy, Eye, Trash2, Send, CheckCircle } from "lucide-react";
import { PurchaseOrderDialog } from "@/components/admin/PurchaseOrderDialog";
import { QuoteReviewDialog } from "@/components/admin/QuoteReviewDialog";
import { ConvertToPurchaseDialog } from "@/components/admin/ConvertToPurchaseDialog";
import { ReturnToPOSButton } from "@/components/layout/ReturnToPOSButton";
import { format } from "date-fns";

export default function PurchaseOrders() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingPO, setEditingPO] = useState<any>(null);
  const [reviewingPO, setReviewingPO] = useState<any>(null);
  const [convertingPO, setConvertingPO] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: purchaseOrders, isLoading } = useQuery({
    queryKey: ["purchase-orders", searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("purchase_orders")
        .select(`
          *,
          purchase_order_items (
            *,
            products (name, image_url),
            product_variants (label)
          )
        `)
        .order("created_at", { ascending: false });

      if (searchTerm) {
        query = query.or(`po_number.ilike.%${searchTerm}%,supplier_name.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const deletePOMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("purchase_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success("Purchase order deleted");
    },
    onError: (error: any) => {
      toast.error("Failed to delete: " + error.message);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("purchase_orders")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success("Status updated");
    },
    onError: (error: any) => {
      toast.error("Failed to update status: " + error.message);
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      draft: "secondary",
      sent: "default",
      quote_received: "outline",
      accepted: "default",
      converted: "default",
      cancelled: "destructive",
    };

    const labels: Record<string, string> = {
      draft: "Draft",
      sent: "Sent",
      quote_received: "Quote Received",
      accepted: "Accepted",
      converted: "Converted",
      cancelled: "Cancelled",
    };

    return <Badge variant={variants[status]}>{labels[status] || status}</Badge>;
  };

  const copyShareLink = (shareToken: string) => {
    const link = `${window.location.origin}/po/quote/${shareToken}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copied to clipboard");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Purchase Orders</h1>
          <p className="text-muted-foreground">Create and manage purchase orders</p>
        </div>
        <div className="flex gap-2">
          <ReturnToPOSButton inline />
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Purchase Order
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <Input
          placeholder="Search by PO number or supplier..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO Number</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Valid Until</TableHead>
              <TableHead>Created</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : !purchaseOrders || purchaseOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No purchase orders found
                </TableCell>
              </TableRow>
            ) : (
              purchaseOrders.map((po: any) => (
                <TableRow key={po.id}>
                  <TableCell className="font-mono">{po.po_number}</TableCell>
                  <TableCell>{po.supplier_name}</TableCell>
                  <TableCell>{po.purchase_order_items?.length || 0} items</TableCell>
                  <TableCell>{getStatusBadge(po.status)}</TableCell>
                  <TableCell>
                    {po.valid_until ? format(new Date(po.valid_until), "PP") : "-"}
                  </TableCell>
                  <TableCell>{format(new Date(po.created_at), "PP")}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingPO(po)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View/Edit
                        </DropdownMenuItem>
                        {po.status !== "converted" && (
                          <DropdownMenuItem onClick={() => copyShareLink(po.share_token)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Link
                          </DropdownMenuItem>
                        )}
                        {po.status === "draft" && (
                          <DropdownMenuItem
                            onClick={() => updateStatusMutation.mutate({ id: po.id, status: "sent" })}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Mark as Sent
                          </DropdownMenuItem>
                        )}
                        {po.status === "quote_received" && (
                          <>
                            <DropdownMenuItem onClick={() => setReviewingPO(po)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Review Quote
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                updateStatusMutation.mutate({ id: po.id, status: "accepted" })
                              }
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Accept Quote
                            </DropdownMenuItem>
                          </>
                        )}
                        {po.status === "accepted" && (
                          <DropdownMenuItem onClick={() => setConvertingPO(po)}>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Convert to Purchase
                          </DropdownMenuItem>
                        )}
                        {po.status !== "converted" && (
                          <DropdownMenuItem
                            onClick={() => deletePOMutation.mutate(po.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <PurchaseOrderDialog
        open={showCreateDialog || !!editingPO}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setEditingPO(null);
          }
        }}
        purchaseOrder={editingPO}
      />

      {reviewingPO && (
        <QuoteReviewDialog
          open={!!reviewingPO}
          onOpenChange={(open) => !open && setReviewingPO(null)}
          purchaseOrder={reviewingPO}
        />
      )}

      {convertingPO && (
        <ConvertToPurchaseDialog
          open={!!convertingPO}
          onOpenChange={(open) => !open && setConvertingPO(null)}
          purchaseOrder={convertingPO}
        />
      )}
    </div>
  );
}