import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import {
  User,
  MapPin,
  CreditCard,
  Package,
  Bell,
  HelpCircle,
  LogOut,
  ChevronRight,
  Store,
  Heart,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePageView } from "@/hooks/useAnalytics";

const menuItems = [
  { icon: Heart, label: "My Wishlist", path: "/wishlist" },
  { icon: Package, label: "Order History", path: "/orders" },
  { icon: MapPin, label: "Addresses", path: "/profile/addresses" },
  { icon: CreditCard, label: "Payment Methods", path: "/profile/payment-methods" },
  { icon: Store, label: "Store Locator", path: "/stores" },
  { icon: Bell, label: "Notifications", path: "/notifications" },
  { icon: HelpCircle, label: "Help & Support", path: "/support" },
];

export default function Profile() {
  usePageView("Profile");
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
        
        setProfile(profileData);
      }
    } catch (error) {
      console.error("Error fetching user:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast.success("Logged out successfully");
      setUser(null);
      setProfile(null);
      navigate("/auth/login");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to log out");
    }
  };
  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        {/* User Info Card */}
        <Card>
          <CardContent className="p-6">
            {loading ? (
              <div className="animate-pulse">
                <div className="h-16 w-16 bg-muted rounded-full mb-4" />
                <div className="h-6 bg-muted rounded w-32 mb-2" />
                <div className="h-4 bg-muted rounded w-48" />
              </div>
            ) : user ? (
              <div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <User className="h-8 w-8 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold">
                      {profile?.full_name || "User"}
                    </h2>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <User className="h-8 w-8 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold">Guest User</h2>
                    <p className="text-sm text-muted-foreground">Sign in to save your preferences</p>
                  </div>
                </div>
                <Link to="/auth/login">
                  <Button className="w-full mt-4">Sign In</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Menu Items - Only show if logged in */}
        {user && (
          <div className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.path} to={item.path}>
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium">{item.label}</span>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        {/* Logout Button - Only show if logged in */}
        {user && (
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            <LogOut className="h-5 w-5 mr-2" />
            Logout
          </Button>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
