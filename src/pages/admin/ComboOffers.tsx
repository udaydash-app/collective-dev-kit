import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, Gift } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { ComboOfferDialog } from '@/components/admin/ComboOfferDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReturnToPOSButton } from '@/components/layout/ReturnToPOSButton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function ComboOffers() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCombo, setEditingCombo] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [comboToDelete, setComboToDelete] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: combos, isLoading } = useQuery({
    queryKey: ['combo-offers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('combo_offers')
        .select(`
          *,
          combo_offer_items (
            id,
            quantity,
            product_id,
            variant_id,
            products (
              id,
              name,
              price,
              image_url
            ),
            product_variants (
              id,
              label,
              price
            )
          )
        `)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('combo_offers')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['combo-offers'] });
      toast.success('Combo status updated');
    },
    onError: () => {
      toast.error('Failed to update combo status');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('combo_offers')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['combo-offers'] });
      toast.success('Combo deleted successfully');
      setDeleteDialogOpen(false);
      setComboToDelete(null);
    },
    onError: () => {
      toast.error('Failed to delete combo');
    },
  });

  const handleEdit = (combo: any) => {
    setEditingCombo(combo);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setComboToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCombo(null);
  };

  const calculateRegularPrice = (items: any[]) => {
    return items.reduce((sum, item) => {
      const price = item.variant_id 
        ? item.product_variants?.price || 0
        : item.products?.price || 0;
      return sum + (price * item.quantity);
    }, 0);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Combo Offers</CardTitle>
          <div className="flex gap-2">
            <ReturnToPOSButton inline />
            <Button 
              variant="outline"
              onClick={() => navigate('/admin/bogo-offers')}
            >
              <Gift className="mr-2 h-4 w-4" />
              BOGO Offers
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Combo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : combos && combos.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Regular Price</TableHead>
                  <TableHead>Combo Price</TableHead>
                  <TableHead>Savings</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {combos.map((combo) => {
                  const regularPrice = calculateRegularPrice(combo.combo_offer_items || []);
                  const savings = regularPrice - combo.combo_price;
                  
                  return (
                    <TableRow key={combo.id}>
                      <TableCell className="font-medium">{combo.name}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {combo.combo_offer_items?.map((item: any, idx: number) => (
                            <div key={item.id}>
                              {item.quantity}x {item.products?.name}
                              {item.variant_id && ` (${item.product_variants?.label})`}
                              {idx < combo.combo_offer_items.length - 1 && ', '}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>₹{regularPrice.toFixed(2)}</TableCell>
                      <TableCell className="font-semibold text-green-600">
                        ₹{combo.combo_price.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          Save ₹{savings.toFixed(2)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={combo.is_active}
                          onCheckedChange={(checked) =>
                            toggleActiveMutation.mutate({ id: combo.id, is_active: checked })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(combo)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(combo.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No combo offers yet. Create your first combo!
            </div>
          )}
        </CardContent>
      </Card>

      <ComboOfferDialog
        open={dialogOpen}
        onOpenChange={handleCloseDialog}
        editingCombo={editingCombo}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Combo Offer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this combo offer? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => comboToDelete && deleteMutation.mutate(comboToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
