import { Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Plus, CreditCard, Wallet } from "lucide-react";

const paymentMethods = [
  {
    id: 1,
    type: "card",
    label: "Visa ending in 4242",
    expiry: "12/25",
    icon: CreditCard,
    isDefault: true,
  },
  {
    id: 2,
    type: "card",
    label: "Mastercard ending in 5555",
    expiry: "08/26",
    icon: CreditCard,
    isDefault: false,
  },
  {
    id: 3,
    type: "wallet",
    label: "Digital Wallet",
    expiry: "",
    icon: Wallet,
    isDefault: false,
  },
];

export default function PaymentMethods() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/profile">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Payment Methods</h1>
        </div>

        <div className="space-y-3">
          {paymentMethods.map((method) => {
            const Icon = method.icon;
            return (
              <Card key={method.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{method.label}</h3>
                        {method.isDefault && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                            Default
                          </span>
                        )}
                      </div>
                      {method.expiry && (
                        <p className="text-sm text-muted-foreground">Expires {method.expiry}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm">Edit</Button>
                      <Button variant="ghost" size="sm" className="text-destructive">
                        Remove
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Button className="w-full" size="lg">
          <Plus className="h-5 w-5 mr-2" />
          Add Payment Method
        </Button>

        <Card className="bg-muted/50">
          <CardContent className="p-4 text-sm text-muted-foreground text-center">
            🔒 Your payment information is encrypted and secure
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}
