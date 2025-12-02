import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, X, Sparkles, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { KeyboardBadge } from "@/components/ui/keyboard-badge";

const recentSearches = ["Organic milk", "Fresh bananas", "Whole wheat bread"];
const trendingSearches = ["Greek yogurt", "Avocados", "Salmon", "Almond milk"];

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  description: string | null;
  unit: string;
  product_variants?: Array<{
    id: string;
    price: number;
    quantity?: number;
    unit: string;
  }>;
}

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState("");
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (searchQuery.trim()) {
      searchProducts(searchQuery);
    } else {
      setProducts([]);
    }
  }, [searchQuery]);

  const searchProducts = async (query: string) => {
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id, 
          name, 
          price, 
          image_url, 
          description, 
          unit,
          product_variants(id, price, quantity, unit)
        `)
        .ilike('name', `%${query}%`)
        .eq('is_available_online', true)
        .limit(20);

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Search Failed",
        description: "Unable to search products",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleAISearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsLoadingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-search', {
        body: { query: searchQuery }
      });

      if (error) throw error;
      
      setAiSuggestions(data.suggestions);
      toast({
        title: "AI Suggestions Ready",
        description: "Check out the personalized recommendations below",
      });
    } catch (error) {
      console.error('AI search error:', error);
      toast({
        title: "AI Search Failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAI(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search for products or ask anything..."
              className="pl-10 pr-24"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAISearch()}
              autoFocus
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <KeyboardBadge keys={["Ctrl", "K"]} className="hidden sm:flex" />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setAiSuggestions("");
                  }}
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
          
          {searchQuery && (
            <Button 
              onClick={handleAISearch} 
              disabled={isLoadingAI}
              className="w-full"
            >
              {isLoadingAI ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Getting AI Suggestions...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Get AI-Powered Suggestions
                </>
              )}
            </Button>
          )}
        </div>

        {!searchQuery && (
          <>
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Recent Searches</h2>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((term) => (
                  <Button
                    key={term}
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchQuery(term)}
                  >
                    {term}
                  </Button>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Trending Searches</h2>
              <div className="flex flex-wrap gap-2">
                {trendingSearches.map((term) => (
                  <Button
                    key={term}
                    variant="secondary"
                    size="sm"
                    onClick={() => setSearchQuery(term)}
                  >
                    {term}
                  </Button>
                ))}
              </div>
            </section>
          </>
        )}

        {isSearching && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {!isSearching && searchQuery && products.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Search Results ({products.length})</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((product) => (
                <Link key={product.id} to={`/product/${product.id}`}>
                  <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                    <CardContent className="p-4">
                      <div className="aspect-square bg-muted rounded-lg mb-3 overflow-hidden">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            No image
                          </div>
                        )}
                      </div>
                      <h3 className="font-semibold text-sm mb-1 line-clamp-2">{product.name}</h3>
                      <p className="text-xs text-muted-foreground mb-2">{product.unit}</p>
                      {product.product_variants && product.product_variants.length > 0 ? (
                        <div className="space-y-1">
                          {product.product_variants.map((variant) => (
                            <p key={variant.id} className="text-xs font-medium text-primary">
                              {variant.quantity} {variant.unit}: {formatCurrency(variant.price)}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-lg font-bold text-primary">{formatCurrency(product.price)}</p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {!isSearching && searchQuery && products.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No products found for "{searchQuery}"</p>
          </div>
        )}

        {aiSuggestions && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI-Powered Suggestions
            </h2>
            <Card>
              <CardContent className="p-6">
                <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                  {aiSuggestions}
                </div>
              </CardContent>
            </Card>
          </section>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
