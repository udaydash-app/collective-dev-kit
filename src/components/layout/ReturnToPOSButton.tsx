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

  // Only show on admin pages (except POS itself, POS login, Products page, Import Contacts page, Contacts page, Product Import page, and pages with inline buttons)
  if (
    location.pathname === "/admin/pos" || 
    location.pathname === "/pos-login" ||
    location.pathname === "/admin/products" ||
    location.pathname === "/admin/import-contacts" ||
    location.pathname === "/admin/contacts" ||
    location.pathname === "/admin/import-products" ||
    location.pathname === "/admin/offers" ||
    location.pathname === "/admin/announcements" ||
    location.pathname === "/admin/categories" ||
    !location.pathname.startsWith("/admin")
  ) {
    return null;
  }

  return (
    <Button
      onClick={() => navigate("/admin/pos")}
      variant="outline"
      size="sm"
      className={inline ? className : `fixed top-4 right-4 z-50 shadow-lg ${className}`}
    >
      <ArrowLeft className="h-4 w-4 mr-2" />
      Return to POS
    </Button>
  );
};
