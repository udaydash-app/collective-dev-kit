import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Sparkles, Upload, X, Search, Package, Grid3x3 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { ReturnToPOSButton } from "@/components/layout/ReturnToPOSButton";

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
  is_available: boolean;
  is_featured?: boolean;
  stock_quantity: number;
  barcode?: string | null;
  categories?: { name: string };
  stores?: { name: string };
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

export default function Products() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
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

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchStores();
  }, []);

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

  const handleEdit = (product: Product) => {
    setIsAddingNew(false);
    setEditingProduct(product);
    setSelectedImage(null);
    setPreviewUrl(null);
    setImageUrl("");
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
    
    if (shouldAddNew === 'true' && stores.length > 0 && !isDialogOpen) {
      // Remove the query parameters
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('addNew');
      newSearchParams.delete('barcode');
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
    setVariants(variants.filter((_, i) => i !== index));
  };

  const saveVariants = async (productId: string) => {
    try {
      // Delete existing variants
      await supabase
        .from('product_variants')
        .delete()
        .eq('product_id', productId);

      // Insert new variants
      if (variants.length > 0) {
        const variantsToInsert = variants.map(v => ({
          product_id: productId,
          unit: v.unit,
          quantity: v.quantity,
          label: v.label || `${v.quantity || ''} ${v.unit}`.trim(),
          price: v.price,
          cost_price: v.cost_price || null,
          barcode: v.barcode?.trim() || null,
          stock_quantity: v.stock_quantity,
          is_available: v.is_available,
          is_default: v.is_default,
        }));

        const { error } = await supabase
          .from('product_variants')
          .insert(variantsToInsert);

        if (error) throw error;
      }
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
        unit: formData.get("unit") as string,
        category_id: formData.get("category_id") as string || null,
        store_id: formData.get("store_id") as string,
        stock_quantity: parseInt(formData.get("stock_quantity") as string) || 0,
        is_available: formData.get("is_available") === "true",
        is_featured: formData.get("is_featured") === "true",
        barcode: (formData.get("barcode") as string)?.trim() || null,
      };

      console.log('Product data to save:', productData);

      if (isAddingNew) {
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
        await saveVariants(editingProduct.id);

        toast.success("Product updated successfully");
      }

      setIsDialogOpen(false);
      setSelectedImage(null);
      setPreviewUrl(null);
      setImageUrl("");
      setVariants([]);
      setIsAddingNew(false);
      fetchProducts();
    } catch (error) {
      console.error("Error saving product:", error);
      toast.error(isAddingNew ? "Failed to create product" : "Failed to update product");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;

    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Product deleted successfully");
      fetchProducts();
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error("Failed to delete product");
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

  const filteredProducts = products.filter(product => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      product.name.toLowerCase().includes(query) ||
      (product.description?.toLowerCase() || '').includes(query) ||
      (product.categories?.name?.toLowerCase() || '').includes(query);

    const matchesCategory = filterCategory === "all" || product.category_id === filterCategory;
    const matchesStore = filterStore === "all" || product.store_id === filterStore;
    const matchesAvailability = 
      filterAvailability === "all" || 
      (filterAvailability === "available" && product.is_available) ||
      (filterAvailability === "unavailable" && !product.is_available);
    const matchesFeatured = 
      filterFeatured === "all" ||
      (filterFeatured === "featured" && product.is_featured) ||
      (filterFeatured === "not-featured" && !product.is_featured);
    const matchesStock = 
      filterStock === "all" ||
      (filterStock === "in-stock" && product.stock_quantity > 0) ||
      (filterStock === "out-of-stock" && product.stock_quantity === 0);

    return matchesSearch && matchesCategory && matchesStore && matchesAvailability && matchesFeatured && matchesStock;
  });

  console.log('Admin: Total products:', products.length, 'Filtered:', filteredProducts.length, 'Search:', searchQuery);

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Product Management</h1>
          <div className="flex gap-2">
            <ReturnToPOSButton inline />
            <Button
              onClick={handleAdd}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Product
            </Button>
            {selectedProducts.size > 0 && (
              <Button 
                onClick={handleBulkDelete}
                variant="destructive"
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete Selected ({selectedProducts.size})
              </Button>
            )}
            <Button 
              onClick={handleEnrichAll}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Enrich All Products
            </Button>
          </div>
        </div>

        <div className="mb-6 space-y-4">
          {/* Filters Section */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <Label htmlFor="filter-category" className="text-xs font-medium">Category</Label>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger id="filter-category">
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

                <div>
                  <Label htmlFor="filter-store" className="text-xs font-medium">Store</Label>
                  <Select value={filterStore} onValueChange={setFilterStore}>
                    <SelectTrigger id="filter-store">
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

                <div>
                  <Label htmlFor="filter-availability" className="text-xs font-medium">Availability</Label>
                  <Select value={filterAvailability} onValueChange={setFilterAvailability}>
                    <SelectTrigger id="filter-availability">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="unavailable">Unavailable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="filter-featured" className="text-xs font-medium">Featured</Label>
                  <Select value={filterFeatured} onValueChange={setFilterFeatured}>
                    <SelectTrigger id="filter-featured">
                      <SelectValue placeholder="All Products" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Products</SelectItem>
                      <SelectItem value="featured">Featured Only</SelectItem>
                      <SelectItem value="not-featured">Not Featured</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="filter-stock" className="text-xs font-medium">Stock Level</Label>
                  <Select value={filterStock} onValueChange={setFilterStock}>
                    <SelectTrigger id="filter-stock">
                      <SelectValue placeholder="All Stock" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stock</SelectItem>
                      <SelectItem value="in-stock">In Stock</SelectItem>
                      <SelectItem value="out-of-stock">Out of Stock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Clear Filters Button */}
              {(filterCategory !== "all" || filterStore !== "all" || filterAvailability !== "all" || filterFeatured !== "all" || filterStock !== "all") && (
                <div className="mt-3">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setFilterCategory("all");
                      setFilterStore("all");
                      setFilterAvailability("all");
                      setFilterFeatured("all");
                      setFilterStock("all");
                    }}
                  >
                    Clear All Filters
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Search Bar */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search products by name, description, or category..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {filteredProducts.length > 0 && (
            <div className="flex items-center gap-2">
              <Checkbox 
                id="select-all"
                checked={selectedProducts.size === filteredProducts.length && filteredProducts.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <Label htmlFor="select-all" className="text-sm font-normal cursor-pointer">
                Select All ({filteredProducts.length} products)
              </Label>
            </div>
          )}
          {searchQuery && (
            <p className="text-sm text-muted-foreground">
              Found {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
            </p>
          )}
        </div>

        <div className="grid gap-4">
          {filteredProducts.map((product) => (
            <Card key={product.id}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Checkbox
                    checked={selectedProducts.has(product.id)}
                    onCheckedChange={() => toggleProductSelection(product.id)}
                    className="mt-1"
                  />
                  {product.image_url ? (
                    <img 
                      src={product.image_url} 
                      alt={product.name}
                      className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center text-4xl flex-shrink-0">
                      📦
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-xl font-semibold">{product.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {product.categories?.name} • {product.stores?.name}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEnrichProduct(product)}
                          disabled={enrichingIds.has(product.id)}
                          title="Add AI description and image"
                        >
                          <Sparkles className={`h-4 w-4 ${enrichingIds.has(product.id) ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(product)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(product.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {product.description && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {product.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-3 text-sm">
                      {product.product_variants && product.product_variants.length > 0 ? (
                        <>
                          <span className="font-semibold text-primary">
                            {product.product_variants.length} variant{product.product_variants.length > 1 ? 's' : ''}
                          </span>
                          <span>
                            {formatCurrency(Math.min(...product.product_variants.map(v => v.price)))} - {formatCurrency(Math.max(...product.product_variants.map(v => v.price)))}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="font-semibold text-primary">
                            {formatCurrency(product.price)}
                          </span>
                          <span>Unit: {product.unit}</span>
                          <span className={(product.stock_quantity || 0) < 0 ? 'text-red-600 font-semibold' : ''}>
                            Stock: {(product.stock_quantity || 0) < 0 ? '-' : ''}{Math.abs(product.stock_quantity || 0)}
                          </span>
                        </>
                      )}
                      <span className={product.is_available ? "text-green-600" : "text-red-600"}>
                        {product.is_available ? "Available" : "Unavailable"}
                      </span>
                      {product.is_featured && (
                        <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
                          Featured
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">
                {searchQuery ? `No products found matching "${searchQuery}"` : "No products found"}
              </p>
            </CardContent>
          </Card>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">{isAddingNew ? 'Add New Product' : 'Edit Product'}</DialogTitle>
            </DialogHeader>
            {editingProduct && (
              <form onSubmit={handleSave} className="space-y-6">
                {/* Basic Information Section */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Package className="h-5 w-5 text-primary" />
                      Basic Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="name">Product Name *</Label>
                      <Input
                        id="name"
                        name="name"
                        defaultValue={editingProduct.name}
                        required
                        placeholder="e.g., Fresh Tomatoes"
                      />
                    </div>

                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        name="description"
                        defaultValue={editingProduct.description || ""}
                        rows={3}
                        placeholder="Product description and details..."
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Product Image Section */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Upload className="h-5 w-5 text-primary" />
                      Product Image
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(previewUrl || imageUrl || editingProduct.image_url) && (
                      <div className="relative w-40 h-40 mx-auto">
                        <img 
                          src={previewUrl || imageUrl || editingProduct.image_url || ''} 
                          alt="Product preview"
                          className="w-full h-full object-cover rounded-lg border-2 border-border"
                        />
                        {(previewUrl || imageUrl) && (
                          <Button
                            type="button"
                            size="icon"
                            variant="destructive"
                            className="absolute -top-2 -right-2 h-7 w-7"
                            onClick={handleRemoveImage}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                    <div className="space-y-3">
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
                          onClick={() => document.getElementById('image')?.click()}
                          className="gap-2"
                        >
                          <Upload className="h-4 w-4" />
                          {editingProduct.image_url ? 'Change Image' : 'Upload Image'}
                        </Button>
                      </div>
                      <div className="text-center text-sm text-muted-foreground">or</div>
                      <div>
                        <Label htmlFor="imageUrl" className="text-sm">Paste Image URL</Label>
                        <Input
                          id="imageUrl"
                          type="url"
                          placeholder="https://example.com/image.jpg"
                          value={imageUrl}
                          onChange={(e) => setImageUrl(e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Pricing Section */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <span className="text-primary">₣</span>
                      Pricing & Unit
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                      <div>
                        <Label htmlFor="price">Retail Price (FCFA) *</Label>
                        <Input
                          id="price"
                          name="price"
                          type="number"
                          step="0.01"
                          defaultValue={editingProduct.price}
                          required={variants.length === 0}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label htmlFor="wholesale_price">Wholesale Price (FCFA)</Label>
                        <Input
                          id="wholesale_price"
                          name="wholesale_price"
                          type="number"
                          step="0.01"
                          defaultValue={editingProduct.wholesale_price}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label htmlFor="vip_price">VIP Price (FCFA)</Label>
                        <Input
                          id="vip_price"
                          name="vip_price"
                          type="number"
                          step="0.01"
                          defaultValue={editingProduct.vip_price}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label htmlFor="cost_price">Cost Price (FCFA)</Label>
                        <Input
                          id="cost_price"
                          name="cost_price"
                          type="number"
                          step="0.01"
                          defaultValue={editingProduct.cost_price}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label htmlFor="unit">Unit *</Label>
                        <Select name="unit" defaultValue={editingProduct.unit} required>
                          <SelectTrigger>
                            <SelectValue placeholder="Select unit" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pcs">Pieces (pcs)</SelectItem>
                            <SelectItem value="gm">Grams (gm)</SelectItem>
                            <SelectItem value="kg">Kilograms (kg)</SelectItem>
                            <SelectItem value="ltr">Liters (ltr)</SelectItem>
                            <SelectItem value="ml">Milliliters (ml)</SelectItem>
                            <SelectItem value="dozen">Dozen</SelectItem>
                            <SelectItem value="pack">Pack</SelectItem>
                            <SelectItem value="box">Box</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Product Variants Section */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Grid3x3 className="h-5 w-5 text-primary" />
                        Product Variants
                      </CardTitle>
                      <Button 
                        type="button" 
                        size="sm" 
                        onClick={() => setShowVariants(!showVariants)} 
                        variant="ghost"
                      >
                        {showVariants ? 'Hide' : 'Show'} ({variants.length})
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Add different sizes, weights, or packaging options
                    </p>
                  </CardHeader>
                  
                  {showVariants && (
                    <CardContent className="space-y-3">
                      {variants.map((variant, index) => (
                        <Card key={variant.id} className="border-2">
                          <CardContent className="p-4 space-y-3">
                            <div className="grid grid-cols-12 gap-3">
                              <div className="col-span-6 md:col-span-2">
                                <Label className="text-xs font-medium">Quantity</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={variant.quantity || ''}
                                  onChange={(e) => updateVariant(index, 'quantity', parseFloat(e.target.value) || 0)}
                                  className="h-9"
                                  placeholder="500"
                                />
                              </div>
                              <div className="col-span-6 md:col-span-2">
                                <Label className="text-xs font-medium">Unit</Label>
                                <Select value={variant.unit} onValueChange={(value) => updateVariant(index, 'unit', value)}>
                                  <SelectTrigger className="h-9">
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
                                <Label className="text-xs font-medium">Retail Price</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={variant.price}
                                  onChange={(e) => updateVariant(index, 'price', parseFloat(e.target.value) || 0)}
                                  className="h-9"
                                  placeholder="0.00"
                                />
                              </div>
                              <div className="col-span-6 md:col-span-2">
                                <Label className="text-xs font-medium">Wholesale Price</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={variant.wholesale_price || ''}
                                  onChange={(e) => updateVariant(index, 'wholesale_price', parseFloat(e.target.value) || 0)}
                                  className="h-9"
                                  placeholder="0.00"
                                />
                              </div>
                              <div className="col-span-6 md:col-span-2">
                                <Label className="text-xs font-medium">VIP Price</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={variant.vip_price || ''}
                                  onChange={(e) => updateVariant(index, 'vip_price', parseFloat(e.target.value) || 0)}
                                  className="h-9"
                                  placeholder="0.00"
                                />
                              </div>
                              <div className="col-span-6 md:col-span-2">
                                <Label className="text-xs font-medium">Cost Price</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={variant.cost_price || ''}
                                  onChange={(e) => updateVariant(index, 'cost_price', parseFloat(e.target.value) || 0)}
                                  className="h-9"
                                  placeholder="0.00"
                                />
                              </div>
                              <div className="col-span-6 md:col-span-2">
                                <Label className="text-xs font-medium">Stock</Label>
                                <Input
                                  type="number"
                                  value={variant.stock_quantity}
                                  onChange={(e) => updateVariant(index, 'stock_quantity', parseInt(e.target.value) || 0)}
                                  className="h-9"
                                  placeholder="0"
                                />
                              </div>
                              <div className="col-span-6 md:col-span-1">
                                <Label className="text-xs font-medium">Active</Label>
                                <Select value={variant.is_available.toString()} onValueChange={(value) => updateVariant(index, 'is_available', value === 'true')}>
                                  <SelectTrigger className="h-9">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="true">✓</SelectItem>
                                    <SelectItem value="false">✗</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="col-span-6 md:col-span-1 flex items-end">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeVariant(index)}
                                  className="h-9 w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs font-medium">Barcode</Label>
                              <Input
                                type="text"
                                value={variant.barcode || ''}
                                onChange={(e) => updateVariant(index, 'barcode', e.target.value)}
                                className="h-9"
                                placeholder="Variant-specific barcode"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      <Button 
                        type="button" 
                        size="sm" 
                        onClick={addVariant} 
                        variant="outline" 
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Variant
                      </Button>
                    </CardContent>
                  )}
                </Card>

                {/* Inventory & Classification Section */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Search className="h-5 w-5 text-primary" />
                      Inventory & Classification
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="category_id">Category</Label>
                        <Select name="category_id" defaultValue={editingProduct.category_id || ""}>
                          <SelectTrigger>
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
                        <Label htmlFor="store_id">Store *</Label>
                        <Select name="store_id" defaultValue={editingProduct.store_id} required>
                          <SelectTrigger>
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="stock_quantity">Stock Quantity *</Label>
                        <Input
                          id="stock_quantity"
                          name="stock_quantity"
                          type="number"
                          defaultValue={editingProduct.stock_quantity}
                          required
                          placeholder="0"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="barcode">Barcode</Label>
                        <Input
                          id="barcode"
                          name="barcode"
                          type="text"
                          defaultValue={(editingProduct as any).barcode || ''}
                          placeholder="Product barcode"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Settings Section */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      Product Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="is_available">Availability *</Label>
                        <Select name="is_available" defaultValue={editingProduct.is_available.toString()}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">✓ Available for Sale</SelectItem>
                            <SelectItem value="false">✗ Unavailable</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="is_featured">Featured Product</Label>
                        <Select name="is_featured" defaultValue={editingProduct.is_featured?.toString() || "false"}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">⭐ Show on Home Page</SelectItem>
                            <SelectItem value="false">Regular Product</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex gap-3 justify-end pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={uploadingImage}>
                    {uploadingImage ? 'Uploading...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </main>

      <BottomNav />
    </div>
  );
}