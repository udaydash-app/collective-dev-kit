import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Package, Truck, CheckCircle, Clock } from "lucide-react";

const statusConfig = {
  confirmed: {
    title: "Order Confirmed! ✅",
    description: "Your order has been confirmed and is being prepared.",
    icon: CheckCircle,
  },
  processing: {
    title: "Order Processing 📦",
    description: "Your order is being prepared for shipment.",
    icon: Package,
  },
  shipped: {
    title: "Order Shipped! 🚚",
    description: "Your order is on its way to you.",
    icon: Truck,
  },
  out_for_delivery: {
    title: "Out for Delivery 🚗",
    description: "Your order will arrive soon!",
    icon: Truck,
  },
  delivered: {
    title: "Order Delivered! 🎉",
    description: "Your order has been successfully delivered.",
    icon: CheckCircle,
  },
  cancelled: {
    title: "Order Cancelled",
    description: "Your order has been cancelled.",
    icon: Clock,
  },
};

export const OrderStatusNotifications = () => {
  const previousStatusesRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupRealtimeSubscription = async () => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // Fetch initial order statuses
      const { data: initialOrders } = await supabase
        .from('orders')
        .select('id, status')
        .eq('user_id', user.id);

      if (initialOrders) {
        initialOrders.forEach(order => {
          previousStatusesRef.current.set(order.id, order.status);
        });
      }

      // Subscribe to order updates
      channel = supabase
        .channel('user-order-updates')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            const updatedOrder = payload.new as any;
            const previousStatus = previousStatusesRef.current.get(updatedOrder.id);
            
            // Only show notification if status actually changed
            if (previousStatus && previousStatus !== updatedOrder.status) {
              const config = statusConfig[updatedOrder.status as keyof typeof statusConfig];
              
              if (config) {
                toast({
                  title: config.title,
                  description: `${config.description} (Order #${updatedOrder.order_number})`,
                  duration: 8000,
                });

                // Play notification sound
                const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZUB0KT6Xj8bJoGgU7lNn01og5BxpsveXrmU8ODEul4fGsZBUGPZPY88Z3KwU1hM3v2YhABxlpuOyplVMOCkunzO+xZxkFMobe8MV/MwU8j9Xt2YxABhJqt+mrmFMNDEuk5O6yYhgFMoje7cZ9MgU6jdTt2YpABhFqtuirlVQNCUuj5PCtYRgFMobf7MV9MgU5jNTs2YlABhFqtuirlVQOCkqi5O+uXxcFMYbe7MV9MgU5i9Tr2YlABhFqtuirlVQOCkqi5O+uXxcFMYbe7MV9MgU5i9Tr2YlABhFqtuirlVQOCkqi5O+uXxcFMYbe7MV9MgU5i9Tr2YlA');
                audio.volume = 0.2;
                audio.play().catch(() => {}); // Ignore errors if audio fails
              }
              
              // Update previous status
              previousStatusesRef.current.set(updatedOrder.id, updatedOrder.status);
            }
          }
        )
        .subscribe();
    };

    setupRealtimeSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  return null; // This component doesn't render anything
};
