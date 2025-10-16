import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, MapPin, CreditCard, Clock } from "lucide-react";

const addresses = [
  { id: "1", label: "Home", address: "123 Main St, Apt 4B, New York, NY 10001", isDefault: true },
  { id: "2", label: "Work", address: "456 Business Ave, Suite 200, New York, NY 10002", isDefault: false },
];

const timeSlots = [
  { id: "1", time: "Today, 2:00 PM - 4:00 PM", available: true },
  { id: "2", time: "Today, 4:00 PM - 6:00 PM", available: true },
  { id: "3", time: "Tomorrow, 9:00 AM - 11:00 AM", available: true },
  { id: "4", time: "Tomorrow, 2:00 PM - 4:00 PM", available: false },
];

export default function Checkout() {
  const navigate = useNavigate();
  const [selectedAddress, setSelectedAddress] = useState(addresses[0].id);
  const [selectedSlot, setSelectedSlot] = useState(timeSlots[0].id);
  const [instructions, setInstructions] = useState("");

  const handlePlaceOrder = () => {
    navigate("/checkout/payment");
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      
      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/cart">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Checkout</h1>
        </div>

        {/* Delivery Address */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Delivery Address</h2>
          </div>
          <RadioGroup value={selectedAddress} onValueChange={setSelectedAddress}>
            {addresses.map((addr) => (
              <Card key={addr.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <RadioGroupItem value={addr.id} id={addr.id} className="mt-1" />
                    <label htmlFor={addr.id} className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{addr.label}</span>
                        {addr.isDefault && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{addr.address}</p>
                    </label>
                  </div>
                </CardContent>
              </Card>
            ))}
          </RadioGroup>
          <Link to="/profile/addresses">
            <Button variant="outline" className="w-full">Add New Address</Button>
          </Link>
        </section>

        {/* Delivery Time Slot */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Delivery Time</h2>
          </div>
          <RadioGroup value={selectedSlot} onValueChange={setSelectedSlot}>
            {timeSlots.map((slot) => (
              <Card key={slot.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <RadioGroupItem 
                      value={slot.id} 
                      id={slot.id} 
                      disabled={!slot.available}
                    />
                    <label 
                      htmlFor={slot.id} 
                      className={`flex-1 cursor-pointer ${!slot.available ? 'opacity-50' : ''}`}
                    >
                      <span className="font-medium">{slot.time}</span>
                      {!slot.available && (
                        <span className="text-xs text-muted-foreground ml-2">(Unavailable)</span>
                      )}
                    </label>
                  </div>
                </CardContent>
              </Card>
            ))}
          </RadioGroup>
        </section>

        {/* Special Instructions */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Delivery Instructions (Optional)</h2>
          <Textarea
            placeholder="E.g., Leave at front door, ring doorbell, etc."
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={3}
          />
        </section>

        {/* Order Summary */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="font-semibold mb-3">Order Summary</h3>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>$45.97</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Delivery Fee</span>
              <span>$4.99</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span>$3.68</span>
            </div>
            <div className="h-px bg-border my-2" />
            <div className="flex justify-between font-semibold text-lg">
              <span>Total</span>
              <span className="text-primary">$54.64</span>
            </div>
          </CardContent>
        </Card>

        <Button size="lg" className="w-full" onClick={handlePlaceOrder}>
          Continue to Payment
        </Button>
      </main>
    </div>
  );
}
