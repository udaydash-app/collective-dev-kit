import { Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, MapPin, Clock, Phone } from "lucide-react";

const stores = [
  {
    id: 1,
    name: "Fresh Market Downtown",
    address: "123 Main St, Downtown",
    hours: "8:00 AM - 10:00 PM",
    phone: "(555) 123-4567",
    distance: "0.8 miles",
  },
  {
    id: 2,
    name: "Organic Grocers",
    address: "456 Oak Ave, Midtown",
    hours: "7:00 AM - 9:00 PM",
    phone: "(555) 234-5678",
    distance: "1.2 miles",
  },
];

export default function Stores() {
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
          <h1 className="text-2xl font-bold">Store Locator</h1>
        </div>

        <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
          <p className="text-muted-foreground">Map view placeholder</p>
        </div>

        <div className="space-y-4">
          {stores.map((store) => (
            <Card key={store.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{store.name}</h3>
                    <p className="text-sm text-primary">{store.distance} away</p>
                  </div>
                  <Button size="sm">Shop Now</Button>
                </div>
                
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{store.address}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 flex-shrink-0" />
                    <span>{store.hours}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 flex-shrink-0" />
                    <span>{store.phone}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
