import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Minus, Plus, Heart } from "lucide-react";

export default function ProductDetails() {
  const { id } = useParams();
  const [quantity, setQuantity] = useState(1);
  const [isFavorite, setIsFavorite] = useState(false);

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
          <div className="aspect-square bg-muted rounded-2xl flex items-center justify-center text-9xl">
            🍌
          </div>

          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold mb-1">Organic Bananas</h1>
                <p className="text-muted-foreground">Fresh • per bunch</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsFavorite(!isFavorite)}
              >
                <Heart className={isFavorite ? "fill-primary text-primary" : ""} />
              </Button>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-primary">$2.99</span>
              <span className="text-sm text-muted-foreground line-through">$3.99</span>
            </div>

            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-sm text-muted-foreground">
                  Fresh organic bananas, perfect for snacking or adding to smoothies. Rich in potassium and natural energy.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">Nutritional Info</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Calories</span>
                    <span>105 per banana</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Potassium</span>
                    <span>422mg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fiber</span>
                    <span>3.1g</span>
                  </div>
                </div>
              </CardContent>
            </Card>
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
            <Button size="lg" className="flex-1">
              Add to Cart • ${(2.99 * quantity).toFixed(2)}
            </Button>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
