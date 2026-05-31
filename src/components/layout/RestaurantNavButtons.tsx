import { ArrowLeft } from "lucide-react";
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

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        onClick={() => {
          if (desktopWindowId) {
            windowActions.close(desktopWindowId);
            windowActions.openApp('restaurant');
          } else {
            navigate("/admin/restaurant");
          }
        }}
        variant="outline"
        size="sm"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Desktop
      </Button>
    </div>
  );
};
