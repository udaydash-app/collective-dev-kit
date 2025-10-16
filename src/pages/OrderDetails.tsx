import { Link, useParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, MapPin, CreditCard, HelpCircle } from "lucide-react";

const orderItems = [
  { id: 1, name: "Organic Bananas", quantity: 2, price: "$2.99", image: "🍌" },
  { id: 2, name: "Whole Milk Gallon", quantity: 1, price: "$4.49", image: "🥛" },
  { id: 3, name: "Free Range Eggs", quantity: 1, price: "$5.99", image: "🥚" },
];

const statusSteps = [
  { label: "Order Placed", completed: true, time: "2:15 PM" },
  { label: "Preparing", completed: true, time: "2:30 PM" },
  { label: "Out for Delivery", completed: false, time: "" },
  { label: "Delivered", completed: false, time: "" },
];

export default function OrderDetails() {
  const { id } = useParams();

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/orders">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Order #{id}</h1>
            <p className="text-sm text-muted-foreground">Placed on Dec 15, 2024</p>
          </div>
        </div>

        {/* Order Status */}
        <Card>
          <CardContent className="p-6">
            <h2 className="font-semibold mb-4">Order Status</h2>
            <div className="space-y-4">
              {statusSteps.map((step, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    step.completed ? 'bg-primary' : 'bg-muted'
                  }`}>
                    {step.completed && (
                      <div className="w-2 h-2 bg-primary-foreground rounded-full" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${step.completed ? '' : 'text-muted-foreground'}`}>
                      {step.label}
                    </p>
                    {step.time && (
                      <p className="text-sm text-muted-foreground">{step.time}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Delivery Info */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium mb-1">Delivery Address</p>
                <p className="text-sm text-muted-foreground">
                  123 Main St, Apt 4B<br />
                  New York, NY 10001
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CreditCard className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium mb-1">Payment Method</p>
                <p className="text-sm text-muted-foreground">•••• 4242</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Items */}
        <Card>
          <CardContent className="p-6">
            <h2 className="font-semibold mb-4">Order Items</h2>
            <div className="space-y-3">
              {orderItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center text-2xl">
                    {item.image}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                  </div>
                  <span className="font-medium">{item.price}</span>
                </div>
              ))}
            </div>
            <div className="h-px bg-border my-4" />
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>$45.97</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery</span>
                <span>$4.99</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span>$3.68</span>
              </div>
              <div className="flex justify-between font-semibold text-base pt-2">
                <span>Total</span>
                <span className="text-primary">$54.64</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Link to="/support">
          <Button variant="outline" className="w-full">
            <HelpCircle className="h-5 w-5 mr-2" />
            Need Help?
          </Button>
        </Link>
      </main>

      <BottomNav />
    </div>
  );
}
