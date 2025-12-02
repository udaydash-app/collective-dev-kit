import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { usePageView } from "@/hooks/useAnalytics";
import { useCart } from "@/hooks/useCart";

interface Product {
  id: string;
  name: string;
  price: number;
  unit: string;
  image_url: string | null;
  product_variants?: Array<{
    id: string;
    price: number;
    quantity?: number;
    unit: string;
  }>;
}

export default function CategoryProducts() {
  usePageView("Category Products");
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryName, setCategoryName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, [id]);

  const fetchProducts = async () => {
    try {
      // First get the category
      const { data: category } = await supabase
        .from("categories")
        .select("id, name")
        .eq("slug", id)
        .single();

      if (category) {
        setCategoryName(category.name);
        
        // Then get products for this category (only those available for online sale)
        const { data, error } = await supabase
          .from("products")
          .select(`
            id, 
            name, 
            price, 
            unit, 
            image_url,
            product_variants(id, price, quantity, unit)
          `)
          .eq("category_id", category.id)
          .eq("is_available_online", true);

        if (error) throw error;
        
        console.log('CategoryProducts: Fetched products with variants:', data);
        setProducts(data || []);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const quickAddToCart = async (productId: string) => {
    await addItem(productId, 1);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/categories">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">{categoryName || "Products"}</h1>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="aspect-square rounded-lg mb-3" />
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2 mb-2" />
                  <Skeleton className="h-6 w-1/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : products.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">No products found in this category</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {products.map((product) => (
              <Card key={product.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <Link to={`/product/${product.id}`}>
                    <div className="aspect-square bg-muted rounded-lg overflow-hidden mb-3">
                      {product.image_url ? (
                        <img 
                          src={product.image_url} 
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-6xl">
                          📦
                        </div>
                      )}
                    </div>
                    <h3 className="font-medium text-sm mb-1">{product.name}</h3>
                    <p className="text-xs text-muted-foreground mb-2">{product.unit}</p>
                  </Link>
                  <div className="flex items-center justify-between">
                    {product.product_variants && product.product_variants.length > 0 ? (
                      <span className="text-xs font-medium text-primary">
                        From {formatCurrency(Math.min(...product.product_variants.map(v => v.price)))}
                      </span>
                    ) : (
                      <span className="text-lg font-bold text-primary">
                        {formatCurrency(product.price)}
                      </span>
                    )}
                    <Button 
                      size="icon" 
                      variant="outline"
                      onClick={(e) => {
                        e.preventDefault();
                        if (product.product_variants && product.product_variants.length > 0) {
                          // Navigate to product page to select variant
                          window.location.href = `/product/${product.id}`;
                        } else {
                          quickAddToCart(product.id);
                        }
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
