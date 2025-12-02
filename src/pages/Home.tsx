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
import { useCart } from "@/hooks/useCart";

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
  product_variants?: Array<{
    id: string;
    price: number;
    quantity?: number;
    unit: string;
  }>;
}

interface Offer {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  discount_percentage: number | null;
  link_url: string | null;
}

interface Announcement {
  id: string;
  title: string;
  message: string;
  background_color: string;
  text_color: string;
  background_image_url: string | null;
  title_font_size: string;
  title_font_weight: string;
  message_font_size: string;
  message_font_weight: string;
}

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentOfferIndex, setCurrentOfferIndex] = useState(0);
  const { addItem } = useCart();

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-advance offers carousel
  useEffect(() => {
    if (offers.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentOfferIndex((prev) => (prev + 1) % offers.length);
    }, 4000); // Change offer every 4 seconds

    return () => clearInterval(interval);
  }, [offers.length]);

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

      // Fetch featured products (only those available for online sale)
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select(`
          id, 
          name, 
          price, 
          original_price, 
          image_url, 
          unit,
          product_variants(id, price, quantity, unit)
        `)
        .eq("is_featured", true)
        .eq("is_available_online", true)
        .limit(10);

      if (productsError) throw productsError;
      setFeaturedProducts(productsData || []);

      // Fetch active offers
      const { data: offersData, error: offersError } = await supabase
        .from("offers")
        .select("id, title, description, image_url, discount_percentage, link_url")
        .eq("is_active", true)
        .lte("start_date", new Date().toISOString())
        .gte("end_date", new Date().toISOString())
        .order("display_order", { ascending: true });

      if (offersError) throw offersError;
      setOffers(offersData || []);

      // Fetch active announcement
      const { data: announcementData, error: announcementError } = await supabase
        .from("announcements")
        .select("id, title, message, background_color, text_color, background_image_url, title_font_size, title_font_weight, message_font_size, message_font_weight")
        .eq("is_active", true)
        .lte("start_date", new Date().toISOString())
        .gte("end_date", new Date().toISOString())
        .order("display_order", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (announcementError) throw announcementError;
      setAnnouncement(announcementData);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (productId: string) => {
    addItem(productId, 1);
  };
  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      {/* Announcement Ribbon */}
      {announcement && (
        <div 
          className="relative py-4 px-4 text-center overflow-hidden"
          style={{ 
            backgroundColor: announcement.background_color,
            color: announcement.text_color,
            backgroundImage: announcement.background_image_url 
              ? `url(${announcement.background_image_url})` 
              : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {announcement.background_image_url && (
            <div className="absolute inset-0 bg-black/40" />
          )}
          <div className="relative z-10">
            <h2 className={`${announcement.title_font_size} ${announcement.title_font_weight} mb-1`}>
              {announcement.title}
            </h2>
            <div className="overflow-hidden">
              <p 
                className={`${announcement.message_font_size} ${announcement.message_font_weight} whitespace-nowrap inline-block`}
                style={{
                  animation: 'marquee 40s linear infinite',
                }}
              >
                {announcement.message}
              </p>
            </div>
          </div>
          <style>{`
            @keyframes marquee {
              0% {
                transform: translateX(100%);
              }
              100% {
                transform: translateX(-100%);
              }
            }
          `}</style>
        </div>
      )}
      
      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        {/* Welcome Section */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Welcome back!</h1>
          <p className="text-sm text-muted-foreground">Discover fresh deals and quality products</p>
        </div>

        {/* Offers Section - Auto-playing Carousel on Mobile, Stacked on Desktop */}
        {offers.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Special Offers</h2>
            
            {/* Mobile: Carousel */}
            <div className="relative md:hidden">
              <div className="overflow-hidden">
                <div 
                  className="flex transition-transform duration-500 ease-in-out"
                  style={{ transform: `translateX(-${currentOfferIndex * 100}%)` }}
                >
                  {offers.map((offer) => (
                    <div key={offer.id} className="w-full flex-shrink-0">
                      {offer.link_url ? (
                        <a 
                          href={offer.link_url} 
                          target={offer.link_url.startsWith('http') ? "_blank" : undefined}
                          rel={offer.link_url.startsWith('http') ? "noopener noreferrer" : undefined}
                          className="block"
                        >
                          <Card className="hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer">
                            <CardContent className="p-0">
                              {offer.image_url ? (
                                <img 
                                  src={offer.image_url} 
                                  alt={offer.title}
                                  className="w-full h-40 object-cover rounded-t-lg"
                                />
                              ) : (
                                <div className="w-full h-40 bg-gradient-to-r from-primary/20 to-accent/20 rounded-t-lg flex items-center justify-center">
                                  <span className="text-6xl">🎁</span>
                                </div>
                              )}
                              <div className="p-4">
                                <h3 className="font-semibold text-lg mb-1">{offer.title}</h3>
                                {offer.description && (
                                  <p className="text-sm text-muted-foreground mb-2">{offer.description}</p>
                                )}
                                {offer.discount_percentage && (
                                  <div className="inline-flex items-center px-2 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                                    {offer.discount_percentage}% OFF
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </a>
                      ) : (
                        <Card className="hover:shadow-md transition-shadow">
                          <CardContent className="p-0">
                            {offer.image_url ? (
                              <img 
                                src={offer.image_url} 
                                alt={offer.title}
                                className="w-full h-40 object-cover rounded-t-lg"
                              />
                            ) : (
                              <div className="w-full h-40 bg-gradient-to-r from-primary/20 to-accent/20 rounded-t-lg flex items-center justify-center">
                                <span className="text-6xl">🎁</span>
                              </div>
                            )}
                            <div className="p-4">
                              <h3 className="font-semibold text-lg mb-1">{offer.title}</h3>
                              {offer.description && (
                                <p className="text-sm text-muted-foreground mb-2">{offer.description}</p>
                              )}
                              {offer.discount_percentage && (
                                <div className="inline-flex items-center px-2 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                                  {offer.discount_percentage}% OFF
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Carousel Indicators */}
              {offers.length > 1 && (
                <div className="flex justify-center gap-2 mt-3">
                  {offers.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentOfferIndex(index)}
                      className={`h-2 rounded-full transition-all ${
                        index === currentOfferIndex 
                          ? 'w-6 bg-primary' 
                          : 'w-2 bg-muted-foreground/30'
                      }`}
                      aria-label={`Go to offer ${index + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Desktop: Stacked Horizontal */}
            <div className="hidden md:flex md:gap-4 md:overflow-x-auto scrollbar-hide">
              {offers.map((offer) => (
                offer.link_url ? (
                  <a 
                    key={offer.id}
                    href={offer.link_url} 
                    target={offer.link_url.startsWith('http') ? "_blank" : undefined}
                    rel={offer.link_url.startsWith('http') ? "noopener noreferrer" : undefined}
                    className="block"
                  >
                    <Card className="hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer flex-shrink-0 w-[380px]">
                      <CardContent className="p-0">
                        {offer.image_url ? (
                          <img 
                            src={offer.image_url} 
                            alt={offer.title}
                            className="w-full h-48 object-cover rounded-t-lg"
                          />
                        ) : (
                          <div className="w-full h-48 bg-gradient-to-r from-primary/20 to-accent/20 rounded-t-lg flex items-center justify-center">
                            <span className="text-6xl">🎁</span>
                          </div>
                        )}
                        <div className="p-4">
                          <h3 className="font-semibold text-lg mb-1">{offer.title}</h3>
                          {offer.description && (
                            <p className="text-sm text-muted-foreground mb-2">{offer.description}</p>
                          )}
                          {offer.discount_percentage && (
                            <div className="inline-flex items-center px-2 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                              {offer.discount_percentage}% OFF
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </a>
                ) : (
                  <Card key={offer.id} className="hover:shadow-md transition-shadow flex-shrink-0 w-[380px]">
                    <CardContent className="p-0">
                      {offer.image_url ? (
                        <img 
                          src={offer.image_url} 
                          alt={offer.title}
                          className="w-full h-48 object-cover rounded-t-lg"
                        />
                      ) : (
                        <div className="w-full h-48 bg-gradient-to-r from-primary/20 to-accent/20 rounded-t-lg flex items-center justify-center">
                          <span className="text-6xl">🎁</span>
                        </div>
                      )}
                      <div className="p-4">
                        <h3 className="font-semibold text-lg mb-1">{offer.title}</h3>
                        {offer.description && (
                          <p className="text-sm text-muted-foreground mb-2">{offer.description}</p>
                        )}
                        {offer.discount_percentage && (
                          <div className="inline-flex items-center px-2 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                            {offer.discount_percentage}% OFF
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              ))}
            </div>
          </section>
        )}

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
                          <div>
                            {product.product_variants && product.product_variants.length > 0 ? (
                              <div className="space-y-1">
                                {product.product_variants.map((variant) => (
                                  <p key={variant.id} className="text-xs font-medium text-primary">
                                    {variant.quantity} {variant.unit}: {formatCurrency(variant.price)}
                                  </p>
                                ))}
                              </div>
                            ) : (
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
                            )}
                          </div>
                          <Button 
                            size="sm" 
                            className="mt-2 w-full gap-1"
                            onClick={() => {
                              if (product.product_variants && product.product_variants.length > 0) {
                                // Navigate to product page to select variant
                                window.location.href = `/product/${product.id}`;
                              } else {
                                handleAddToCart(product.id);
                              }
                            }}
                          >
                            <Plus className="h-3 w-3" />
                            {product.product_variants && product.product_variants.length > 0 ? 'View Options' : 'Add to Cart'}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          ) : null}
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

        {/* Quick Actions */}
        <section className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Link to="/orders">
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-6 text-center">
                  <h3 className="font-semibold">My Orders</h3>
                </CardContent>
              </Card>
            </Link>
            <Link to="/categories">
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-6 text-center">
                  <h3 className="font-semibold">Start Shopping</h3>
                </CardContent>
              </Card>
            </Link>
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
