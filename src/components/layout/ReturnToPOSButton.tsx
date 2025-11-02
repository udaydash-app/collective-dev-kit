import { ArrowLeft } from "lucide-react";
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
    <Button
      onClick={() => navigate("/admin/pos")}
      variant="outline"
      size="sm"
      className={className}
    >
      <ArrowLeft className="h-4 w-4 mr-2" />
      Return to POS
    </Button>
  );
};
