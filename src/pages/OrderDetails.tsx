import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MapPin, CreditCard, HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { usePageView } from "@/hooks/useAnalytics";

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  products: {
    name: string;
    image_url: string | null;
  };
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  subtotal: number;
  delivery_fee: number;
  tax: number;
  total: number;
  addresses: {
    label: string;
    address_line1: string;
    address_line2: string | null;
    city: string;
    state: string;
    zip_code: string;
  };
  payment_methods: {
    label: string;
    type: string;
  } | null;
}

const getStatusSteps = (status: string, createdAt: string) => {
  const steps = [
    { label: "Order Placed", key: "pending", completed: false, time: "" },
    { label: "Confirmed", key: "confirmed", completed: false, time: "" },
    { label: "Out for Delivery", key: "out_for_delivery", completed: false, time: "" },
    { label: "Delivered", key: "delivered", completed: false, time: "" },
  ];

  const statusOrder = ["pending", "confirmed", "out_for_delivery", "delivered"];
  const currentIndex = statusOrder.indexOf(status);

  return steps.map((step, index) => ({
    ...step,
    completed: index <= currentIndex,
    time: index === 0 ? new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : step.time,
  }));
};

export default function OrderDetails() {
  usePageView("Order Details");
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrderDetails();
  }, [id]);

  const fetchOrderDetails = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth/login");
        return;
      }

      // Try to query by order_number first (if id looks like an order number)
      // Otherwise try by UUID
      let orderQuery = supabase
        .from("orders")
        .select(`
          *,
          addresses (
            label,
            address_line1,
            address_line2,
            city,
            state,
            zip_code
          ),
          payment_methods (
            label,
            type
          )
        `)
        .eq("user_id", user.id);

      // Check if id looks like an order number (starts with ORD-) or UUID
      if (id?.startsWith('ORD-')) {
        orderQuery = orderQuery.eq("order_number", id);
      } else {
        orderQuery = orderQuery.eq("id", id);
      }

      const { data: orderData, error: orderError } = await orderQuery.maybeSingle();

      if (orderError) throw orderError;

      if (!orderData) {
        setOrder(null);
        setLoading(false);
        return;
      }

      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select(`
          *,
          products (
            name,
            image_url
          )
        `)
        .eq("order_id", orderData.id);

      if (itemsError) throw itemsError;

      setOrder(orderData);
      setOrderItems(itemsData || []);
    } catch (error) {
      console.error("Error fetching order:", error);
      toast.error("Failed to load order details");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <Header />
        <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </main>
        <BottomNav />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <Header />
        <main className="max-w-screen-xl mx-auto px-4 py-6">
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground mb-4">Order not found</p>
              <Link to="/orders">
                <Button>View All Orders</Button>
              </Link>
            </CardContent>
          </Card>
        </main>
        <BottomNav />
      </div>
    );
  }

  const statusSteps = getStatusSteps(order.status, order.created_at);

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
            <h1 className="text-2xl font-bold">Order #{order.order_number}</h1>
            <p className="text-sm text-muted-foreground">
              Placed on {new Date(order.created_at).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
              })}
            </p>
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
                  {order.addresses.address_line1}
                  {order.addresses.address_line2 && `, ${order.addresses.address_line2}`}
                  <br />
                  {order.addresses.city}, {order.addresses.state} {order.addresses.zip_code}
                </p>
              </div>
            </div>
            {order.payment_methods && (
              <div className="flex items-start gap-3">
                <CreditCard className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium mb-1">Payment Method</p>
                  <p className="text-sm text-muted-foreground">{order.payment_methods.label}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Items */}
        <Card>
          <CardContent className="p-6">
            <h2 className="font-semibold mb-4">Order Items</h2>
            <div className="space-y-3">
              {orderItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                    {item.products.image_url ? (
                      <img 
                        src={item.products.image_url} 
                        alt={item.products.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl">📦</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.products.name}</p>
                    <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                  </div>
                  <span className="font-medium">{formatCurrency(item.subtotal)}</span>
                </div>
              ))}
            </div>
            <div className="h-px bg-border my-4" />
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery</span>
                <span>{formatCurrency(order.delivery_fee)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatCurrency(order.tax)}</span>
              </div>
              <div className="flex justify-between font-semibold text-base pt-2">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(order.total)}</span>
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
