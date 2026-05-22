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
import { Plus, MoreVertical, Copy, Eye, Trash2, Send, CheckCircle, FileDown } from "lucide-react";
import { PurchaseOrderDialog } from "@/components/admin/PurchaseOrderDialog";
import { QuoteReviewDialog } from "@/components/admin/QuoteReviewDialog";
import { ConvertToPurchaseDialog } from "@/components/admin/ConvertToPurchaseDialog";
import { ReturnToPOSButton } from "@/components/layout/ReturnToPOSButton";
import { formatDate } from "@/lib/utils";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

  const generatePDF = (po: any) => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("PURCHASE ORDER", pageWidth / 2, 20, { align: "center" });

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(`PO Number: ${po.po_number}`, 14, 32);
      doc.text(`Date: ${formatDate(po.created_at)}`, 14, 38);
      if (po.valid_until) doc.text(`Valid Until: ${formatDate(po.valid_until)}`, 14, 44);
      doc.text(`Status: ${(po.status || "").toUpperCase()}`, pageWidth - 14, 32, { align: "right" });

      doc.setFont("helvetica", "bold");
      doc.text("Supplier:", 14, 56);
      doc.setFont("helvetica", "normal");
      doc.text(po.supplier_name || "-", 14, 62);
      if (po.supplier_email) doc.text(po.supplier_email, 14, 68);
      if (po.supplier_phone) doc.text(po.supplier_phone, 14, 74);

      const items = (po.purchase_order_items || []).map((it: any, idx: number) => [
        idx + 1,
        it.product_name + (it.variant_name ? ` (${it.variant_name})` : ""),
        it.requested_quantity,
      ]);

      autoTable(doc, {
        startY: 84,
        head: [["#", "Product", "Qty"]],
        body: items,
        theme: "striped",
        headStyles: { fillColor: [30, 41, 59] },
      });

      let y = (doc as any).lastAutoTable.finalY + 10;
      if (po.notes) {
        doc.setFont("helvetica", "bold");
        doc.text("Notes:", 14, y);
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(po.notes, pageWidth - 28);
        doc.text(lines, 14, y + 6);
      }

      doc.save(`${po.po_number}.pdf`);
      toast.success("PDF generated");
    } catch (e: any) {
      toast.error("Failed to generate PDF: " + e.message);
    }
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
        <Table fixedScroll>
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
                    {po.valid_until ? formatDate(po.valid_until) : "-"}
                  </TableCell>
                  <TableCell>{formatDate(po.created_at)}</TableCell>
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
                        <DropdownMenuItem onClick={() => generatePDF(po)}>
                          <FileDown className="h-4 w-4 mr-2" />
                          Download PDF
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