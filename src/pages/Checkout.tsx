import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MapPin, Clock, Coins, Banknote, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePageView } from "@/hooks/useAnalytics";
import { formatCurrency } from "@/lib/utils";

interface Address {
  id: string;
  label: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip_code: string;
  is_default: boolean;
}

interface PaymentMethod {
  id: string;
  type: string;
  label: string;
  is_default: boolean;
}

interface CartItem {
  id: string;
  quantity: number;
  products: {
    price: number;
  };
}

const timeSlots = [
  { id: "1", time: "Today, 2:00 PM - 4:00 PM", available: true },
  { id: "2", time: "Today, 4:00 PM - 6:00 PM", available: true },
  { id: "3", time: "Tomorrow, 9:00 AM - 11:00 AM", available: true },
  { id: "4", time: "Tomorrow, 2:00 PM - 4:00 PM", available: false },
];

const getPaymentIcon = (type: string) => {
  switch (type) {
    case "store_credit":
      return Coins;
    case "cash_on_delivery":
      return Banknote;
    case "wave_money":
      return Smartphone;
    case "orange_money":
      return Smartphone;
    default:
      return Coins;
  }
};

export default function Checkout() {
  usePageView("Checkout");
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAddress, setSelectedAddress] = useState("");
  const [selectedPayment, setSelectedPayment] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(timeSlots[0].id);
  const [instructions, setInstructions] = useState("");

  useEffect(() => {
    checkAuthAndFetch();
  }, []);

  const checkAuthAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth/login");
      return;
    }
    await Promise.all([fetchAddresses(), fetchPaymentMethods(), fetchCartItems()]);
  };

  const fetchAddresses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("addresses")
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false });

      if (error) throw error;
      
      if (data && data.length > 0) {
        setAddresses(data);
        setSelectedAddress(data[0].id);
      }
    } catch (error) {
      console.error("Error fetching addresses:", error);
      toast.error("Failed to load addresses");
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false });

      if (error) throw error;
      
      if (data && data.length > 0) {
        setPaymentMethods(data);
        setSelectedPayment(data[0].id);
      }
    } catch (error) {
      console.error("Error fetching payment methods:", error);
      toast.error("Failed to load payment methods");
    } finally {
      setLoading(false);
    }
  };

  const fetchCartItems = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("cart_items")
        .select(`
          id,
          quantity,
          products (
            price
          )
        `)
        .eq("user_id", user.id);

      if (error) throw error;
      setCartItems(data || []);
    } catch (error) {
      console.error("Error fetching cart:", error);
    }
  };

  const calculateSubtotal = () => {
    return cartItems.reduce((total, item) => total + (item.products.price * item.quantity), 0);
  };

  const deliveryFee = 500; // 500 FCFA
  const tax = calculateSubtotal() * 0.1; // 10% tax
  const total = calculateSubtotal() + deliveryFee + tax;

  const handlePlaceOrder = () => {
    if (!selectedAddress) {
      toast.error("Please select a delivery address");
      return;
    }
    if (!selectedPayment) {
      toast.error("Please select a payment method");
      return;
    }
    navigate("/checkout/payment");
  };

  const formatAddress = (addr: Address) => {
    return `${addr.address_line1}${addr.address_line2 ? ', ' + addr.address_line2 : ''}, ${addr.city}, ${addr.state} ${addr.zip_code}`;
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
          {loading ? (
            <Card>
              <CardContent className="p-4">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ) : addresses.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground mb-4">No addresses saved</p>
                <Link to="/profile/addresses">
                  <Button>Add Address</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <>
              <RadioGroup value={selectedAddress} onValueChange={setSelectedAddress}>
                {addresses.map((addr) => (
                  <Card key={addr.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <RadioGroupItem value={addr.id} id={addr.id} className="mt-1" />
                        <label htmlFor={addr.id} className="flex-1 cursor-pointer">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{addr.label}</span>
                            {addr.is_default && (
                              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{formatAddress(addr)}</p>
                        </label>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </RadioGroup>
              <Link to="/profile/addresses">
                <Button variant="outline" className="w-full">Add New Address</Button>
              </Link>
            </>
          )}
        </section>

        {/* Payment Method */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Payment Method</h2>
          </div>
          {loading ? (
            <Card>
              <CardContent className="p-4">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ) : paymentMethods.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground mb-4">No payment methods saved</p>
                <Link to="/profile/payment-methods">
                  <Button>Add Payment Method</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <>
              <RadioGroup value={selectedPayment} onValueChange={setSelectedPayment}>
                {paymentMethods.map((method) => {
                  const Icon = getPaymentIcon(method.type);
                  const isMobileMoney = method.type === "wave_money" || method.type === "orange_money";
                  return (
                    <Card key={method.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value={method.id} id={method.id} />
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <label htmlFor={method.id} className="flex-1 cursor-pointer">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{method.label}</span>
                              {method.is_default && (
                                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                  Default
                                </span>
                              )}
                            </div>
                            {isMobileMoney && selectedPayment === method.id && (
                              <p className="text-sm text-muted-foreground mt-1">
                                Pay To: <span className="font-mono font-semibold text-foreground">+225 07 79 78 47 83</span>
                              </p>
                            )}
                          </label>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </RadioGroup>
              <Link to="/profile/payment-methods">
                <Button variant="outline" className="w-full">Add Payment Method</Button>
              </Link>
            </>
          )}
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
              <span>{formatCurrency(calculateSubtotal())}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Delivery Fee</span>
              <span>{formatCurrency(deliveryFee)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span>{formatCurrency(tax)}</span>
            </div>
            <div className="h-px bg-border my-2" />
            <div className="flex justify-between font-semibold text-lg">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(total)}</span>
            </div>
          </CardContent>
        </Card>

        <Button 
          size="lg" 
          className="w-full" 
          onClick={handlePlaceOrder}
          disabled={!selectedAddress || !selectedPayment}
        >
          Continue to Payment
        </Button>
      </main>
    </div>
  );
}
