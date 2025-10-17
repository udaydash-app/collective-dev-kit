import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Coins, Banknote, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  products: {
    price: number;
  };
}

const paymentMethods = [
  { id: "store_credit", type: "store_credit", label: "Store Credit", icon: Coins, isDefault: true },
  { id: "cash", type: "cash_on_delivery", label: "Cash on Delivery", icon: Banknote, isDefault: false },
  { id: "wave", type: "wave_money", label: "Wave Money", icon: Smartphone, isDefault: false },
  { id: "orange", type: "orange_money", label: "Orange Money", icon: Smartphone, isDefault: false },
];

export default function Payment() {
  const navigate = useNavigate();
  const [selectedMethod, setSelectedMethod] = useState(paymentMethods[0].id);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCartItems();
  }, []);

  const fetchCartItems = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth/login");
        return;
      }

      const { data, error } = await supabase
        .from("cart_items")
        .select(`
          id,
          product_id,
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
      toast.error("Failed to load cart items");
    } finally {
      setLoading(false);
    }
  };

  const calculateSubtotal = () => {
    return cartItems.reduce((total, item) => total + (item.products.price * item.quantity), 0);
  };

  const handleCompleteOrder = async () => {
    setIsProcessing(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please log in to complete your order");
        navigate("/auth/login");
        return;
      }

      // Get checkout data from localStorage (set by Checkout page)
      const checkoutData = JSON.parse(localStorage.getItem('checkout_data') || '{}');
      
      if (!checkoutData.addressId || !checkoutData.paymentMethodId) {
        toast.error("Missing checkout information. Please go back to checkout.");
        navigate("/checkout");
        return;
      }

      // Get the default store
      const { data: storeData } = await supabase
        .from("stores")
        .select("id")
        .eq("is_active", true)
        .limit(1)
        .single();

      if (!storeData) {
        toast.error("No active store found");
        return;
      }

      // Calculate totals server-side (no delivery fee or tax at checkout)
      const { data: calculatedTotals, error: calculationError } = await supabase
        .rpc('calculate_order_total', {
          p_user_id: user.id,
          p_delivery_fee: 0,
          p_tax_rate: 0
        })
        .single();

      if (calculationError || !calculatedTotals) {
        console.error('Error calculating order total:', calculationError);
        toast.error("Error calculating order total. Please try again.");
        return;
      }

      // Generate order number
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

      // Create the order with server-validated totals
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert([{
          user_id: user.id,
          order_number: orderNumber,
          store_id: storeData.id,
          address_id: checkoutData.addressId,
          payment_method_id: checkoutData.paymentMethodId,
          subtotal: calculatedTotals.subtotal,
          delivery_fee: calculatedTotals.delivery_fee,
          tax: calculatedTotals.tax,
          total: calculatedTotals.total,
          delivery_time_slot: checkoutData.timeSlot || 'Today, 2:00 PM - 4:00 PM',
          delivery_instructions: checkoutData.instructions || null,
          status: 'pending',
          payment_status: 'pending'
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items from cart
      const orderItems = cartItems.map(item => ({
        order_id: orderData.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.products.price,
        subtotal: item.products.price * item.quantity
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Clear cart
      const { error: clearCartError } = await supabase
        .from("cart_items")
        .delete()
        .eq("user_id", user.id);

      if (clearCartError) throw clearCartError;

      // Clear checkout data
      localStorage.removeItem('checkout_data');

      toast.success("Order placed successfully! Your groceries are on the way.");
      navigate(`/order/confirmation/${orderData.order_number}`);
    } catch (error) {
      console.error("Error creating order:", error);
      toast.error("Failed to place order. Please try again.");
    } finally {
      setIsProcessing(false);
    }
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
              const isMobileMoney = method.type === "wave_money" || method.type === "orange_money";
              return (
                <Card key={method.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value={method.id} id={method.id} />
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <label htmlFor={method.id} className="flex-1 cursor-pointer">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{method.label}</span>
                            {method.isDefault && (
                              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                Default
                              </span>
                            )}
                          </div>
                          {isMobileMoney && selectedMethod === method.id && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Pay To: <span className="font-mono font-semibold text-foreground">+225 07 79 78 47 83</span>
                            </p>
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
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold">Order Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted-foreground">Order Subtotal</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(calculateSubtotal())}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Additional delivery fees and taxes (if any) will be added by the store when confirming your order.
              </p>
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
