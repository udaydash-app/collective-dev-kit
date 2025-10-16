import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
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
  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        {/* User Info Card */}
        <Card>
          <CardContent className="p-6">
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
          </CardContent>
        </Card>

        {/* Menu Items */}
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

        {/* Logout Button */}
        <Button variant="outline" className="w-full" disabled>
          <LogOut className="h-5 w-5 mr-2" />
          Logout
        </Button>
      </main>

      <BottomNav />
    </div>
  );
}
