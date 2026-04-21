import { Navigate } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin, isLoading, user } = useAdmin();

  // Real-time order notifications for admins - must be before any returns
  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel(`admin-order-notifications-${Date.now()}-${Math.random().toString(36).slice(2)}`)
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

          // Play loud bell sound for 2 seconds
          try {
            const audioCtx = new AudioContext();
            const playBellTone = (freq: number, startTime: number, duration: number, gain: number) => {
              const osc = audioCtx.createOscillator();
              const gainNode = audioCtx.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(freq, audioCtx.currentTime + startTime);
              gainNode.gain.setValueAtTime(gain, audioCtx.currentTime + startTime);
              gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + startTime + duration);
              osc.connect(gainNode);
              gainNode.connect(audioCtx.destination);
              osc.start(audioCtx.currentTime + startTime);
              osc.stop(audioCtx.currentTime + startTime + duration);
            };
            // Ring bell pattern over 2 seconds
            for (let i = 0; i < 6; i++) {
              playBellTone(880, i * 0.33, 0.3, 0.8);
              playBellTone(1760, i * 0.33, 0.25, 0.4);
              playBellTone(1320, i * 0.33 + 0.05, 0.2, 0.3);
            }
          } catch (e) {
            console.log('Bell sound failed:', e);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  // Prevent any rendering until auth check is complete
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

  // Redirect if not authenticated
  if (!user) {
    return <Navigate to="/pos-login" replace />;
  }

  // Block access if not admin
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
