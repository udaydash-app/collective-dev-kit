import { useState, useEffect, Fragment } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Sparkles, Upload, X, Search, Package, Grid3x3, List, Grid, Merge, Download } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MergeProductsDialog } from "@/components/admin/MergeProductsDialog";
import { ExportProductsDialog } from "@/components/admin/ExportProductsDialog";
import { formatCurrency } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { ReturnToPOSButton } from "@/components/layout/ReturnToPOSButton";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";

interface ProductVariant {
  id: string;
  product_id: string;
  unit: string;
  quantity?: number;
  label?: string;
  price: number;
  cost_price?: number;
  wholesale_price?: number;
  vip_price?: number;
  barcode?: string;
  stock_quantity: number;
  is_available: boolean;
  is_default: boolean;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  cost_price?: number;
  wholesale_price?: number;
  vip_price?: number;
  unit: string;
  image_url: string | null;
  category_id: string | null;
  store_id: string;
  supplier_id?: string | null;
  is_available: boolean;
  is_available_online?: boolean;
  is_featured?: boolean;
  stock_quantity: number;
  barcode?: string | null;
  categories?: { name: string };
  stores?: { name: string };
  contacts?: { name: string };
  product_variants?: ProductVariant[];
}

interface Category {
  id: string;
  name: string;
}

interface Store {
  id: string;
  name: string;
}

interface Supplier {
  id: string;
  name: string;
}

export default function Products() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [showVariants, setShowVariants] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStore, setFilterStore] = useState<string>("all");
  const [filterAvailability, setFilterAvailability] = useState<string>("all");
  const [filterFeatured, setFilterFeatured] = useState<string>("all");
  const [filterStock, setFilterStock] = useState<string>("all");
  const [filterVariants, setFilterVariants] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [returnPath, setReturnPath] = useState<string | null>(null);
  const [fromPurchases, setFromPurchases] = useState(false);
  const [fromPOS, setFromPOS] = useState(false);
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [hasProcessedOpenDialog, setHasProcessedOpenDialog] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<Product[][]>([]);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchStores();
    fetchSuppliers();
  }, []);

  // Handle opening add dialog after data is loaded
  useEffect(() => {
    if (location.state?.openAddDialog && stores.length > 0 && !loading && !hasProcessedOpenDialog) {
      setFromPurchases(location.state?.fromPurchases || false);
      setFromPOS(location.state?.fromPOS || false);
      handleAdd();
      setHasProcessedOpenDialog(true);
      // Clear the state to prevent re-triggering
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [stores.length, loading, hasProcessedOpenDialog]);

  const fetchProducts = async () => {
    try {
      let allProducts: Product[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("products")
          .select(`
            *,
            categories(name),
            stores(name),
            contacts!products_supplier_id_fkey(name),
            product_variants(*)
          `)
          .order("created_at", { ascending: false })
          .range(from, from + batchSize - 1);

        if (error) throw error;
        
        if (data && data.length > 0) {
          allProducts = [...allProducts, ...data];
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      console.log('Admin: Fetched products count:', allProducts.length);
      setProducts(allProducts);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setStores(data || []);
    } catch (error) {
      console.error("Error fetching stores:", error);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name")
        .eq("is_supplier", true)
        .order("name");

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    }
  };

  const handleEdit = (product: Product) => {
    setIsAddingNew(false);
    setEditingProduct(product);
    setSelectedImage(null);
    setPreviewUrl(null);
    setImageUrl("");
    console.log('Editing product variants:', product.product_variants);
    setVariants(product.product_variants || []);
    setShowVariants(true); // Show variants section by default
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    if (stores.length === 0) {
      toast.error("Please add at least one store first");
      return;
    }
    setIsAddingNew(true);
    setEditingProduct({
      id: 'new',
      name: '',
      description: '',
      price: 0,
      unit: 'pcs',
      image_url: null,
      category_id: null,
      store_id: stores[0].id,
      is_available: true,
      is_featured: false,
      stock_quantity: 0,
      barcode: null,
    } as Product);
    setSelectedImage(null);
    setPreviewUrl(null);
    setImageUrl("");
    setVariants([]);
    setShowVariants(false);
    setIsDialogOpen(true);
  };

  // Auto-open add product dialog if addNew parameter is present
  useEffect(() => {
    const shouldAddNew = searchParams.get('addNew');
    const barcodeParam = searchParams.get('barcode');
    const returnToParam = searchParams.get('returnTo');
    
    if (shouldAddNew === 'true' && stores.length > 0 && !isDialogOpen) {
      // Capture return path if specified
      if (returnToParam === 'pos') {
        setReturnPath('/admin/pos');
      }
      
      // Remove the query parameters
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('addNew');
      newSearchParams.delete('barcode');
      newSearchParams.delete('returnTo');
      setSearchParams(newSearchParams);
      
      // Set up new product with barcode pre-filled
      setIsAddingNew(true);
      setEditingProduct({
        id: 'new',
        name: '',
        description: '',
        price: 0,
        unit: 'pcs',
        image_url: null,
        category_id: null,
        store_id: stores[0].id,
        is_available: true,
        is_featured: false,
        stock_quantity: 0,
        barcode: barcodeParam || null,
      } as Product);
      setSelectedImage(null);
      setPreviewUrl(null);
      setImageUrl("");
      setVariants([]);
      setShowVariants(false);
      setIsDialogOpen(true);
    }
  }, [searchParams, stores, isDialogOpen]);

  const addVariant = () => {
    setVariants([...variants, {
      id: `temp-${Date.now()}`,
      product_id: editingProduct?.id || '',
      unit: 'pcs',
      quantity: 1,
      price: 0,
      cost_price: 0,
      barcode: '',
      stock_quantity: 0,
      is_available: true,
      is_default: variants.length === 0,
    }]);
  };

  const updateVariant = (index: number, field: keyof ProductVariant, value: any) => {
    const newVariants = [...variants];
    newVariants[index] = { ...newVariants[index], [field]: value };
    setVariants(newVariants);
  };

  const removeVariant = (index: number) => {
    const removedVariant = variants[index];
    console.log('Removing variant at index', index, ':', removedVariant);
    setVariants(variants.filter((_, i) => i !== index));
  };

  const extractVariantAsProduct = (variant: ProductVariant) => {
    if (!editingProduct) return;
    
    // Create a new product from the variant details
    const variantLabel = variant.label || `${variant.quantity} ${variant.unit}`;
    const newProductName = `${editingProduct.name} - ${variantLabel}`;
    
    const newProduct: Product = {
      id: 'new',
      name: newProductName,
      description: editingProduct.description || '',
      price: variant.price,
      unit: variant.unit,
      image_url: editingProduct.image_url,
      category_id: editingProduct.category_id,
      store_id: editingProduct.store_id,
      supplier_id: editingProduct.supplier_id,
      is_available: variant.is_available,
      is_featured: editingProduct.is_featured || false,
      stock_quantity: variant.stock_quantity || 0,
      barcode: variant.barcode || null,
      cost_price: variant.cost_price || null,
      wholesale_price: variant.wholesale_price || null,
      vip_price: variant.vip_price || null,
    } as Product;
    
    // Close current dialog
    setIsDialogOpen(false);
    
    // Small delay to allow dialog to close, then open with new product
    setTimeout(() => {
      setIsAddingNew(true);
      setEditingProduct(newProduct);
      setSelectedImage(null);
      setPreviewUrl(null);
      setImageUrl(editingProduct.image_url || "");
      setVariants([]);
      setShowVariants(false);
      setIsDialogOpen(true);
      toast.info("Variant extracted as new product. Review and save.");
    }, 100);
  };

  const saveVariants = async (productId: string) => {
    try {
      // Fetch existing variants for this product
      const { data: existingVariants, error: fetchError } = await supabase
        .from('product_variants')
        .select('id, label')
        .eq('product_id', productId);

      if (fetchError) {
        console.error('Error fetching existing variants:', fetchError);
        throw fetchError;
      }

      const existingIds = existingVariants?.map(v => v.id) || [];
      const currentIds = variants.filter(v => v.id && !v.id.startsWith('temp-')).map(v => v.id);
      
      // Find variants to delete (existing but not in current list)
      const variantsToDelete = existingIds.filter(id => !currentIds.includes(id));
      
      console.log('Variant deletion check:', {
        existingIds,
        currentIds,
        variantsToDelete,
        variantsInState: variants.length
      });
      
      // Try to delete removed variants
      if (variantsToDelete.length > 0) {
        console.log(`Attempting to delete ${variantsToDelete.length} variant(s)...`);
        
        // First check if any variants are referenced in other tables
        const { data: purchaseRefs, error: purchaseError } = await supabase
          .from('purchase_items')
          .select('variant_id, id')
          .in('variant_id', variantsToDelete);

        const { data: cartRefs, error: cartError } = await supabase
          .from('cart_items')
          .select('variant_id, id')
          .in('variant_id', variantsToDelete);
        
        const { data: inventoryRefs, error: inventoryError } = await supabase
          .from('inventory_layers')
          .select('variant_id, id, quantity_remaining')
          .in('variant_id', variantsToDelete);

        if (purchaseRefs && purchaseRefs.length > 0) {
          const variantLabel = existingVariants?.find(v => v.id === purchaseRefs[0].variant_id)?.label || 'Unknown';
          toast.error(`Cannot delete variant "${variantLabel}" - it has ${purchaseRefs.length} purchase record(s). Keep the variant or use Extract to Product feature.`, {
            duration: 5000
          });
          return false;
        }

        if (cartRefs && cartRefs.length > 0) {
          const variantLabel = existingVariants?.find(v => v.id === cartRefs[0].variant_id)?.label || 'Unknown';
          toast.error(`Cannot delete variant "${variantLabel}" - it's in ${cartRefs.length} customer cart(s). Please wait or contact customers to remove.`, {
            duration: 5000
          });
          return false;
        }
        
        if (inventoryRefs && inventoryRefs.length > 0) {
          const totalInventory = inventoryRefs.reduce((sum, ref) => sum + (ref.quantity_remaining || 0), 0);
          const variantLabel = existingVariants?.find(v => v.id === inventoryRefs[0].variant_id)?.label || 'Unknown';
          toast.error(`Cannot delete variant "${variantLabel}" - it has ${inventoryRefs.length} inventory layer(s) with ${totalInventory} units remaining. Use Stock Adjustment to zero out inventory first.`, {
            duration: 6000
          });
          return false;
        }

        console.log('No references found, proceeding with deletion...');
        
        const { error: deleteError } = await supabase
          .from('product_variants')
          .delete()
          .in('id', variantsToDelete);

        if (deleteError) {
          console.error('Error deleting variants:', deleteError);
          toast.error("Database error while deleting variants: " + deleteError.message, {
            duration: 5000
          });
          return false;
        }
        
        toast.success(`Successfully deleted ${variantsToDelete.length} variant(s)`);
        console.log('Successfully deleted variants:', variantsToDelete);
      }

      // Update or insert variants
      for (const variant of variants) {
        const variantData = {
          product_id: productId,
          unit: variant.unit,
          quantity: variant.quantity,
          label: variant.label || `${variant.quantity || ''} ${variant.unit}`.trim(),
          price: variant.price,
          cost_price: variant.cost_price || null,
          wholesale_price: variant.wholesale_price || null,
          vip_price: variant.vip_price || null,
          barcode: variant.barcode?.trim() || null,
          stock_quantity: variant.stock_quantity,
          is_available: variant.is_available,
          is_default: variant.is_default,
        };

        if (variant.id) {
          // Update existing variant
          const { error } = await supabase
            .from('product_variants')
            .update(variantData)
            .eq('id', variant.id);

          if (error) throw error;
        } else {
          // Insert new variant
          const { error } = await supabase
            .from('product_variants')
            .insert(variantData);

          if (error) throw error;
        }
      }

      return true;
    } catch (error) {
      console.error('Error saving variants:', error);
      throw error;
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check if file type is supported
      const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      if (!supportedTypes.includes(file.type)) {
        toast.error(`${file.type.split('/')[1].toUpperCase()} format is not supported. Please use JPG, PNG, WEBP, or GIF.`);
        e.target.value = ''; // Clear the input
        return;
      }

      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setPreviewUrl(null);
    setImageUrl("");
  };

  const uploadImage = async (file: File, productId: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${productId}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingProduct) return;

    setUploadingImage(true);

    try {
      const formData = new FormData(e.currentTarget);
      const productData: any = {
        name: formData.get("name") as string,
        description: formData.get("description") as string,
        price: parseFloat(formData.get("price") as string) || 0,
        cost_price: parseFloat(formData.get("cost_price") as string) || null,
        wholesale_price: parseFloat(formData.get("wholesale_price") as string) || null,
        vip_price: parseFloat(formData.get("vip_price") as string) || null,
        unit: formData.get("unit") as string,
        category_id: formData.get("category_id") as string || null,
        store_id: formData.get("store_id") as string,
        supplier_id: formData.get("supplier_id") as string || null,
        stock_quantity: parseInt(formData.get("stock_quantity") as string) || 0,
        is_available: formData.get("is_available") === "true",
        is_available_online: formData.get("is_available_online") === "true",
        is_featured: formData.get("is_featured") === "true",
        barcode: (formData.get("barcode") as string)?.trim() || null,
      };

      console.log('Product data to save:', productData);

      if (isAddingNew) {
        // Check for duplicate product name in the same store
        const { data: existingProduct } = await supabase
          .from("products")
          .select("id, name")
          .eq("store_id", productData.store_id)
          .ilike("name", productData.name)
          .maybeSingle();

        if (existingProduct) {
          toast.error(`Product "${productData.name}" already exists in this store`);
          return;
        }

        // Insert new product
        const { data: newProduct, error: insertError } = await supabase
          .from("products")
          .insert(productData)
          .select()
          .single();

        if (insertError) throw insertError;

        // Upload image if selected
        if (selectedImage && newProduct) {
          const uploadedUrl = await uploadImage(selectedImage, newProduct.id);
          if (uploadedUrl) {
            await supabase
              .from("products")
              .update({ image_url: uploadedUrl })
              .eq("id", newProduct.id);
          }
        } else if (imageUrl.trim() && newProduct) {
          await supabase
            .from("products")
            .update({ image_url: imageUrl.trim() })
            .eq("id", newProduct.id);
        }

        // Save variants if any
        if (variants.length > 0 && newProduct) {
          await saveVariants(newProduct.id);
        }

        toast.success("Product created successfully");
        
        // Navigate back to Purchases if that's where we came from
        if (fromPurchases && newProduct) {
          navigate('/admin/purchases', { 
            state: { newProductId: newProduct.id },
            replace: true 
          });
          setFromPurchases(false);
          return;
        }
        
        // Navigate back to POS if that's where we came from
        if (fromPOS && newProduct) {
          navigate('/admin/pos', { 
            state: { newProductId: newProduct.id },
            replace: true 
          });
          setFromPOS(false);
          return;
        }
        
        // Navigate back to POS if that's where we came from (via returnPath)
        if (returnPath && newProduct) {
          navigate(returnPath, {
            state: { newProductId: newProduct.id }
          });
          setReturnPath(null);
          return;
        }
      } else {
        // Update existing product
        // Upload new image if selected
        if (selectedImage) {
          const uploadedUrl = await uploadImage(selectedImage, editingProduct.id);
          if (uploadedUrl) {
            productData.image_url = uploadedUrl;
          }
        } else if (imageUrl.trim()) {
          // Use provided image URL
          productData.image_url = imageUrl.trim();
        }

        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", editingProduct.id);

        if (error) {
          console.error('Product update error:', error);
          throw error;
        }

        console.log('Product updated successfully with barcode:', productData.barcode);

        // Save variants
        console.log('Calling saveVariants with productId:', editingProduct.id, 'current variants:', variants);
        const variantsSaved = await saveVariants(editingProduct.id);
        
        if (!variantsSaved) {
          // Variants failed to save, but product was updated
          toast.warning("Product updated, but some variants could not be changed");
          setIsDialogOpen(false);
          setSelectedImage(null);
          setPreviewUrl(null);
          setImageUrl("");
          setIsAddingNew(false);
          fetchProducts();
          return;
        }

        toast.success("Product updated successfully");
      }

      // Only close dialog and refresh if not navigating away
      if (!returnPath) {
        setIsDialogOpen(false);
        setSelectedImage(null);
        setPreviewUrl(null);
        setImageUrl("");
        setVariants([]);
        setIsAddingNew(false);
        fetchProducts();
      }
    } catch (error) {
      console.error("Error saving product:", error);
      toast.error(isAddingNew ? "Failed to create product" : "Failed to update product");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product? This action cannot be undone.")) return;

    try {
      // Get product name for error messages
      const { data: productData } = await supabase
        .from('products')
        .select('name')
        .eq('id', id)
        .single();
      
      const productName = productData?.name || 'this product';

      // Check for order items
      const { data: orderItemRefs } = await supabase
        .from('order_items')
        .select('id')
        .eq('product_id', id);

      if (orderItemRefs && orderItemRefs.length > 0) {
        toast.error(`Cannot delete "${productName}" - it's in ${orderItemRefs.length} order(s). Products with order history cannot be deleted.`, {
          duration: 6000
        });
        return;
      }

      // Check for POS transactions
      const { data: posTransactions } = await supabase
        .from('pos_transactions')
        .select('id')
        .like('items', `%${id}%`);

      if (posTransactions && posTransactions.length > 0) {
        toast.error(`Cannot delete "${productName}" - it's in ${posTransactions.length} POS transaction(s). Products with transaction history cannot be deleted.`, {
          duration: 6000
        });
        return;
      }

      // Check BOGO offers
      const { data: bogoRefs } = await supabase
        .from('bogo_offers')
        .select('id, name')
        .or(`buy_product_id.eq.${id},get_product_id.eq.${id}`);

      if (bogoRefs && bogoRefs.length > 0) {
        toast.error(`Cannot delete "${productName}" - it's used in ${bogoRefs.length} BOGO offer(s). Delete the offers first.`, {
          duration: 6000
        });
        return;
      }

      // Check combo offers
      const { data: comboRefs } = await supabase
        .from('combo_offer_items')
        .select('id')
        .eq('product_id', id);

      if (comboRefs && comboRefs.length > 0) {
        toast.error(`Cannot delete "${productName}" - it's in ${comboRefs.length} combo offer(s). Remove from combos first.`, {
          duration: 6000
        });
        return;
      }

      // Check production records
      const { data: productionRefs } = await supabase
        .from('productions')
        .select('id')
        .eq('source_product_id', id);

      const { data: outputRefs } = await supabase
        .from('production_outputs')
        .select('id')
        .eq('product_id', id);

      if ((productionRefs && productionRefs.length > 0) || (outputRefs && outputRefs.length > 0)) {
        const total = (productionRefs?.length || 0) + (outputRefs?.length || 0);
        toast.error(`Cannot delete "${productName}" - it's in ${total} production record(s). Products with production history cannot be deleted.`, {
          duration: 6000
        });
        return;
      }

      // First check if product has variants
      const { data: productVariants, error: variantsError } = await supabase
        .from('product_variants')
        .select('id, label')
        .eq('product_id', id);

      if (variantsError) throw variantsError;

      // Check for variant references
      if (productVariants && productVariants.length > 0) {
        const variantIds = productVariants.map(v => v.id);

        const { data: purchaseRefs } = await supabase
          .from('purchase_items')
          .select('variant_id, id')
          .in('variant_id', variantIds);

        const { data: cartRefs } = await supabase
          .from('cart_items')
          .select('variant_id, id')
          .in('variant_id', variantIds);
        
        const { data: inventoryRefs } = await supabase
          .from('inventory_layers')
          .select('variant_id, id, quantity_remaining')
          .in('variant_id', variantIds);

        if (purchaseRefs && purchaseRefs.length > 0) {
          const affectedVariants = [...new Set(purchaseRefs.map(r => r.variant_id))];
          const variantLabels = affectedVariants.map(vid => 
            productVariants.find(v => v.id === vid)?.label
          ).filter(Boolean).join(', ');
          
          toast.error(`Cannot delete "${productName}" - variant(s) [${variantLabels}] have ${purchaseRefs.length} purchase record(s). Use Extract to Product feature for each variant first.`, {
            duration: 6000
          });
          return;
        }

        if (cartRefs && cartRefs.length > 0) {
          const affectedVariants = [...new Set(cartRefs.map(r => r.variant_id))];
          const variantLabels = affectedVariants.map(vid => 
            productVariants.find(v => v.id === vid)?.label
          ).filter(Boolean).join(', ');
          
          toast.error(`Cannot delete "${productName}" - variant(s) [${variantLabels}] are in ${cartRefs.length} customer cart(s).`, {
            duration: 5000
          });
          return;
        }
        
        if (inventoryRefs && inventoryRefs.length > 0) {
          const totalInventory = inventoryRefs.reduce((sum, ref) => sum + (ref.quantity_remaining || 0), 0);
          const affectedVariants = [...new Set(inventoryRefs.map(r => r.variant_id))];
          const variantLabels = affectedVariants.map(vid => 
            productVariants.find(v => v.id === vid)?.label
          ).filter(Boolean).join(', ');
          
          toast.error(`Cannot delete "${productName}" - variant(s) [${variantLabels}] have ${inventoryRefs.length} inventory layer(s) with ${totalInventory} units remaining. Use Stock Adjustment first.`, {
            duration: 6000
          });
          return;
        }

        // Delete variants first if no references
        const { error: deleteVariantsError } = await supabase
          .from('product_variants')
          .delete()
          .eq('product_id', id);

        if (deleteVariantsError) throw deleteVariantsError;
      }

      // Check for product-level references
      const { data: productPurchaseRefs } = await supabase
        .from('purchase_items')
        .select('id')
        .eq('product_id', id)
        .is('variant_id', null);

      const { data: productCartRefs } = await supabase
        .from('cart_items')
        .select('id')
        .eq('product_id', id)
        .is('variant_id', null);

      const { data: productInventoryRefs } = await supabase
        .from('inventory_layers')
        .select('id, quantity_remaining')
        .eq('product_id', id)
        .is('variant_id', null);

      if (productPurchaseRefs && productPurchaseRefs.length > 0) {
        toast.error(`Cannot delete "${productName}" - it has ${productPurchaseRefs.length} purchase record(s).`, {
          duration: 5000
        });
        return;
      }

      if (productCartRefs && productCartRefs.length > 0) {
        toast.error(`Cannot delete "${productName}" - it's in ${productCartRefs.length} customer cart(s).`, {
          duration: 5000
        });
        return;
      }

      if (productInventoryRefs && productInventoryRefs.length > 0) {
        const totalInventory = productInventoryRefs.reduce((sum, ref) => sum + (ref.quantity_remaining || 0), 0);
        toast.error(`Cannot delete "${productName}" - it has ${productInventoryRefs.length} inventory layer(s) with ${totalInventory} units remaining. Use Stock Adjustment first.`, {
          duration: 6000
        });
        return;
      }

      // Finally delete the product
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Product deleted successfully");
      fetchProducts();
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error("Failed to delete product: " + (error as Error).message);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProducts.size === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedProducts.size} products?`)) return;

    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .in("id", Array.from(selectedProducts));

      if (error) throw error;

      toast.success(`${selectedProducts.size} products deleted successfully`);
      setSelectedProducts(new Set());
      fetchProducts();
    } catch (error) {
      console.error("Error deleting products:", error);
      toast.error("Failed to delete products");
    }
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedProducts.size === filteredProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const handleEnrichProduct = async (product: Product) => {
    setEnrichingIds(prev => new Set(prev).add(product.id));
    
    try {
      const { data, error } = await supabase.functions.invoke('enrich-product', {
        body: {
          productId: product.id,
          productName: product.name,
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success("Product enriched with AI-generated content!");
        fetchProducts();
      } else {
        throw new Error(data.error || "Failed to enrich product");
      }
    } catch (error) {
      console.error("Error enriching product:", error);
      toast.error("Failed to enrich product");
    } finally {
      setEnrichingIds(prev => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }
  };

  const handleEnrichAll = async () => {
    const productsToEnrich = products.filter(p => !p.description || !p.image_url);
    if (productsToEnrich.length === 0) {
      toast.info("All products already have descriptions and images!");
      return;
    }

    if (!confirm(`This will enrich ${productsToEnrich.length} products with AI-generated descriptions and images. Continue?`)) {
      return;
    }

    toast.info(`Enriching ${productsToEnrich.length} products... This may take a few minutes.`);
    
    let successCount = 0;
    for (const product of productsToEnrich) {
      try {
        await handleEnrichProduct(product);
        successCount++;
        // Add a small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to enrich ${product.name}:`, error);
      }
    }

    toast.success(`Successfully enriched ${successCount} out of ${productsToEnrich.length} products!`);
  };

  const normalizeProductName = (name: string): string => {
    // Convert to lowercase and trim
    let normalized = name.toLowerCase().trim();
    
    // Replace common abbreviations and variations
    const replacements: Record<string, string> = {
      'pineaple': 'pineapple',
      'bannana': 'banana',
      'chocollate': 'chocolate',
      'strwberry': 'strawberry',
      'orng': 'orange',
      'vanila': 'vanilla',
      'coco': 'coconut',
      'crsh': 'crush',
      'jce': 'juice',
      'btl': 'bottle',
      'pk': 'pack',
      'pkt': 'packet',
    };
    
    // Apply replacements
    Object.entries(replacements).forEach(([wrong, correct]) => {
      normalized = normalized.replace(new RegExp(`\\b${wrong}\\b`, 'g'), correct);
    });
    
    // Standardize measurement units
    normalized = normalized
      .replace(/(\d+)\s*m\s*l\b/gi, '$1ml')
      .replace(/(\d+)\s*l\s*t\s*r\b/gi, '$1ltr')
      .replace(/(\d+)\s*g\s*m\s*s?\b/gi, '$1g')
      .replace(/(\d+)\s*k\s*g\b/gi, '$1kg')
      .replace(/\b(litre|liter)\b/gi, 'ltr');
    
    // Remove measurements from the core name for comparison
    normalized = normalized
      .replace(/\s*\d+\s*(ml|l|ltr|litre|liter|g|gm|gms|kg|oz|lb|pack|pcs|pieces?)\s*/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Remove special characters and punctuation
    normalized = normalized.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    
    return normalized;
  };

  const extractBrand = (name: string): string => {
    // Common brand patterns at start of name
    const normalized = name.toLowerCase().trim();
    const words = normalized.split(/\s+/);
    
    // Typically brand is first 1-2 words
    if (words.length >= 2) {
      const firstTwo = words.slice(0, 2).join(' ');
      // If first word is very short (1-2 chars), include second word
      if (words[0].length <= 2) {
        return words.slice(0, 2).join(' ');
      }
      return words[0];
    }
    
    return words[0] || '';
  };

  const getSignificantTokens = (name: string): string[] => {
    const normalized = normalizeProductName(name);
    const tokens = normalized.split(' ').filter(t => t.length > 2);
    
    // Remove common filler words
    const fillerWords = new Set(['and', 'with', 'the', 'for', 'new', 'fresh', 'pure', 'natural', 'organic']);
    return tokens.filter(t => !fillerWords.has(t));
  };

  const calculateTokenSimilarity = (tokens1: string[], tokens2: string[]): number => {
    if (tokens1.length === 0 || tokens2.length === 0) return 0;
    
    let matches = 0;
    
    for (const t1 of tokens1) {
      for (const t2 of tokens2) {
        // Exact match
        if (t1 === t2) {
          matches += 1;
          break;
        }
        // One contains the other (for truncated words)
        if (t1.length >= 4 && t2.length >= 4) {
          if (t1.includes(t2) || t2.includes(t1)) {
            matches += 0.8;
            break;
          }
          // Check if they share a significant prefix (first 4 chars)
          if (t1.substring(0, 4) === t2.substring(0, 4)) {
            matches += 0.7;
            break;
          }
        }
      }
    }
    
    const minTokens = Math.min(tokens1.length, tokens2.length);
    return matches / minTokens;
  };

  const areProductsDuplicate = (name1: string, name2: string): boolean => {
    const norm1 = normalizeProductName(name1);
    const norm2 = normalizeProductName(name2);
    
    // Exact match after normalization
    if (norm1 === norm2) return true;
    
    // Extract and compare brands
    const brand1 = extractBrand(name1);
    const brand2 = extractBrand(name2);
    
    // Different brands = not duplicates (unless brands are very similar)
    if (brand1 && brand2 && brand1 !== brand2) {
      if (!brand1.includes(brand2) && !brand2.includes(brand1)) {
        // Check if brands are similar enough
        if (calculateSimilarity(brand1, brand2) < 0.7) {
          return false;
        }
      }
    }
    
    // Get significant tokens
    const tokens1 = getSignificantTokens(name1);
    const tokens2 = getSignificantTokens(name2);
    
    // Need at least 2 tokens to compare meaningfully
    if (tokens1.length < 2 || tokens2.length < 2) {
      return calculateSimilarity(norm1, norm2) > 0.92; // Very high threshold for short names
    }
    
    // Calculate token similarity
    const tokenSimilarity = calculateTokenSimilarity(tokens1, tokens2);
    
    // High token overlap means likely duplicate
    if (tokenSimilarity >= 0.85) return true;
    
    // Medium token overlap with high string similarity
    if (tokenSimilarity >= 0.7 && calculateSimilarity(norm1, norm2) > 0.85) return true;
    
    // Use Levenshtein distance as final check with very high threshold
    return calculateSimilarity(norm1, norm2) > 0.9;
  };

  const findDuplicateProducts = () => {
    // Toggle between showing duplicates and all products
    if (showDuplicates) {
      setShowDuplicates(false);
      setDuplicateGroups([]);
      return;
    }

    console.log('Finding duplicate products with enhanced matching...');
    const duplicates: Product[][] = [];
    const processed = new Set<string>();

    products.forEach((product, index) => {
      if (processed.has(product.id)) return;

      const similarProducts: Product[] = [product];
      processed.add(product.id);

      // Compare with remaining products
      for (let i = index + 1; i < products.length; i++) {
        const otherProduct = products[i];
        if (processed.has(otherProduct.id)) continue;

        // Check if products are duplicates
        if (areProductsDuplicate(product.name, otherProduct.name)) {
          similarProducts.push(otherProduct);
          processed.add(otherProduct.id);
        }
      }

      // Only add groups with 2 or more similar products
      if (similarProducts.length >= 2) {
        duplicates.push(similarProducts);
      }
    });

    console.log('Found duplicate groups:', duplicates.length);
    setDuplicateGroups(duplicates);
    setShowDuplicates(true);

    if (duplicates.length === 0) {
      toast.info("No duplicate products found!");
    } else {
      toast.success(`Found ${duplicates.length} groups of duplicate products`);
    }
  };

  const calculateSimilarity = (str1: string, str2: string): number => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = getEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  };

  const getEditDistance = (str1: string, str2: string): number => {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <p>Loading products...</p>
        </main>
        <BottomNav />
      </div>
    );
  }

  const filteredProducts = (showDuplicates ? duplicateGroups.flat() : products).filter(product => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      product.name.toLowerCase().includes(query) ||
      (product.description?.toLowerCase() || '').includes(query) ||
      (product.categories?.name?.toLowerCase() || '').includes(query);

    const matchesCategory = filterCategory === "all" || product.category_id === filterCategory;
    const matchesStore = filterStore === "all" || product.store_id === filterStore;
    const matchesAvailability = 
      filterAvailability === "unavailable" ? !product.is_available : product.is_available;
    const matchesFeatured =
      filterFeatured === "all" ||
      (filterFeatured === "featured" && product.is_featured) ||
      (filterFeatured === "not-featured" && !product.is_featured);
    const matchesStock = 
      filterStock === "all" ||
      (filterStock === "in-stock" && product.stock_quantity > 0) ||
      (filterStock === "out-of-stock" && product.stock_quantity === 0);
    const matchesVariants = 
      filterVariants === "all" ||
      (filterVariants === "with-variants" && product.product_variants && product.product_variants.length > 0) ||
      (filterVariants === "without-variants" && (!product.product_variants || product.product_variants.length === 0));

    return matchesSearch && matchesCategory && matchesStore && matchesAvailability && matchesFeatured && matchesStock && matchesVariants;
  });

  console.log('Admin: Total products:', products.length, 'Filtered:', filteredProducts.length, 'Search:', searchQuery);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 pb-20">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* Modern Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold">Product Management</h1>
              <p className="text-muted-foreground text-xs">
                {showDuplicates 
                  ? `${duplicateGroups.length} duplicate groups (${filteredProducts.length} products)`
                  : `${filteredProducts.length} products`
                }
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <ReturnToPOSButton inline />
              <Button
                onClick={handleAdd}
                size="sm"
                className="gap-2"
              >
                <Plus className="h-3 w-3" />
                Add
              </Button>
              {selectedProducts.size > 0 && (
                <>
                  <Button 
                    onClick={handleBulkDelete}
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete ({selectedProducts.size})
                  </Button>
                  {selectedProducts.size >= 2 && (
                    <Button 
                      onClick={() => setIsMergeDialogOpen(true)}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      <Merge className="h-3 w-3" />
                      Merge ({selectedProducts.size})
                    </Button>
                  )}
                </>
              )}
              <Button 
                onClick={handleEnrichAll}
                size="sm"
                className="gap-2"
              >
                <Sparkles className="h-3 w-3" />
                AI Enrich
              </Button>
              <Button 
                onClick={findDuplicateProducts}
                variant={showDuplicates ? "default" : "outline"}
                size="sm"
                className="gap-2"
              >
                <Search className="h-3 w-3" />
                {showDuplicates ? "Show All" : "Find Duplicates"}
              </Button>
              <Button 
                onClick={() => setIsExportDialogOpen(true)}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Download className="h-3 w-3" />
                Export
              </Button>
            </div>
          </div>
        </div>

        <div className="mb-4 space-y-3">
          {/* Modern Filters Section */}
          <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="filter-category" className="text-xs font-medium">Category</Label>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger id="filter-category" className="h-9 text-sm">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="filter-store" className="text-xs font-medium">Store</Label>
                  <Select value={filterStore} onValueChange={setFilterStore}>
                    <SelectTrigger id="filter-store" className="h-9 text-sm">
                      <SelectValue placeholder="All Stores" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stores</SelectItem>
                      {stores.map(store => (
                        <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="filter-availability" className="text-xs font-medium">Availability</Label>
                  <Select value={filterAvailability} onValueChange={setFilterAvailability}>
                    <SelectTrigger id="filter-availability" className="h-9 text-sm">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="unavailable">Unavailable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="filter-featured" className="text-xs font-medium">Featured</Label>
                  <Select value={filterFeatured} onValueChange={setFilterFeatured}>
                    <SelectTrigger id="filter-featured" className="h-9 text-sm">
                      <SelectValue placeholder="All Products" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Products</SelectItem>
                      <SelectItem value="featured">Featured Only</SelectItem>
                      <SelectItem value="not-featured">Not Featured</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="filter-stock" className="text-xs font-medium">Stock Level</Label>
                  <Select value={filterStock} onValueChange={setFilterStock}>
                    <SelectTrigger id="filter-stock" className="h-9 text-sm">
                      <SelectValue placeholder="All Stock" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stock</SelectItem>
                      <SelectItem value="in-stock">In Stock</SelectItem>
                      <SelectItem value="out-of-stock">Out of Stock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="filter-variants" className="text-xs font-medium">Variants</Label>
                  <Select value={filterVariants} onValueChange={setFilterVariants}>
                    <SelectTrigger id="filter-variants" className="h-9 text-sm">
                      <SelectValue placeholder="All Products" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Products</SelectItem>
                      <SelectItem value="with-variants">With Variants</SelectItem>
                      <SelectItem value="without-variants">Without Variants</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Clear Filters Button */}
              {(filterCategory !== "all" || filterStore !== "all" || filterAvailability !== "all" || filterFeatured !== "all" || filterStock !== "all") && (
                <div className="mt-3">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setFilterCategory("all");
                      setFilterStore("all");
                      setFilterAvailability("all");
                      setFilterFeatured("all");
                      setFilterStock("all");
                    }}
                    className="h-8 text-xs"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear Filters
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Modern Search Bar */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search products..."
                className="pl-9 h-9 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            {/* View Toggle */}
            <div className="flex border rounded-lg overflow-hidden">
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="rounded-none h-9 px-3"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
                className="rounded-none h-9 px-3"
              >
                <Grid className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {searchQuery && (
            <div className="text-xs text-muted-foreground">
              Found {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
            </div>
          )}
        </div>

        {/* Products Display - Table or Grid */}
        {viewMode === "list" ? (
          <Card className="shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10 h-9">
                    <Checkbox 
                      checked={selectedProducts.size === filteredProducts.length && filteredProducts.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="text-xs font-semibold h-9">Product</TableHead>
                  <TableHead className="text-xs font-semibold h-9">Barcode</TableHead>
                  <TableHead className="text-xs font-semibold h-9">Category</TableHead>
                  <TableHead className="text-xs font-semibold h-9">Supplier</TableHead>
                  <TableHead className="text-xs font-semibold h-9">Store</TableHead>
                  <TableHead className="text-right text-xs font-semibold h-9">Stock</TableHead>
                  <TableHead className="text-right text-xs font-semibold h-9">Price</TableHead>
                  <TableHead className="text-xs font-semibold h-9">Status</TableHead>
                  <TableHead className="text-right text-xs font-semibold h-9 w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <Package className="h-10 w-10 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">
                          {searchQuery ? `No products found` : "No products"}
                        </p>
                        {!searchQuery && (
                          <Button onClick={handleAdd} size="sm" className="gap-2 mt-2">
                            <Plus className="h-3 w-3" />
                            Add Product
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  showDuplicates ? (
                    // Render duplicate groups with visual separation
                    duplicateGroups.map((group, groupIndex) => (
                      <Fragment key={groupIndex}>
                        {group.map((product, productIndex) => (
                          <TableRow 
                            key={product.id} 
                            className={`group ${productIndex === 0 ? 'border-t-2 border-primary/20' : ''}`}
                          >
                            <TableCell className="py-2">
                              <Checkbox
                                checked={selectedProducts.has(product.id)}
                                onCheckedChange={() => toggleProductSelection(product.id)}
                              />
                            </TableCell>
                            <TableCell className="py-2">
                              <div className="flex items-center gap-2">
                                {productIndex === 0 && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 mr-1">
                                    {group.length}x
                                  </Badge>
                                )}
                                {product.image_url ? (
                                  <img 
                                    src={product.image_url} 
                                    alt={product.name}
                                    className="w-8 h-8 rounded object-cover"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-sm">
                                    📦
                                  </div>
                                 )}
                                 <div className="min-w-0">
                                   <TooltipProvider>
                                     <Tooltip>
                                       <TooltipTrigger asChild>
                                         <div className="font-medium text-xs truncate max-w-[200px] cursor-help">{product.name}</div>
                                       </TooltipTrigger>
                                       <TooltipContent>
                                         <p className="max-w-xs">{product.name}</p>
                                       </TooltipContent>
                                     </Tooltip>
                                   </TooltipProvider>
                                   {product.product_variants && product.product_variants.length > 0 && (
                                    <div className="text-[10px] text-muted-foreground">
                                      {product.product_variants.length} variants
                                    </div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground py-2">
                              {product.barcode ? (
                                (() => {
                                  const barcodes = product.barcode.split(',').map(b => b.trim()).filter(b => b);
                                  if (barcodes.length === 1) {
                                    return barcodes[0];
                                  }
                                  return (
                                    <span title={barcodes.join(', ')}>
                                      {barcodes[0]} <span className="text-[10px] text-primary">+{barcodes.length - 1}</span>
                                    </span>
                                  );
                                })()
                              ) : '-'}
                            </TableCell>
                            <TableCell className="text-xs py-2">
                              {product.categories?.name || '-'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground py-2">
                              {product.contacts?.name || '-'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground py-2">
                              {product.stores?.name || '-'}
                            </TableCell>
                            <TableCell className="text-right py-2">
                              {(() => {
                                const stock = product.stock_quantity ?? 0;
                                const isNegative = stock < 0;
                                const isPositive = stock > 0;
                                return (
                                  <span 
                                    className={`text-xs font-semibold ${
                                      isNegative 
                                        ? 'text-red-600' 
                                        : isPositive 
                                        ? 'text-green-600' 
                                        : 'text-muted-foreground'
                                    }`}
                                  >
                                    {isNegative ? '-' : ''}{Math.abs(stock)}
                                  </span>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="text-right py-2">
                              {product.product_variants && product.product_variants.length > 0 ? (
                                <div className="text-xs font-medium">
                                  {formatCurrency(Math.min(...product.product_variants.map(v => v.price)))} - {formatCurrency(Math.max(...product.product_variants.map(v => v.price)))}
                                </div>
                              ) : (
                                <span className="text-xs font-medium">{formatCurrency(product.price)}</span>
                              )}
                            </TableCell>
                            <TableCell className="py-2">
                              <div className="flex items-center gap-1">
                                <Badge variant={product.is_available ? 'default' : 'secondary'} className="text-[10px] h-5">
                                  {product.is_available ? 'Available' : 'N/A'}
                                </Badge>
                                {product.is_featured && (
                                  <Badge variant="outline" className="text-[10px] h-5">⭐</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right py-2">
                              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(product)}
                                  title="Edit"
                                  className="h-7 w-7 p-0 hover:text-primary"
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (confirm("Delete this product?")) {
                                      handleDelete(product.id);
                                    }
                                  }}
                                  title="Delete"
                                  className="h-7 w-7 p-0 hover:text-destructive"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </Fragment>
                    ))
                  ) : (
                    // Regular product list
                    filteredProducts.map((product) => (
                      <TableRow key={product.id} className="group">
                        <TableCell className="py-2">
                          <Checkbox
                            checked={selectedProducts.has(product.id)}
                            onCheckedChange={() => toggleProductSelection(product.id)}
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex items-center gap-2">
                            {product.image_url ? (
                              <img 
                                src={product.image_url} 
                                alt={product.name}
                                className="w-8 h-8 rounded object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-sm">
                                📦
                              </div>
                             )}
                             <div className="min-w-0">
                               <TooltipProvider>
                                 <Tooltip>
                                   <TooltipTrigger asChild>
                                     <div className="font-medium text-xs truncate max-w-[200px] cursor-help">{product.name}</div>
                                   </TooltipTrigger>
                                   <TooltipContent>
                                     <p className="max-w-xs">{product.name}</p>
                                   </TooltipContent>
                                 </Tooltip>
                               </TooltipProvider>
                               {product.product_variants && product.product_variants.length > 0 && (
                                <div className="text-[10px] text-muted-foreground">
                                  {product.product_variants.length} variants
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground py-2">
                          {product.barcode ? (
                            (() => {
                              const barcodes = product.barcode.split(',').map(b => b.trim()).filter(b => b);
                              if (barcodes.length === 1) {
                                return barcodes[0];
                              }
                              return (
                                <span title={barcodes.join(', ')}>
                                  {barcodes[0]} <span className="text-[10px] text-primary">+{barcodes.length - 1}</span>
                                </span>
                              );
                            })()
                          ) : '-'}
                        </TableCell>
                      <TableCell className="text-xs py-2">
                        {product.categories?.name || '-'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground py-2">
                        {product.contacts?.name || '-'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground py-2">
                        {product.stores?.name || '-'}
                      </TableCell>
                      <TableCell className="text-right py-2">
                        {(() => {
                          const stock = product.stock_quantity ?? 0;
                          const isNegative = stock < 0;
                          const isPositive = stock > 0;
                          return (
                            <span 
                              className={`text-xs font-semibold ${
                                isNegative 
                                  ? 'text-red-600' 
                                  : isPositive 
                                  ? 'text-green-600' 
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {isNegative ? '-' : ''}{Math.abs(stock)}
                            </span>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-right py-2">
                        {product.product_variants && product.product_variants.length > 0 ? (
                          <div className="text-xs font-medium">
                            {formatCurrency(Math.min(...product.product_variants.map(v => v.price)))} - {formatCurrency(Math.max(...product.product_variants.map(v => v.price)))}
                          </div>
                        ) : (
                          <span className="text-xs font-medium">{formatCurrency(product.price)}</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-1">
                          <Badge variant={product.is_available ? 'default' : 'secondary'} className="text-[10px] h-5">
                            {product.is_available ? 'Available' : 'N/A'}
                          </Badge>
                          {product.is_featured && (
                            <Badge variant="outline" className="text-[10px] h-5">⭐</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-2">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEnrichProduct(product)}
                            disabled={enrichingIds.has(product.id)}
                            title="AI Enrich"
                            className="h-7 w-7 p-0"
                          >
                            <Sparkles className={`h-3 w-3 ${enrichingIds.has(product.id) ? 'animate-spin' : ''}`} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(product)}
                            title="Edit"
                            className="h-7 w-7 p-0"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(product.id)}
                            title="Delete"
                            className="h-7 w-7 p-0 hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )
              )}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredProducts.length === 0 ? (
              <div className="col-span-full">
                <Card className="shadow-sm">
                  <CardContent className="p-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-10 w-10 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">
                        {searchQuery ? `No products found` : "No products"}
                      </p>
                      {!searchQuery && (
                        <Button onClick={handleAdd} size="sm" className="gap-2 mt-2">
                          <Plus className="h-3 w-3" />
                          Add Product
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              filteredProducts.map((product) => (
                <Card key={product.id} className="group hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2 p-3">
                    <div className="flex items-start justify-between mb-2">
                      <Checkbox
                        checked={selectedProducts.has(product.id)}
                        onCheckedChange={() => toggleProductSelection(product.id)}
                      />
                      {product.is_featured && (
                        <Badge variant="outline" className="text-[10px] h-5">⭐</Badge>
                      )}
                    </div>
                    {product.image_url ? (
                      <img 
                        src={product.image_url} 
                        alt={product.name}
                        className="w-full h-24 object-cover rounded"
                      />
                    ) : (
                      <div className="w-full h-24 bg-muted rounded flex items-center justify-center text-3xl">
                         📦
                       </div>
                     )}
                     <TooltipProvider>
                       <Tooltip>
                         <TooltipTrigger asChild>
                           <CardTitle className="text-sm mt-2 line-clamp-2 leading-tight cursor-help">{product.name}</CardTitle>
                         </TooltipTrigger>
                         <TooltipContent>
                           <p className="max-w-xs">{product.name}</p>
                         </TooltipContent>
                       </Tooltip>
                     </TooltipProvider>
                     <CardDescription className="text-xs">
                      {product.categories?.name || 'Uncategorized'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-1.5 p-3 pt-0">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Barcode:</span>
                      <span className="font-medium text-[10px] truncate max-w-[100px]">{product.barcode || '-'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Stock:</span>
                      {(() => {
                        const stock = product.stock_quantity ?? 0;
                        const isNegative = stock < 0;
                        const isPositive = stock > 0;
                        return (
                          <span 
                            className={`font-semibold text-xs ${
                              isNegative 
                                ? 'text-red-600' 
                                : isPositive 
                                ? 'text-green-600' 
                                : 'text-muted-foreground'
                            }`}
                          >
                            {isNegative ? '-' : ''}{Math.abs(stock)}
                          </span>
                        );
                      })()}
                    </div>
                    {product.product_variants && product.product_variants.length > 0 ? (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Variants:</span>
                        <span className="font-medium text-xs">{product.product_variants.length}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Price:</span>
                      <span className="font-semibold text-xs">
                        {product.product_variants && product.product_variants.length > 0 
                          ? `${formatCurrency(Math.min(...product.product_variants.map(v => v.price)))} - ${formatCurrency(Math.max(...product.product_variants.map(v => v.price)))}`
                          : formatCurrency(product.price)
                        }
                      </span>
                    </div>
                    <div className="flex justify-between text-xs items-center">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge variant={product.is_available ? 'default' : 'secondary'} className="text-[10px] h-5">
                        {product.is_available ? 'Available' : 'N/A'}
                      </Badge>
                    </div>
                    <div className="flex gap-1 pt-2 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEnrichProduct(product)}
                        disabled={enrichingIds.has(product.id)}
                        title="AI Enrich"
                        className="flex-1 h-7"
                      >
                        <Sparkles className={`h-3 w-3 ${enrichingIds.has(product.id) ? 'animate-spin' : ''}`} />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(product)}
                        title="Edit"
                        className="flex-1 h-7"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(product.id)}
                        title="Delete"
                        className="flex-1 h-7"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {filteredProducts.length > 0 && (
          <div className="text-center text-xs text-muted-foreground mt-3">
            Showing {filteredProducts.length} of {products.length} products
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                {isAddingNew ? 'Add Product' : 'Edit Product'}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                {isAddingNew ? 'Fill in product details' : 'Update product information'}
              </p>
            </DialogHeader>
            {editingProduct && (
              <form onSubmit={handleSave} className="space-y-4 mt-4">
                {/* Basic Information Section */}
                <Card className="border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Basic Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label htmlFor="name" className="text-xs">Product Name *</Label>
                      <Input
                        id="name"
                        name="name"
                        defaultValue={editingProduct.name}
                        required
                        placeholder="e.g., Fresh Tomatoes"
                        className="h-9 text-sm"
                      />
                    </div>

                    <div>
                      <Label htmlFor="description" className="text-xs">Description</Label>
                      <Textarea
                        id="description"
                        name="description"
                        defaultValue={editingProduct.description || ""}
                        rows={2}
                        placeholder="Product description..."
                        className="text-sm"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Product Image Section */}
                <Card className="border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Product Image
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(previewUrl || imageUrl || editingProduct.image_url) && (
                      <div className="relative w-32 h-32 mx-auto">
                        <img 
                          src={previewUrl || imageUrl || editingProduct.image_url || ''} 
                          alt="Product preview"
                          className="w-full h-full object-cover rounded border-2 border-border"
                        />
                        {(previewUrl || imageUrl) && (
                          <Button
                            type="button"
                            size="icon"
                            variant="destructive"
                            className="absolute -top-2 -right-2 h-6 w-6"
                            onClick={handleRemoveImage}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    )}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 justify-center">
                        <Input
                          id="image"
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                          onChange={handleImageSelect}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById('image')?.click()}
                          className="gap-2"
                        >
                          <Upload className="h-3 w-3" />
                          {editingProduct.image_url ? 'Change' : 'Upload'}
                        </Button>
                      </div>
                      <div className="text-center text-xs text-muted-foreground">or</div>
                      <div>
                        <Label htmlFor="imageUrl" className="text-xs">Paste Image URL</Label>
                        <Input
                          id="imageUrl"
                          type="url"
                          placeholder="https://..."
                          value={imageUrl}
                          onChange={(e) => setImageUrl(e.target.value)}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Pricing Section */}
                <Card className="border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span className="text-lg">₣</span>
                      Pricing & Unit
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                      <div>
                        <Label htmlFor="price" className="text-xs">Retail Price *</Label>
                        <Input
                          id="price"
                          name="price"
                          type="number"
                          step="0.01"
                          defaultValue={editingProduct.price}
                          required={variants.length === 0}
                          placeholder="0.00"
                          className="h-9 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="wholesale_price" className="text-xs">Wholesale</Label>
                        <Input
                          id="wholesale_price"
                          name="wholesale_price"
                          type="number"
                          step="0.01"
                          defaultValue={editingProduct.wholesale_price}
                          placeholder="0.00"
                          className="h-9 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="vip_price" className="text-xs">VIP Price</Label>
                        <Input
                          id="vip_price"
                          name="vip_price"
                          type="number"
                          step="0.01"
                          defaultValue={editingProduct.vip_price}
                          placeholder="0.00"
                          className="h-9 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="cost_price" className="text-xs">Cost Price</Label>
                        <Input
                          id="cost_price"
                          name="cost_price"
                          type="number"
                          step="0.01"
                          defaultValue={editingProduct.cost_price}
                          placeholder="0.00"
                          className="h-9 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="unit" className="text-xs">Unit *</Label>
                        <Select name="unit" defaultValue={editingProduct.unit} required>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select unit" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pcs">pcs</SelectItem>
                            <SelectItem value="gm">gm</SelectItem>
                            <SelectItem value="kg">kg</SelectItem>
                            <SelectItem value="ltr">ltr</SelectItem>
                            <SelectItem value="ml">ml</SelectItem>
                            <SelectItem value="dozen">dozen</SelectItem>
                            <SelectItem value="pack">pack</SelectItem>
                            <SelectItem value="box">box</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Product Variants Section */}
                <Card className="border-border/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Grid3x3 className="h-4 w-4" />
                        Variants
                      </CardTitle>
                      <Button 
                        type="button" 
                        size="sm" 
                        onClick={() => setShowVariants(!showVariants)} 
                        variant="ghost"
                        className="h-7 text-xs"
                      >
                        {showVariants ? 'Hide' : 'Show'} ({variants.length})
                      </Button>
                    </div>
                  </CardHeader>
                  
                  {showVariants && (
                    <CardContent className="space-y-3 pt-3">
                      {variants.map((variant, index) => (
                        <Card key={variant.id} className="border">
                          <CardContent className="p-3 space-y-3">
                            <div className="grid grid-cols-12 gap-2">
                              <div className="col-span-6 md:col-span-2">
                                <Label className="text-[10px] font-medium">Quantity</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={variant.quantity || ''}
                                  onChange={(e) => updateVariant(index, 'quantity', parseFloat(e.target.value) || 0)}
                                  className="h-8 text-xs"
                                  placeholder="500"
                                />
                              </div>
                              <div className="col-span-6 md:col-span-2">
                                <Label className="text-[10px] font-medium">Unit</Label>
                                <Select value={variant.unit} onValueChange={(value) => updateVariant(index, 'unit', value)}>
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pcs">pcs</SelectItem>
                                    <SelectItem value="gm">gm</SelectItem>
                                    <SelectItem value="kg">kg</SelectItem>
                                    <SelectItem value="ltr">ltr</SelectItem>
                                    <SelectItem value="ml">ml</SelectItem>
                                    <SelectItem value="dozen">dozen</SelectItem>
                                    <SelectItem value="pack">pack</SelectItem>
                                    <SelectItem value="box">box</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="col-span-6 md:col-span-2">
                                <Label className="text-[10px] font-medium">Retail</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={variant.price}
                                  onChange={(e) => updateVariant(index, 'price', parseFloat(e.target.value) || 0)}
                                  className="h-8 text-xs"
                                  placeholder="0.00"
                                />
                              </div>
                              <div className="col-span-6 md:col-span-2">
                                <Label className="text-[10px] font-medium">Wholesale</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={variant.wholesale_price || ''}
                                  onChange={(e) => updateVariant(index, 'wholesale_price', parseFloat(e.target.value) || 0)}
                                  className="h-8 text-xs"
                                  placeholder="0.00"
                                />
                              </div>
                              <div className="col-span-6 md:col-span-2">
                                <Label className="text-[10px] font-medium">VIP</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={variant.vip_price || ''}
                                  onChange={(e) => updateVariant(index, 'vip_price', parseFloat(e.target.value) || 0)}
                                  className="h-8 text-xs"
                                  placeholder="0.00"
                                />
                              </div>
                              <div className="col-span-6 md:col-span-2">
                                <Label className="text-[10px] font-medium">Cost</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={variant.cost_price || ''}
                                  onChange={(e) => updateVariant(index, 'cost_price', parseFloat(e.target.value) || 0)}
                                  className="h-8 text-xs"
                                  placeholder="0.00"
                                />
                              </div>
                              <div className="col-span-6 md:col-span-2">
                                <Label className="text-[10px] font-medium">Stock</Label>
                                <Input
                                  type="number"
                                  value={variant.stock_quantity}
                                  onChange={(e) => updateVariant(index, 'stock_quantity', parseInt(e.target.value) || 0)}
                                  className="h-8 text-xs"
                                  placeholder="0"
                                />
                              </div>
                              <div className="col-span-6 md:col-span-1">
                                <Label className="text-[10px] font-medium">Active</Label>
                                <Select value={variant.is_available.toString()} onValueChange={(value) => updateVariant(index, 'is_available', value === 'true')}>
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="true">✓</SelectItem>
                                    <SelectItem value="false">✗</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="col-span-6 md:col-span-2 flex items-end gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => extractVariantAsProduct(variant)}
                                  className="h-8 flex-1 hover:bg-primary/10"
                                  title="Extract as new product"
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeVariant(index)}
                                  className="h-8 flex-1 text-destructive hover:text-destructive hover:bg-destructive/20"
                                  title="Delete variant"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            <div>
                              <Label className="text-[10px] font-medium">Barcode(s)</Label>
                              <Input
                                type="text"
                                value={variant.barcode || ''}
                                onChange={(e) => updateVariant(index, 'barcode', e.target.value)}
                                className="h-8 text-xs"
                                placeholder="Barcode(s), comma-separated"
                              />
                              <p className="text-[9px] text-muted-foreground mt-0.5">Separate with commas</p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      <Button 
                        type="button" 
                        size="sm" 
                        onClick={addVariant} 
                        variant="outline" 
                        className="w-full h-8 text-xs"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Variant
                      </Button>
                    </CardContent>
                  )}
                </Card>

                {/* Inventory & Classification Section */}
                <Card className="border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Search className="h-4 w-4" />
                      Inventory & Classification
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <Label htmlFor="category_id" className="text-xs">Category</Label>
                        <Select name="category_id" defaultValue={editingProduct.category_id || ""}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="supplier_id" className="text-xs">Supplier</Label>
                        <Select name="supplier_id" defaultValue={editingProduct.supplier_id || ""}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select supplier" />
                          </SelectTrigger>
                          <SelectContent>
                            {suppliers.map((supplier) => (
                              <SelectItem key={supplier.id} value={supplier.id}>
                                {supplier.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="store_id" className="text-xs">Store *</Label>
                        <Select name="store_id" defaultValue={editingProduct.store_id} required>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select store" />
                          </SelectTrigger>
                          <SelectContent>
                            {stores.map((store) => (
                              <SelectItem key={store.id} value={store.id}>
                                {store.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="stock_quantity" className="text-xs">Stock Quantity *</Label>
                        <Input
                          id="stock_quantity"
                          name="stock_quantity"
                          type="number"
                          defaultValue={editingProduct.stock_quantity}
                          required
                          placeholder="0"
                          className="h-9 text-sm"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="barcode" className="text-xs">Barcode(s)</Label>
                        <Input
                          id="barcode"
                          name="barcode"
                          type="text"
                          defaultValue={(editingProduct as any).barcode || ''}
                          placeholder="Enter barcode(s), separate with comma for multiple"
                          className="h-9 text-sm"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">Separate multiple barcodes with commas (e.g., 123456,789012)</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Settings Section */}
                <Card className="border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="is_available" className="text-xs">Availability *</Label>
                        <Select name="is_available" defaultValue={editingProduct.is_available.toString()}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">✓ Available</SelectItem>
                            <SelectItem value="false">✗ Unavailable</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="is_available_online" className="text-xs">Available for Online Sale</Label>
                        <Select name="is_available_online" defaultValue={editingProduct.is_available_online?.toString() ?? "true"}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">🌐 Yes</SelectItem>
                            <SelectItem value="false">No</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="is_featured" className="text-xs">Featured</Label>
                        <Select name="is_featured" defaultValue={editingProduct.is_featured?.toString() || "false"}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">⭐ Yes</SelectItem>
                            <SelectItem value="false">No</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex gap-2 justify-end pt-4 border-t">
                  <Button 
                    type="button" 
                    variant="outline"
                    size="sm"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    size="sm"
                    disabled={uploadingImage}
                    className="gap-2"
                  >
                    {uploadingImage ? (
                      <>
                        <div className="h-3 w-3 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Package className="h-3 w-3" />
                        Save
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </main>

      <MergeProductsDialog
        open={isMergeDialogOpen}
        onOpenChange={setIsMergeDialogOpen}
        products={products.filter(p => selectedProducts.has(p.id))}
        onSuccess={() => {
          const mergedProductIds = Array.from(selectedProducts);
          
          // Update duplicate groups immediately by removing merged products
          if (showDuplicates && duplicateGroups.length > 0) {
            const updatedGroups = duplicateGroups
              .map(group => group.filter(p => !mergedProductIds.includes(p.id)))
              .filter(group => group.length >= 2); // Keep only groups with 2+ products
            
            setDuplicateGroups(updatedGroups);
            
            // If no more duplicate groups, exit duplicate view
            if (updatedGroups.length === 0) {
              setShowDuplicates(false);
              toast.info("No more duplicate groups remaining");
            }
          }
          
          setSelectedProducts(new Set());
          fetchProducts();
        }}
      />

      <ExportProductsDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        products={filteredProducts}
      />

      <BottomNav />
    </div>
  );
}