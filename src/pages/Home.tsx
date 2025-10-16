import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ShoppingCart, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  image_url: string | null;
}

interface FeaturedProduct {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  image_url: string | null;
  unit: string;
}

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from("categories")
        .select("id, name, slug, icon, image_url")
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .limit(5);

      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);

      // Fetch featured products
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("id, name, price, original_price, image_url, unit")
        .eq("is_featured", true)
        .eq("is_available", true)
        .limit(10);

      if (productsError) throw productsError;
      setFeaturedProducts(productsData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async (productId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Please login to add items to cart");
        return;
      }

      // Check if item already in cart
      const { data: existing } = await supabase
        .from("cart_items")
        .select("id, quantity")
        .eq("user_id", user.id)
        .eq("product_id", productId)
        .maybeSingle();

      if (existing) {
        // Update quantity
        const { error } = await supabase
          .from("cart_items")
          .update({ quantity: existing.quantity + 1 })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Insert new item
        const { error } = await supabase
          .from("cart_items")
          .insert({ user_id: user.id, product_id: productId, quantity: 1 });

        if (error) throw error;
      }

      toast.success("Added to cart");
    } catch (error) {
      console.error("Error adding to cart:", error);
      toast.error("Failed to add to cart");
    }
  };
  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        {/* Welcome Section */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Welcome back!</h1>
          <p className="text-muted-foreground">What would you like to order today?</p>
        </div>

        {/* Featured Deals Carousel */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Featured Deals</h2>
          {loading ? (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="w-[280px] animate-pulse">
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      <div className="w-20 h-20 bg-muted rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded" />
                        <div className="h-6 bg-muted rounded w-20" />
                        <div className="h-8 bg-muted rounded" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : featuredProducts.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {featuredProducts.map((product) => (
                <div key={product.id} className="flex-shrink-0">
                  <Card className="w-[280px] hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        {product.image_url ? (
                          <img 
                            src={product.image_url} 
                            alt={product.name}
                            className="w-20 h-20 object-cover rounded-lg"
                          />
                        ) : (
                          <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center text-4xl">
                            📦
                          </div>
                        )}
                        <div className="flex-1">
                          <Link to={`/product/${product.id}`}>
                            <h3 className="font-medium text-sm mb-1 hover:text-primary">
                              {product.name}
                            </h3>
                          </Link>
                          <div className="flex items-baseline gap-2">
                            <span className="text-lg font-bold text-primary">
                              {formatCurrency(product.price)}
                            </span>
                            {product.original_price && product.original_price > product.price && (
                              <span className="text-xs text-muted-foreground line-through">
                                {formatCurrency(product.original_price)}
                              </span>
                            )}
                          </div>
                          <Button 
                            size="sm" 
                            className="mt-2 w-full gap-1"
                            onClick={() => handleAddToCart(product.id)}
                          >
                            <Plus className="h-3 w-3" />
                            Add to Cart
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                <p>No featured deals available</p>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Categories Grid */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Shop by Category</h2>
          {loading ? (
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4 flex flex-col items-center gap-2">
                    <div className="w-12 h-12 bg-muted rounded-full" />
                    <div className="h-4 bg-muted rounded w-16" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {categories.map((category) => (
                <Link key={category.id} to={`/category/${category.slug}`}>
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4 flex flex-col items-center gap-2">
                      {category.image_url ? (
                        <img 
                          src={category.image_url} 
                          alt={category.name}
                          className="w-12 h-12 object-cover rounded-full"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-2xl">
                          {category.icon || "📦"}
                        </div>
                      )}
                      <span className="text-sm font-medium text-center line-clamp-2">
                        {category.name}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
              <Link to="/categories">
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex flex-col items-center gap-2">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <ShoppingCart className="h-6 w-6 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-center">View All</span>
                  </CardContent>
                </Card>
              </Link>
            </div>
          )}
        </section>

        {/* Recent Orders */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Orders</h2>
            <Link to="/orders">
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          </div>
          <Card>
            <CardContent className="p-4 text-center text-muted-foreground">
              <p>No recent orders</p>
              <Link to="/categories">
                <Button className="mt-3">Start Shopping</Button>
              </Link>
            </CardContent>
          </Card>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
