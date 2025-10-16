import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, CreditCard, Wallet } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const paymentMethods = [
  { id: "card1", type: "card", label: "•••• 4242", icon: CreditCard, isDefault: true },
  { id: "card2", type: "card", label: "•••• 5555", icon: CreditCard, isDefault: false },
  { id: "wallet", type: "wallet", label: "Digital Wallet", icon: Wallet, isDefault: false },
];

export default function Payment() {
  const navigate = useNavigate();
  const [selectedMethod, setSelectedMethod] = useState(paymentMethods[0].id);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCompleteOrder = async () => {
    setIsProcessing(true);
    
    // Simulate payment processing
    setTimeout(() => {
      setIsProcessing(false);
      toast({
        title: "Order placed successfully!",
        description: "Your groceries are on the way.",
      });
      navigate("/order/confirmation/12345");
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      
      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/checkout">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Payment</h1>
        </div>

        {/* Payment Methods */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Select Payment Method</h2>
          <RadioGroup value={selectedMethod} onValueChange={setSelectedMethod}>
            {paymentMethods.map((method) => {
              const Icon = method.icon;
              return (
                <Card key={method.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value={method.id} id={method.id} />
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <label htmlFor={method.id} className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{method.label}</span>
                          {method.isDefault && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                              Default
                            </span>
                          )}
                        </div>
                      </label>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </RadioGroup>
          <Link to="/profile/payment-methods">
            <Button variant="outline" className="w-full">Add New Payment Method</Button>
          </Link>
        </section>

        {/* Order Total */}
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-2xl font-bold text-primary">$54.64</p>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p>Delivery: Today, 2-4 PM</p>
                <p>123 Main St, Apt 4B</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Notice */}
        <Card className="bg-muted/50">
          <CardContent className="p-4 text-sm text-muted-foreground text-center">
            🔒 Your payment information is secure and encrypted
          </CardContent>
        </Card>

        <Button 
          size="lg" 
          className="w-full" 
          onClick={handleCompleteOrder}
          disabled={isProcessing}
        >
          {isProcessing ? "Processing..." : "Complete Order"}
        </Button>
      </main>
    </div>
  );
}
