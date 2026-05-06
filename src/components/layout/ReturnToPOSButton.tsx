import { ArrowLeft, LayoutDashboard } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface ReturnToPOSButtonProps {
  inline?: boolean;
  className?: string;
}

export const ReturnToPOSButton = ({ inline = false, className = "" }: ReturnToPOSButtonProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Only show on admin pages (not on /admin/pos or /pos-login)
  if (
    location.pathname === "/admin/pos" || 
    location.pathname === "/pos-login" ||
    !location.pathname.startsWith("/admin")
  ) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {location.pathname !== "/admin/dashboard-modern" && (
        <Button
          onClick={() => navigate("/admin/dashboard-modern")}
          variant="outline"
          size="sm"
        >
          <LayoutDashboard className="h-4 w-4 mr-2" />
          Dashboard
        </Button>
      )}
      <Button
        onClick={() => navigate("/admin/pos")}
        variant="outline"
        size="sm"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Return to POS
      </Button>
    </div>
  );
};
