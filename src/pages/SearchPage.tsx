import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, X } from "lucide-react";
import { Link } from "react-router-dom";

const recentSearches = ["Organic milk", "Fresh bananas", "Whole wheat bread"];
const trendingSearches = ["Greek yogurt", "Avocados", "Salmon", "Almond milk"];

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search for products..."
            className="pl-10 pr-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
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

        {searchQuery && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Search Results</h2>
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                <p>No results found for "{searchQuery}"</p>
                <p className="text-sm mt-2">Try different keywords or browse categories</p>
                <Link to="/categories">
                  <Button className="mt-4">Browse Categories</Button>
                </Link>
              </CardContent>
            </Card>
          </section>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
