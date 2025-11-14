import { Home, Grid3x3, Search, ShoppingBag, User } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { KeyboardBadge } from "@/components/ui/keyboard-badge";

const navItems = [
  { icon: Home, label: "Home", path: "/", shortcut: ["Ctrl", "H"] },
  { icon: Grid3x3, label: "Categories", path: "/categories", shortcut: null },
  { icon: Search, label: "Search", path: "/search", shortcut: ["Ctrl", "K"] },
  { icon: ShoppingBag, label: "Cart", path: "/cart", shortcut: ["Ctrl", "⇧", "C"] },
  { icon: User, label: "Profile", path: "/profile", shortcut: ["Ctrl", "P"] },
];

export const BottomNav = () => {
  const location = useLocation();

  // Hide bottom navigation on POS page
  if (location.pathname === '/admin/pos') {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40">
      <div className="flex items-center justify-around h-16 max-w-screen-xl mx-auto px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 min-w-[60px] py-2 px-3 rounded-lg relative",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.label}</span>
              {item.shortcut && (
                <div className="absolute top-1 right-1">
                  <KeyboardBadge keys={item.shortcut} className="scale-[0.6] opacity-60" />
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
