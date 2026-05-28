import { ArrowLeft, LayoutDashboard } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useDesktopWindowId } from "@/components/desktop/DesktopWindowContext";
import { windowActions } from "@/store/windowStore";

interface ReturnToPOSButtonProps {
  inline?: boolean;
  className?: string;
}

export const ReturnToPOSButton = ({ inline = false, className = "" }: ReturnToPOSButtonProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const desktopWindowId = useDesktopWindowId();

  // Only show Dashboard button if logged in as admin (full_name === 'admin')
  let isAdminUser = false;
  try {
    const s = localStorage.getItem("offline_pos_session");
    if (s) {
      const parsed = JSON.parse(s);
      isAdminUser = (parsed?.full_name || "").toLowerCase() === "admin";
    }
  } catch {}

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
      {isAdminUser && location.pathname !== "/admin/dashboard-modern" && (
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
        Return to Desktop
      </Button>
    </div>
  );
};
