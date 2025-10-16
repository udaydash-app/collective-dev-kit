import { Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Plus, MapPin } from "lucide-react";

const addresses = [
  {
    id: 1,
    label: "Home",
    address: "123 Main St, Apt 4B",
    city: "New York, NY 10001",
    isDefault: true,
  },
  {
    id: 2,
    label: "Work",
    address: "456 Business Ave, Suite 200",
    city: "New York, NY 10002",
    isDefault: false,
  },
];

export default function Addresses() {
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
          <h1 className="text-2xl font-bold">Delivery Addresses</h1>
        </div>

        <div className="space-y-3">
          {addresses.map((addr) => (
            <Card key={addr.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{addr.label}</h3>
                      {addr.isDefault && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{addr.address}</p>
                    <p className="text-sm text-muted-foreground">{addr.city}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm">Edit</Button>
                    <Button variant="ghost" size="sm" className="text-destructive">
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Button className="w-full" size="lg">
          <Plus className="h-5 w-5 mr-2" />
          Add New Address
        </Button>
      </main>

      <BottomNav />
    </div>
  );
}
