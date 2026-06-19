import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MinimizableDialog } from "@/components/ui/minimizable-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Pencil, Trash2, Tag, Package, Gift, ChevronDown, BadgePercent } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { ReturnToPOSButton } from "@/components/layout/ReturnToPOSButton";
import { useNavigate } from "react-router-dom";

interface Offer {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  discount_percentage: number | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  display_order: number;
  link_url: string | null;
  created_at: string;
}

interface SpecialOffer {
  id: string;
  name: string;
  threshold_amount: number;
  discount_percentage: number;
  match_mode: 'equals' | 'gte';
  is_active: boolean;
}

export default function AdminOffers() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Special offers (cart-threshold)
  const [specialOffers, setSpecialOffers] = useState<SpecialOffer[]>([]);
  const [specialDialogOpen, setSpecialDialogOpen] = useState(false);
  const [editingSpecial, setEditingSpecial] = useState<SpecialOffer | null>(null);
  const [specialForm, setSpecialForm] = useState({
    name: '',
    threshold_amount: '',
    discount_percentage: '15',
    match_mode: 'equals' as 'equals' | 'gte',
    is_active: true,
  });

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    image_url: "",
    discount_percentage: "",
    start_date: "",
    end_date: "",
    is_active: true,
    display_order: 0,
    link_url: "",
  });

  useEffect(() => {
    fetchOffers();
    fetchSpecialOffers();
  }, []);

  const fetchOffers = async () => {
    try {
      try {
        const { fetchOffersLocal } = await import('@/db/queries/offersAndOps');
        const local = await fetchOffersLocal();
        if (local.length > 0) { setOffers(local); setLoading(false); return; }
      } catch (e) {
        console.warn('[offers] local read failed, falling back', e);
      }
      const { data, error } = await supabase
        .from("offers")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;
      setOffers(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSpecialOffers = async () => {
    try {
      const { fetchSpecialOffersLocal } = await import('@/db/queries/offersAndOps');
      const local = await fetchSpecialOffersLocal();
      if (local.length > 0) { setSpecialOffers(local as any); return; }
    } catch (e) {
      console.warn('[special_offers] local read failed, falling back', e);
    }
    const { data, error } = await supabase
      .from('special_offers')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setSpecialOffers((data as SpecialOffer[]) || []);
  };

  const resetSpecialForm = () => {
    setSpecialForm({ name: '', threshold_amount: '', discount_percentage: '15', match_mode: 'equals', is_active: true });
    setEditingSpecial(null);
  };

  const openSpecialCreate = () => {
    resetSpecialForm();
    setSpecialDialogOpen(true);
  };

  const handleEditSpecial = (s: SpecialOffer) => {
    setEditingSpecial(s);
    setSpecialForm({
      name: s.name,
      threshold_amount: String(s.threshold_amount),
      discount_percentage: String(s.discount_percentage),
      match_mode: s.match_mode,
      is_active: s.is_active,
    });
    setSpecialDialogOpen(true);
  };

  const handleDeleteSpecial = async (id: string) => {
    if (!confirm('Delete this special offer?')) return;
    const { error } = await supabase.from('special_offers').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Special offer deleted' });
    fetchSpecialOffers();
  };

  const handleToggleSpecial = async (s: SpecialOffer) => {
    const { error } = await supabase
      .from('special_offers')
      .update({ is_active: !s.is_active })
      .eq('id', s.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    fetchSpecialOffers();
  };

  const handleSubmitSpecial = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: specialForm.name,
      threshold_amount: parseFloat(specialForm.threshold_amount),
      discount_percentage: parseFloat(specialForm.discount_percentage),
      match_mode: specialForm.match_mode,
      is_active: specialForm.is_active,
    };
    if (!payload.name || !(payload.threshold_amount > 0) || !(payload.discount_percentage > 0)) {
      toast({ title: 'Invalid input', description: 'Name, threshold and discount % are required.', variant: 'destructive' });
      return;
    }
    try {
      if (editingSpecial) {
        const { error } = await supabase.from('special_offers').update(payload).eq('id', editingSpecial.id);
        if (error) throw error;
        toast({ title: 'Special offer updated' });
      } else {
        const { error } = await supabase.from('special_offers').insert([payload]);
        if (error) throw error;
        toast({ title: 'Special offer created' });
      }
      setSpecialDialogOpen(false);
      resetSpecialForm();
      fetchSpecialOffers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const offerData = {
        title: formData.title,
        description: formData.description || null,
        image_url: formData.image_url || null,
        discount_percentage: formData.discount_percentage
          ? parseInt(formData.discount_percentage)
          : null,
        start_date: formData.start_date,
        end_date: formData.end_date,
        is_active: formData.is_active,
        display_order: formData.display_order,
        link_url: formData.link_url || null,
      };

      if (editingOffer) {
        const { error } = await supabase
          .from("offers")
          .update(offerData)
          .eq("id", editingOffer.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Offer updated successfully",
        });
      } else {
        const { error } = await supabase.from("offers").insert([offerData]);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Offer created successfully",
        });
      }

      setDialogOpen(false);
      resetForm();
      fetchOffers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (offer: Offer) => {
    setEditingOffer(offer);
    setFormData({
      title: offer.title,
      description: offer.description || "",
      image_url: offer.image_url || "",
      discount_percentage: offer.discount_percentage?.toString() || "",
      start_date: offer.start_date.split("T")[0],
      end_date: offer.end_date.split("T")[0],
      is_active: offer.is_active,
      display_order: offer.display_order,
      link_url: offer.link_url || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this offer?")) return;

    try {
      const { error } = await supabase.from("offers").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Offer deleted successfully",
      });
      fetchOffers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      image_url: "",
      discount_percentage: "",
      start_date: "",
      end_date: "",
      is_active: true,
      display_order: 0,
      link_url: "",
    });
    setEditingOffer(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Tag className="h-8 w-8" />
            Manage Offers
          </h1>
          <p className="text-muted-foreground mt-1">
            Create and manage promotional offers
          </p>
        </div>
        <div className="flex gap-2">
          <ReturnToPOSButton inline />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Offer
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={openCreateDialog}>
                <Tag className="mr-2 h-4 w-4" />
                Regular Offer
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/admin/bogo-offers')}>
                <Gift className="mr-2 h-4 w-4" />
                BOGO Offer
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/admin/combo-offers')}>
                <Package className="mr-2 h-4 w-4" />
                Combo Offer
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/admin/multi-product-bogo')}>
                <Gift className="mr-2 h-4 w-4" />
                Multi-Product BOGO
              </DropdownMenuItem>
              <DropdownMenuItem onClick={openSpecialCreate}>
                <BadgePercent className="mr-2 h-4 w-4" />
                Special Offer (Cart Threshold)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="bg-card rounded-lg border">
        <Table fixedScroll>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Order</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {offers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  No offers found. Create your first offer!
                </TableCell>
              </TableRow>
            ) : (
              offers.map((offer) => (
                <TableRow key={offer.id}>
                  <TableCell className="font-medium">{offer.title}</TableCell>
                  <TableCell>
                    {offer.discount_percentage
                      ? `${offer.discount_percentage}%`
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {formatDate(offer.start_date)}
                  </TableCell>
                  <TableCell>
                    {formatDate(offer.end_date)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        offer.is_active
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                      }`}
                    >
                      {offer.is_active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell>{offer.display_order}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(offer)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(offer.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingOffer ? "Edit Offer" : "Create New Offer"}
            </DialogTitle>
            <DialogDescription>
              Fill in the details for the promotional offer
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="image_url">Image URL</Label>
              <Input
                id="image_url"
                type="url"
                value={formData.image_url}
                onChange={(e) =>
                  setFormData({ ...formData, image_url: e.target.value })
                }
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <div>
              <Label htmlFor="discount_percentage">Discount Percentage</Label>
              <Input
                id="discount_percentage"
                type="number"
                min="0"
                max="100"
                value={formData.discount_percentage}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    discount_percentage: e.target.value,
                  })
                }
                placeholder="e.g., 20"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_date">Start Date *</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) =>
                    setFormData({ ...formData, start_date: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="end_date">End Date *</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) =>
                    setFormData({ ...formData, end_date: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="link_url">Link URL (Optional)</Label>
              <Input
                id="link_url"
                type="url"
                value={formData.link_url}
                onChange={(e) =>
                  setFormData({ ...formData, link_url: e.target.value })
                }
                placeholder="https://example.com/promo"
              />
            </div>

            <div>
              <Label htmlFor="display_order">Display Order</Label>
              <Input
                id="display_order"
                type="number"
                value={formData.display_order}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    display_order: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
              <Label htmlFor="is_active">Active</Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingOffer ? "Update" : "Create"} Offer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Special Offers section */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <BadgePercent className="h-6 w-6" />
              Special Offers (Cart Threshold)
            </h2>
            <p className="text-muted-foreground text-sm">
              When cart subtotal hits the threshold, POS asks the cashier to apply the discount.
            </p>
          </div>
          <Button onClick={openSpecialCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Special Offer
          </Button>
        </div>
        <div className="bg-card rounded-lg border">
          <Table fixedScroll>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Threshold</TableHead>
                <TableHead>Match</TableHead>
                <TableHead>Discount %</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {specialOffers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    No special offers yet.
                  </TableCell>
                </TableRow>
              ) : (
                specialOffers.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{Number(s.threshold_amount).toLocaleString('fr-CI')} FCFA</TableCell>
                    <TableCell>{s.match_mode === 'gte' ? '≥' : '='}</TableCell>
                    <TableCell>{s.discount_percentage}%</TableCell>
                    <TableCell>
                      <Switch checked={s.is_active} onCheckedChange={() => handleToggleSpecial(s)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEditSpecial(s)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteSpecial(s.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <MinimizableDialog
        open={specialDialogOpen}
        onOpenChange={setSpecialDialogOpen}
        title={editingSpecial ? 'Edit Special Offer' : 'New Special Offer'}
        description="Triggered automatically at checkout when cart subtotal matches the threshold."
        className="max-w-lg"
      >
          <form onSubmit={handleSubmitSpecial} className="space-y-4">
            <div>
              <Label htmlFor="sp-name">Name *</Label>
              <Input
                id="sp-name"
                value={specialForm.name}
                onChange={(e) => setSpecialForm({ ...specialForm, name: e.target.value })}
                placeholder="e.g., 150K Bundle"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sp-threshold">Cart Threshold (FCFA) *</Label>
                <Input
                  id="sp-threshold"
                  type="number"
                  min="1"
                  value={specialForm.threshold_amount}
                  onChange={(e) => setSpecialForm({ ...specialForm, threshold_amount: e.target.value })}
                  placeholder="150000"
                  required
                />
              </div>
              <div>
                <Label htmlFor="sp-disc">Discount % *</Label>
                <Input
                  id="sp-disc"
                  type="number"
                  min="1"
                  max="100"
                  value={specialForm.discount_percentage}
                  onChange={(e) => setSpecialForm({ ...specialForm, discount_percentage: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <Label>Match Mode</Label>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="match_mode"
                    checked={specialForm.match_mode === 'equals'}
                    onChange={() => setSpecialForm({ ...specialForm, match_mode: 'equals' })}
                  />
                  Exact match (=)
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="match_mode"
                    checked={specialForm.match_mode === 'gte'}
                    onChange={() => setSpecialForm({ ...specialForm, match_mode: 'gte' })}
                  />
                  Greater than or equal (≥)
                </label>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="sp-active"
                checked={specialForm.is_active}
                onCheckedChange={(c) => setSpecialForm({ ...specialForm, is_active: c })}
              />
              <Label htmlFor="sp-active">Active</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSpecialDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingSpecial ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
