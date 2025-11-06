import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { X, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectedProduct {
  product_id: string;
  variant_id: string | null;
  name: string;
  variant_label?: string;
  price: number;
}

interface MultiProductBOGODialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingOffer?: any;
}

export function MultiProductBOGODialog({ open, onOpenChange, editingOffer }: MultiProductBOGODialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [discountPercentage, setDiscountPercentage] = useState(50);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [maxUsesPerTransaction, setMaxUsesPerTransaction] = useState<number | null>(null);
  const [maxTotalUses, setMaxTotalUses] = useState<number | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const queryClient = useQueryClient();

  // Fetch products with variants
  const { data: products = [] } = useQuery({
    queryKey: ['products-with-variants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_variants(*)
        `)
        .eq('is_available', true)
        .order('name');

      if (error) throw error;
      return data || [];
    }
  });

  useEffect(() => {
    if (editingOffer) {
      setName(editingOffer.name || "");
      setDescription(editingOffer.description || "");
      setDiscountPercentage(editingOffer.discount_percentage || 50);
      setStartDate(editingOffer.start_date ? new Date(editingOffer.start_date).toISOString().split('T')[0] : "");
      setEndDate(editingOffer.end_date ? new Date(editingOffer.end_date).toISOString().split('T')[0] : "");
      setIsActive(editingOffer.is_active ?? true);
      setMaxUsesPerTransaction(editingOffer.max_uses_per_transaction);
      setMaxTotalUses(editingOffer.max_total_uses);

      // Load selected products
      if (editingOffer.multi_product_bogo_items) {
        const items = editingOffer.multi_product_bogo_items.map((item: any) => ({
          product_id: item.product_id,
          variant_id: item.variant_id,
          name: item.products?.name || "",
          variant_label: item.product_variants?.label || undefined,
          price: item.variant_id ? item.product_variants?.price : item.products?.price
        }));
        setSelectedProducts(items);
      }
    } else {
      setName("");
      setDescription("");
      setDiscountPercentage(50);
      setStartDate("");
      setEndDate("");
      setIsActive(true);
      setMaxUsesPerTransaction(null);
      setMaxTotalUses(null);
      setSelectedProducts([]);
    }
  }, [editingOffer, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name || !startDate || !endDate) {
        throw new Error("Please fill in all required fields");
      }

      if (selectedProducts.length < 2) {
        throw new Error("Please select at least 2 products");
      }

      const offerData = {
        name,
        description,
        discount_percentage: discountPercentage,
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString(),
        is_active: isActive,
        max_uses_per_transaction: maxUsesPerTransaction,
        max_total_uses: maxTotalUses
      };

      let offerId = editingOffer?.id;

      if (editingOffer) {
        // Update existing offer
        const { error } = await supabase
          .from('multi_product_bogo_offers')
          .update(offerData)
          .eq('id', editingOffer.id);

        if (error) throw error;

        // Delete existing items
        await supabase
          .from('multi_product_bogo_items')
          .delete()
          .eq('offer_id', editingOffer.id);
      } else {
        // Create new offer
        const { data, error } = await supabase
          .from('multi_product_bogo_offers')
          .insert(offerData)
          .select()
          .single();

        if (error) throw error;
        offerId = data.id;
      }

      // Insert items
      const items = selectedProducts.map(item => ({
        offer_id: offerId,
        product_id: item.product_id,
        variant_id: item.variant_id
      }));

      const { error: itemsError } = await supabase
        .from('multi_product_bogo_items')
        .insert(items);

      if (itemsError) throw itemsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['multi-product-bogo-offers'] });
      toast.success(editingOffer ? "Offer updated successfully" : "Offer created successfully");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const handleAddProduct = (product: any, variantId: string | null = null) => {
    const variant = variantId ? product.product_variants?.find((v: any) => v.id === variantId) : null;
    
    const newItem: SelectedProduct = {
      product_id: product.id,
      variant_id: variantId,
      name: product.name,
      variant_label: variant?.label,
      price: variant?.price || product.price
    };

    // Check if already added
    const exists = selectedProducts.some(
      p => p.product_id === newItem.product_id && p.variant_id === newItem.variant_id
    );

    if (!exists) {
      setSelectedProducts([...selectedProducts, newItem]);
    }
    
    setSearchOpen(false);
    setSearchValue("");
  };

  const handleRemoveProduct = (index: number) => {
    setSelectedProducts(selectedProducts.filter((_, i) => i !== index));
  };

  // Filter products based on search
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchValue.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingOffer ? "Edit Multi-Product BOGO" : "Create Multi-Product BOGO"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Offer Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Mix & Match - Any 2 for 50% Off"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="discount">Discount Percentage *</Label>
              <Input
                id="discount"
                type="number"
                min="0"
                max="100"
                value={discountPercentage}
                onChange={(e) => setDiscountPercentage(Number(e.target.value))}
              />
            </div>

            <div className="flex items-center space-x-2 pt-8">
              <Switch
                id="active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="active">Active</Label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="endDate">End Date *</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="maxPerTransaction">Max Uses Per Transaction</Label>
              <Input
                id="maxPerTransaction"
                type="number"
                min="0"
                value={maxUsesPerTransaction || ""}
                onChange={(e) => setMaxUsesPerTransaction(e.target.value ? Number(e.target.value) : null)}
                placeholder="Unlimited"
              />
            </div>

            <div>
              <Label htmlFor="maxTotal">Max Total Uses</Label>
              <Input
                id="maxTotal"
                type="number"
                min="0"
                value={maxTotalUses || ""}
                onChange={(e) => setMaxTotalUses(e.target.value ? Number(e.target.value) : null)}
                placeholder="Unlimited"
              />
            </div>
          </div>

          <div>
            <Label>Selected Products ({selectedProducts.length})</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Minimum 2 products required. Any 2 items from this list will get {discountPercentage}% off.
            </p>

            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={searchOpen}
                  className="w-full justify-between"
                >
                  Add product...
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput 
                    placeholder="Search products..." 
                    value={searchValue}
                    onValueChange={setSearchValue}
                  />
                  <CommandList>
                    <CommandEmpty>No products found.</CommandEmpty>
                    <CommandGroup>
                      {filteredProducts.map((product) => (
                        <div key={product.id}>
                          {product.product_variants && product.product_variants.length > 0 ? (
                            // Product with variants
                            product.product_variants.map((variant: any) => (
                              <CommandItem
                                key={variant.id}
                                onSelect={() => handleAddProduct(product, variant.id)}
                                className="cursor-pointer"
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedProducts.some(
                                      p => p.product_id === product.id && p.variant_id === variant.id
                                    )
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                {product.name} - {variant.label} (${variant.price})
                              </CommandItem>
                            ))
                          ) : (
                            // Product without variants
                            <CommandItem
                              onSelect={() => handleAddProduct(product, null)}
                              className="cursor-pointer"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedProducts.some(
                                    p => p.product_id === product.id && p.variant_id === null
                                  )
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              {product.name} (${product.price})
                            </CommandItem>
                          )}
                        </div>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {selectedProducts.length > 0 && (
              <div className="mt-3 space-y-2">
                {selectedProducts.map((item, index) => (
                  <div
                    key={`${item.product_id}-${item.variant_id}-${index}`}
                    className="flex items-center justify-between p-2 bg-muted rounded-lg"
                  >
                    <div>
                      <p className="font-medium">
                        {item.name}
                        {item.variant_label && ` - ${item.variant_label}`}
                      </p>
                      <p className="text-sm text-muted-foreground">${item.price}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveProduct(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving..." : "Save Offer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
