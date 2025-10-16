import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, X, Sparkles, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

const recentSearches = ["Organic milk", "Fresh bananas", "Whole wheat bread"];
const trendingSearches = ["Greek yogurt", "Avocados", "Salmon", "Almond milk"];

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState("");
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const { toast } = useToast();

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
              className="pl-10 pr-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAISearch()}
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setAiSuggestions("");
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            )}
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
