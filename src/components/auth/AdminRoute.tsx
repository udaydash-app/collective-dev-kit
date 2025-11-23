import { Navigate } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import { Loader2, ShoppingBag } from "lucide-react";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin, isLoading, user, role } = useAdmin();

  console.log('🔒 AdminRoute Check:',
    'isAdmin:', isAdmin,
    'isLoading:', isLoading,
    'hasUser:', !!user,
    'userId:', user?.id,
    'userEmail:', user?.email,
    'role:', role,
    'offlineSession:', localStorage.getItem('offline_pos_session'),
    'navigatorOnline:', navigator.onLine
  );

  // Real-time order notifications for admins
  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel('admin-order-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          const order = payload.new as any;
          toast({
            title: "New Order Received! 🎉",
            description: `Order #${order.order_number} - Total: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(order.total)}`,
            duration: 10000,
          });

          // Play notification sound
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZUB0KT6Xj8bJoGgU7lNn01og5BxpsveXrmU8ODEul4fGsZBUGPZPY88Z3KwU1hM3v2YhABxlpuOyplVMOCkunzO+xZxkFMobe8MV/MwU8j9Xt2YxABhJqt+mrmFMNDEuk5O6yYhgFMoje7cZ9MgU6jdTt2YpABhFqtuirlVQNCUuj5PCtYRgFMobf7MV9MgU5jNTs2YlABhFqtuirlVQOCkqi5O+uXxcFMYbe7MV9MgU5i9Tr2YlABhFqtuirlVQOCkqi5O+uXxcFMYbe7MV9MgU5i9Tr2YlABhFqtuirlVQOCkqi5O+uXxcFMYbe7MV9MgU5i9Tr2YlA');
          audio.volume = 0.3;
          audio.play().catch(() => {}); // Ignore errors if audio fails
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Checking permissions...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/pos-login" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
          <p className="text-muted-foreground">
            You don't have administrator privileges to access this page.
          </p>
          <a 
            href="/" 
            className="inline-block mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Return to Home
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
