import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCart } from "@/hooks/useCart";
import { formatCurrency } from "@/lib/utils";
import { z } from "zod";

const guestOrderSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name is too long"),
  phone: z.string().trim().min(8, "Phone number is invalid").max(20, "Phone number is too long"),
  area: z.string().trim().min(2, "Area is required").max(200, "Area is too long"),
  instructions: z.string().max(500, "Instructions are too long").optional()
});

export default function GuestCheckout() {
  const navigate = useNavigate();
  const { cartItems, calculateTotal, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    area: "",
    instructions: ""
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form data
    try {
      guestOrderSchema.parse(formData);
      setErrors({});
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach(err => {
          if (err.path[0]) {
            newErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(newErrors);
        return;
      }
    }

    if (cartItems.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    setLoading(true);

    try {
      // Get the first active store (or default store)
      const { data: stores } = await supabase
        .from('stores')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (!stores) {
        toast.error("No active store found");
        return;
      }

      const subtotal = calculateTotal();
      
      // Generate order number
      const orderNumber = 'ORD-' + Date.now().toString(36).toUpperCase();
      
      // Create order without user_id (guest order)
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          store_id: stores.id,
          subtotal: subtotal,
          total: subtotal,
          delivery_fee: 0,
          tax: 0,
          status: 'pending',
          payment_status: 'pending',
          delivery_instructions: `Guest Order - Name: ${formData.name}, Phone: ${formData.phone}, Area: ${formData.area}${formData.instructions ? ', Instructions: ' + formData.instructions : ''}`
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = cartItems.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.products.price,
        subtotal: item.products.price * item.quantity
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Clear cart
      await clearCart();

      toast.success("Order placed successfully!");
      navigate(`/order/confirmation/${order.id}`);
    } catch (error) {
      console.error("Error placing order:", error);
      toast.error("Failed to place order. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      
      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/cart")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Checkout</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-lg font-semibold mb-4">Delivery Information</h2>
              
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Enter your full name"
                  maxLength={100}
                  required
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  placeholder="Enter your phone number"
                  maxLength={20}
                  required
                />
                {errors.phone && (
                  <p className="text-sm text-destructive">{errors.phone}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="area">Delivery Area *</Label>
                <Input
                  id="area"
                  value={formData.area}
                  onChange={(e) => handleChange("area", e.target.value)}
                  placeholder="Enter your area/neighborhood"
                  maxLength={200}
                  required
                />
                {errors.area && (
                  <p className="text-sm text-destructive">{errors.area}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructions">Additional Instructions (Optional)</Label>
                <Textarea
                  id="instructions"
                  value={formData.instructions}
                  onChange={(e) => handleChange("instructions", e.target.value)}
                  placeholder="Any special delivery instructions..."
                  rows={3}
                  maxLength={500}
                />
                {errors.instructions && (
                  <p className="text-sm text-destructive">{errors.instructions}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-3">
              <h3 className="font-semibold mb-3">Order Summary</h3>
              <div className="space-y-2">
                {cartItems.map((item) => (
                  <div key={item.product_id} className="flex justify-between text-sm">
                    <span>{item.products.name} x {item.quantity}</span>
                    <span>{formatCurrency(item.products.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-3 mt-3">
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(calculateTotal())}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                The store will contact you to confirm the order and provide final pricing including any delivery fees.
              </p>
            </CardContent>
          </Card>

          <Button 
            type="submit"
            size="lg" 
            className="w-full" 
            disabled={loading || cartItems.length === 0}
          >
            {loading ? "Placing Order..." : "Place Order"}
          </Button>
        </form>
      </main>
    </div>
  );
}
