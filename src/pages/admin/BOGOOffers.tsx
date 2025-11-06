import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Plus, Pencil, Trash2, Gift } from "lucide-react";
import { format } from "date-fns";
import { ReturnToPOSButton } from "@/components/layout/ReturnToPOSButton";

interface BOGOOffer {
  id: string;
  name: string;
  description: string | null;
  buy_product_id: string | null;
  buy_variant_id: string | null;
  buy_quantity: number;
  get_product_id: string | null;
  get_variant_id: string | null;
  get_quantity: number;
  get_discount_percentage: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  display_order: number;
  max_uses_per_transaction: number | null;
  max_total_uses: number | null;
  current_uses: number;
}

interface Product {
  id: string;
  name: string;
  variants?: { id: string; name: string }[];
}

export default function BOGOOffers() {
  const [offers, setOffers] = useState<BOGOOffer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<BOGOOffer | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    buy_product_id: "",
    buy_variant_id: "",
    buy_quantity: "1",
    get_product_id: "",
    get_variant_id: "",
    get_quantity: "1",
    get_discount_percentage: "100",
    start_date: "",
    end_date: "",
    is_active: true,
    display_order: 0,
    max_uses_per_transaction: "",
    max_total_uses: "",
  });

  useEffect(() => {
    fetchOffers();
    fetchProducts();
  }, []);

  const fetchOffers = async () => {
    try {
      const { data, error } = await supabase
        .from("bogo_offers")
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

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select(`
          id,
          name,
          product_variants!product_variants_product_id_fkey (id, name)
        `)
        .eq("is_available", true)
        .order("name");

      if (error) throw error;
      
      // Transform the data to match our Product interface
      const transformedData = data?.map((product: any) => ({
        id: product.id,
        name: product.name,
        variants: product.product_variants || []
      }));
      
      setProducts(transformedData || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getProductName = (productId: string | null, variantId: string | null) => {
    if (!productId) return "N/A";
    const product = products.find((p) => p.id === productId);
    if (!product) return "Unknown Product";
    
    if (variantId) {
      const variant = product.variants?.find((v) => v.id === variantId);
      return `${product.name} - ${variant?.name || "Unknown Variant"}`;
    }
    
    return product.name;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const offerData = {
        name: formData.name,
        description: formData.description || null,
        buy_product_id: formData.buy_product_id || null,
        buy_variant_id: formData.buy_variant_id || null,
        buy_quantity: parseInt(formData.buy_quantity),
        get_product_id: formData.get_product_id || null,
        get_variant_id: formData.get_variant_id || null,
        get_quantity: parseInt(formData.get_quantity),
        get_discount_percentage: parseInt(formData.get_discount_percentage),
        start_date: formData.start_date,
        end_date: formData.end_date,
        is_active: formData.is_active,
        display_order: formData.display_order,
        max_uses_per_transaction: formData.max_uses_per_transaction
          ? parseInt(formData.max_uses_per_transaction)
          : null,
        max_total_uses: formData.max_total_uses
          ? parseInt(formData.max_total_uses)
          : null,
      };

      if (editingOffer) {
        const { error } = await supabase
          .from("bogo_offers")
          .update(offerData)
          .eq("id", editingOffer.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "BOGO offer updated successfully",
        });
      } else {
        const { error } = await supabase.from("bogo_offers").insert([offerData]);

        if (error) throw error;

        toast({
          title: "Success",
          description: "BOGO offer created successfully",
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

  const handleEdit = (offer: BOGOOffer) => {
    setEditingOffer(offer);
    setFormData({
      name: offer.name,
      description: offer.description || "",
      buy_product_id: offer.buy_product_id || "",
      buy_variant_id: offer.buy_variant_id || "",
      buy_quantity: offer.buy_quantity.toString(),
      get_product_id: offer.get_product_id || "",
      get_variant_id: offer.get_variant_id || "",
      get_quantity: offer.get_quantity.toString(),
      get_discount_percentage: offer.get_discount_percentage.toString(),
      start_date: offer.start_date.split("T")[0],
      end_date: offer.end_date.split("T")[0],
      is_active: offer.is_active,
      display_order: offer.display_order,
      max_uses_per_transaction: offer.max_uses_per_transaction?.toString() || "",
      max_total_uses: offer.max_total_uses?.toString() || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this BOGO offer?")) return;

    try {
      const { error } = await supabase.from("bogo_offers").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "BOGO offer deleted successfully",
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
      name: "",
      description: "",
      buy_product_id: "",
      buy_variant_id: "",
      buy_quantity: "1",
      get_product_id: "",
      get_variant_id: "",
      get_quantity: "1",
      get_discount_percentage: "100",
      start_date: "",
      end_date: "",
      is_active: true,
      display_order: 0,
      max_uses_per_transaction: "",
      max_total_uses: "",
    });
    setEditingOffer(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const buyProduct = products.find((p) => p.id === formData.buy_product_id);
  const getProduct = products.find((p) => p.id === formData.get_product_id);

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
            <Gift className="h-8 w-8" />
            Buy 1 Get 1 Offers
          </h1>
          <p className="text-muted-foreground mt-1">
            Create and manage BOGO promotional offers
          </p>
        </div>
        <div className="flex gap-2">
          <ReturnToPOSButton inline />
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add BOGO Offer
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Buy</TableHead>
              <TableHead>Get</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Uses</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {offers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  No BOGO offers found. Create your first BOGO offer!
                </TableCell>
              </TableRow>
            ) : (
              offers.map((offer) => (
                <TableRow key={offer.id}>
                  <TableCell className="font-medium">{offer.name}</TableCell>
                  <TableCell>
                    {offer.buy_quantity}x {getProductName(offer.buy_product_id, offer.buy_variant_id)}
                  </TableCell>
                  <TableCell>
                    {offer.get_quantity}x {getProductName(offer.get_product_id, offer.get_variant_id)}
                  </TableCell>
                  <TableCell>{offer.get_discount_percentage}% off</TableCell>
                  <TableCell>
                    {format(new Date(offer.start_date), "MMM dd, yyyy")}
                  </TableCell>
                  <TableCell>
                    {format(new Date(offer.end_date), "MMM dd, yyyy")}
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
                  <TableCell>
                    {offer.current_uses}
                    {offer.max_total_uses ? ` / ${offer.max_total_uses}` : ""}
                  </TableCell>
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingOffer ? "Edit BOGO Offer" : "Create New BOGO Offer"}
            </DialogTitle>
            <DialogDescription>
              Configure buy X get Y offer details
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Offer Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Buy 1 Get 1 Free on Chips"
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
                rows={2}
              />
            </div>

            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-semibold">Buy Product</h3>
              
              <div>
                <Label htmlFor="buy_product">Product *</Label>
                <Select
                  value={formData.buy_product_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, buy_product_id: value, buy_variant_id: "" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {buyProduct?.variants && buyProduct.variants.length > 0 && (
                <div>
                  <Label htmlFor="buy_variant">Variant (Optional)</Label>
                  <Select
                    value={formData.buy_variant_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, buy_variant_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any variant" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any variant</SelectItem>
                      {buyProduct.variants.map((variant) => (
                        <SelectItem key={variant.id} value={variant.id}>
                          {variant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label htmlFor="buy_quantity">Quantity *</Label>
                <Input
                  id="buy_quantity"
                  type="number"
                  min="1"
                  value={formData.buy_quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, buy_quantity: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-semibold">Get Product</h3>
              
              <div>
                <Label htmlFor="get_product">Product *</Label>
                <Select
                  value={formData.get_product_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, get_product_id: value, get_variant_id: "" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {getProduct?.variants && getProduct.variants.length > 0 && (
                <div>
                  <Label htmlFor="get_variant">Variant (Optional)</Label>
                  <Select
                    value={formData.get_variant_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, get_variant_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any variant" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any variant</SelectItem>
                      {getProduct.variants.map((variant) => (
                        <SelectItem key={variant.id} value={variant.id}>
                          {variant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label htmlFor="get_quantity">Quantity *</Label>
                <Input
                  id="get_quantity"
                  type="number"
                  min="1"
                  value={formData.get_quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, get_quantity: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="get_discount_percentage">Discount % *</Label>
                <Input
                  id="get_discount_percentage"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.get_discount_percentage}
                  onChange={(e) =>
                    setFormData({ ...formData, get_discount_percentage: e.target.value })
                  }
                  placeholder="100 = Free, 50 = Half off"
                  required
                />
              </div>
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="max_uses_per_transaction">Max Uses Per Transaction</Label>
                <Input
                  id="max_uses_per_transaction"
                  type="number"
                  min="1"
                  value={formData.max_uses_per_transaction}
                  onChange={(e) =>
                    setFormData({ ...formData, max_uses_per_transaction: e.target.value })
                  }
                  placeholder="Unlimited"
                />
              </div>
              <div>
                <Label htmlFor="max_total_uses">Max Total Uses</Label>
                <Input
                  id="max_total_uses"
                  type="number"
                  min="1"
                  value={formData.max_total_uses}
                  onChange={(e) =>
                    setFormData({ ...formData, max_total_uses: e.target.value })
                  }
                  placeholder="Unlimited"
                />
              </div>
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
    </div>
  );
}