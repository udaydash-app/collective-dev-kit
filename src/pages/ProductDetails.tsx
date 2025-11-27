import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Minus, Plus, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePageView, useAnalytics } from "@/hooks/useAnalytics";
import { formatCurrency } from "@/lib/utils";
import { useCart } from "@/hooks/useCart";

interface ProductVariant {
  id: string;
  product_id: string;
  unit: string;
  quantity?: number;
  label?: string;
  price: number;
  stock_quantity: number;
  is_available: boolean;
  is_default: boolean;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  unit: string;
  image_url: string | null;
  nutritional_info: any;
  product_variants?: ProductVariant[];
}

export default function ProductDetails() {
  usePageView("Product Details");
  const { trackEvent } = useAnalytics();
  const { addItem } = useCart();
  const { id } = useParams();
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(1);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);

  useEffect(() => {
    fetchProduct();
    checkWishlistStatus();
  }, [id]);

  const fetchProduct = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          product_variants(*)
        `)
        .eq("id", id)
        .eq("is_available", true)
        .single();

      if (error) throw error;
      setProduct(data);
      
      // Set default variant if available
      if (data.product_variants && data.product_variants.length > 0) {
        const defaultVariant = data.product_variants.find((v: ProductVariant) => v.is_default) || data.product_variants[0];
        setSelectedVariant(defaultVariant);
      }
    } catch (error) {
      console.error("Error fetching product:", error);
      toast.error("Failed to load product");
    }
  };

  const checkWishlistStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("wishlist")
        .select("id")
        .eq("user_id", user.id)
        .eq("product_id", id)
        .maybeSingle();

      setIsFavorite(!!data);
    } catch (error) {
      console.error("Error checking wishlist:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleWishlist = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth/login");
        return;
      }

      if (isFavorite) {
        await supabase
          .from("wishlist")
          .delete()
          .eq("user_id", user.id)
          .eq("product_id", id);
        
        setIsFavorite(false);
        toast.success("Removed from wishlist");
        trackEvent("remove_from_wishlist", { product_id: id });
      } else {
        await supabase
          .from("wishlist")
          .insert({ user_id: user.id, product_id: id });
        
        setIsFavorite(true);
        toast.success("Added to wishlist");
        trackEvent("add_to_wishlist", { product_id: id });
      }
    } catch (error) {
      console.error("Error toggling wishlist:", error);
      toast.error("Failed to update wishlist");
    }
  };

  const addToCart = async () => {
    if (!id) return;
    
    try {
      await addItem(id, quantity);
      trackEvent("add_to_cart", { product_id: id, quantity, variant_id: selectedVariant?.id });
    } catch (error) {
      console.error("Error adding to cart:", error);
    }
  };

  if (!product && !loading) {
    return (
      <div className="min-h-screen bg-background pb-32">
        <Header />
        <main className="max-w-screen-xl mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Product not found</h1>
          <Link to="/categories">
            <Button>Browse Categories</Button>
          </Link>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <Header />
      
      <main className="max-w-screen-xl mx-auto">
        <div className="p-4">
          <Link to="/categories">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
        </div>

        <div className="px-4 pb-6 space-y-6">
          <div className="aspect-square bg-muted rounded-2xl overflow-hidden">
            {product?.image_url ? (
              <img 
                src={product.image_url} 
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-9xl">
                📦
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold mb-1">{product?.name || "Loading..."}</h1>
                <p className="text-muted-foreground">
                  {selectedVariant 
                    ? `${selectedVariant.quantity || ''} ${selectedVariant.unit}`.trim()
                    : product?.unit
                  }
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleWishlist}
                disabled={loading}
              >
                <Heart className={isFavorite ? "fill-primary text-primary" : ""} />
              </Button>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-primary">
                {product && formatCurrency(selectedVariant?.price || product.price)}
              </span>
            </div>

            {product?.product_variants && product.product_variants.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3">Select Size</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {product.product_variants.map((variant) => (
                      <Button
                        key={variant.id}
                        variant={selectedVariant?.id === variant.id ? "default" : "outline"}
                        className="flex flex-col h-auto py-3"
                        onClick={() => setSelectedVariant(variant)}
                        disabled={!variant.is_available}
                      >
                        <span className="font-semibold">
                          {variant.quantity || ''} {variant.unit}
                        </span>
                        <span className="text-xs mt-1">
                          {formatCurrency(variant.price)}
                        </span>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {product?.description && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-sm text-muted-foreground">
                    {product.description}
                  </p>
                </CardContent>
              </Card>
            )}

            {product?.nutritional_info && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2">Nutritional Info</h3>
                  <div className="space-y-1 text-sm">
                    {Object.entries(product.nutritional_info).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground capitalize">{key}</span>
                        <span>{value as string}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="fixed bottom-16 left-0 right-0 p-4 bg-background border-t">
          <div className="max-w-screen-xl mx-auto flex items-center gap-4">
            <div className="flex items-center gap-3 bg-muted rounded-lg p-2">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-8 text-center font-semibold">{quantity}</span>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setQuantity(quantity + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <Button size="lg" className="flex-1" onClick={addToCart} disabled={!product}>
              Add to Cart • {formatCurrency((selectedVariant?.price || product?.price || 0) * quantity)}
            </Button>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
