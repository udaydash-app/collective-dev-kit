import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Apple, Milk, Beef, Carrot, Package, ShoppingCart } from "lucide-react";

const categories = [
  { name: "Fruits", icon: Apple, path: "/category/fruits" },
  { name: "Dairy", icon: Milk, path: "/category/dairy" },
  { name: "Meat", icon: Beef, path: "/category/meat" },
  { name: "Vegetables", icon: Carrot, path: "/category/vegetables" },
  { name: "Pantry", icon: Package, path: "/category/pantry" },
  { name: "More", icon: ShoppingCart, path: "/categories" },
];

const featuredDeals = [
  { id: 1, name: "Fresh Organic Bananas", price: "$2.99", originalPrice: "$3.99", image: "🍌" },
  { id: 2, name: "Whole Milk Gallon", price: "$4.49", originalPrice: "$5.49", image: "🥛" },
  { id: 3, name: "Free Range Eggs", price: "$5.99", originalPrice: "$6.99", image: "🥚" },
];

export default function Home() {
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
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {featuredDeals.map((deal) => (
              <Link key={deal.id} to={`/product/${deal.id}`} className="flex-shrink-0">
                <Card className="w-[280px] hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center text-4xl">
                        {deal.image}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-sm mb-1">{deal.name}</h3>
                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-bold text-primary">{deal.price}</span>
                          <span className="text-xs text-muted-foreground line-through">{deal.originalPrice}</span>
                        </div>
                        <Button size="sm" className="mt-2 w-full">Add to Cart</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* Categories Grid */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Shop by Category</h2>
          <div className="grid grid-cols-3 gap-3">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <Link key={category.name} to={category.path}>
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4 flex flex-col items-center gap-2">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <span className="text-sm font-medium text-center">{category.name}</span>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
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
