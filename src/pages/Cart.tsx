import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";

export default function Cart() {
  const cartEmpty = true;

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="max-w-screen-xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Shopping Cart</h1>

        {cartEmpty ? (
          <Card>
            <CardContent className="p-12 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
                <ShoppingBag className="h-10 w-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
              <p className="text-muted-foreground mb-6">
                Add items to get started
              </p>
              <Link to="/categories">
                <Button size="lg">Start Shopping</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Cart items will go here */}
            <div className="fixed bottom-20 left-0 right-0 p-4 bg-background border-t">
              <div className="max-w-screen-xl mx-auto">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-lg font-semibold">Total</span>
                  <span className="text-2xl font-bold text-primary">$0.00</span>
                </div>
                <Link to="/checkout">
                  <Button size="lg" className="w-full">
                    Proceed to Checkout
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
