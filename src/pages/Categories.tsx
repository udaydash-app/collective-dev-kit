import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { Apple, Milk, Beef, Carrot, Package, Cookie, Coffee, Sandwich, IceCream, Fish } from "lucide-react";

const categories = [
  { id: "fruits", name: "Fresh Fruits", icon: Apple, count: 45 },
  { id: "vegetables", name: "Vegetables", icon: Carrot, count: 38 },
  { id: "dairy", name: "Dairy & Eggs", icon: Milk, count: 52 },
  { id: "meat", name: "Meat & Poultry", icon: Beef, count: 28 },
  { id: "seafood", name: "Seafood", icon: Fish, count: 22 },
  { id: "bakery", name: "Bakery", icon: Cookie, count: 34 },
  { id: "beverages", name: "Beverages", icon: Coffee, count: 67 },
  { id: "snacks", name: "Snacks", icon: Sandwich, count: 89 },
  { id: "frozen", name: "Frozen Foods", icon: IceCream, count: 41 },
  { id: "pantry", name: "Pantry Staples", icon: Package, count: 95 },
];

export default function Categories() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">Categories</h1>
          
          <Input
            type="search"
            placeholder="Search categories..."
            className="w-full"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <Link key={category.id} to={`/category/${category.id}`}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6 flex flex-col items-center gap-3">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                      <Icon className="h-8 w-8 text-primary" />
                    </div>
                    <div className="text-center">
                      <h3 className="font-medium">{category.name}</h3>
                      <p className="text-sm text-muted-foreground">{category.count} items</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
