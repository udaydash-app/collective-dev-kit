import { Link, useParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Plus } from "lucide-react";

const mockProducts = [
  { id: 1, name: "Organic Bananas", price: "$2.99", unit: "per bunch", image: "🍌" },
  { id: 2, name: "Fresh Strawberries", price: "$4.99", unit: "per lb", image: "🍓" },
  { id: 3, name: "Green Apples", price: "$3.49", unit: "per lb", image: "🍏" },
  { id: 4, name: "Blueberries", price: "$5.99", unit: "per pint", image: "🫐" },
];

export default function CategoryProducts() {
  const { id } = useParams();

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
          <h1 className="text-2xl font-bold capitalize">{id || "Category"}</h1>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {mockProducts.map((product) => (
            <Link key={product.id} to={`/product/${product.id}`}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="aspect-square bg-muted rounded-lg flex items-center justify-center mb-3 text-6xl">
                    {product.image}
                  </div>
                  <h3 className="font-medium text-sm mb-1">{product.name}</h3>
                  <p className="text-xs text-muted-foreground mb-2">{product.unit}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-primary">{product.price}</span>
                    <Button size="icon" variant="outline">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
