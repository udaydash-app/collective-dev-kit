import { Link, useParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Package } from "lucide-react";

export default function OrderConfirmation() {
  const { orderId } = useParams();

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="max-w-screen-xl mx-auto px-4 py-6">
        <Card>
          <CardContent className="p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-12 w-12 text-primary" />
            </div>
            
            <div>
              <h1 className="text-2xl font-bold mb-2">Order Placed Successfully!</h1>
              <p className="text-muted-foreground">
                Thank you for your order. We'll notify you when it's on the way.
              </p>
            </div>

            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground mb-1">Order Number</p>
                <p className="text-xl font-bold">#{orderId}</p>
              </CardContent>
            </Card>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                <span>Estimated Delivery: Today, 2:00 PM - 4:00 PM</span>
              </div>
              <p className="text-muted-foreground">
                You'll receive updates via notifications
              </p>
            </div>

            <div className="flex flex-col gap-3 pt-4">
              <Link to={`/order/${orderId}`}>
                <Button size="lg" className="w-full">
                  Track Order
                </Button>
              </Link>
              <Link to="/">
                <Button variant="outline" size="lg" className="w-full">
                  Continue Shopping
                </Button>
              </Link>
            </div>

            <Card className="bg-accent/10 border-accent/20">
              <CardContent className="p-4 text-sm">
                <p className="font-medium text-accent mb-1">🎉 You saved $5.00 on this order!</p>
                <p className="text-muted-foreground">
                  Use code SAVE10 on your next order for 10% off
                </p>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}
