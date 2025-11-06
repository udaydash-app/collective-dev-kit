import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MultiProductBOGODialog } from "@/components/admin/MultiProductBOGODialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDate } from "@/lib/utils";

export default function MultiProductBOGO() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [offerToDelete, setOfferToDelete] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data: offers = [], isLoading } = useQuery({
    queryKey: ['multi-product-bogo-offers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('multi_product_bogo_offers')
        .select(`
          *,
          multi_product_bogo_items(
            id,
            product_id,
            variant_id,
            products(name, price),
            product_variants(label, price)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('multi_product_bogo_offers')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['multi-product-bogo-offers'] });
      toast.success("Offer deleted successfully");
      setDeleteDialogOpen(false);
      setOfferToDelete(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const handleEdit = (offer: any) => {
    setEditingOffer(offer);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setOfferToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingOffer(null);
    }
  };

  const isOfferActive = (offer: any) => {
    if (!offer.is_active) return false;
    const now = new Date();
    const start = new Date(offer.start_date);
    const end = new Date(offer.end_date);
    return now >= start && now <= end;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading offers...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Multi-Product BOGO Offers</h1>
          <p className="text-muted-foreground">
            Create "Any 2" offers where customers get a discount when they buy any 2 products from a selected group
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Offer
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Products</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Date Range</TableHead>
              <TableHead>Uses</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {offers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <p className="text-muted-foreground">No offers created yet</p>
                  <Button
                    variant="link"
                    onClick={() => setDialogOpen(true)}
                    className="mt-2"
                  >
                    Create your first offer
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              offers.map((offer) => (
                <TableRow key={offer.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{offer.name}</p>
                      {offer.description && (
                        <p className="text-sm text-muted-foreground">
                          {offer.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {offer.multi_product_bogo_items?.length || 0} products
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold text-primary">
                      {offer.discount_percentage}% OFF
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <p>{formatDate(offer.start_date)}</p>
                      <p className="text-muted-foreground">
                        to {formatDate(offer.end_date)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <p>{offer.current_uses || 0} uses</p>
                      {offer.max_total_uses && (
                        <p className="text-muted-foreground">
                          / {offer.max_total_uses} max
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={isOfferActive(offer) ? "default" : "secondary"}
                    >
                      {isOfferActive(offer) ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(offer)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(offer.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <MultiProductBOGODialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        editingOffer={editingOffer}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Offer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this offer? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => offerToDelete && deleteMutation.mutate(offerToDelete)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
