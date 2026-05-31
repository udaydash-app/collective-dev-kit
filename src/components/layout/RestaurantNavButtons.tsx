import { ArrowLeft, LayoutDashboard, UtensilsCrossed } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useDesktopWindowId } from "@/components/desktop/DesktopWindowContext";
import { windowActions } from "@/store/windowStore";

interface RestaurantNavButtonsProps {
  className?: string;
}

export const RestaurantNavButtons = ({ className = "" }: RestaurantNavButtonsProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const desktopWindowId = useDesktopWindowId();

  // Only show on admin pages
  if (!location.pathname.startsWith("/admin")) {
    return null;
  }

  const isRestaurantRoot = location.pathname === "/admin/restaurant";
  const isRestaurantPOS = location.pathname === "/admin/restaurant/pos";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {!isRestaurantRoot && (
        <Button
          onClick={() => navigate("/admin/restaurant")}
          variant="outline"
          size="sm"
        >
          <UtensilsCrossed className="h-4 w-4 mr-2" />
          Restaurant
        </Button>
      )}
      {!isRestaurantPOS && (
        <Button
          onClick={() => {
            if (desktopWindowId) {
              windowActions.close(desktopWindowId);
            } else {
              navigate("/admin/desktop");
            }
          }}
          variant="outline"
          size="sm"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Desktop
        </Button>
      )}
    </div>
  );
};
