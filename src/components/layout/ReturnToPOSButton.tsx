import { ArrowLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";

export const ReturnToPOSButton = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Only show on admin pages (except POS itself, POS login, Products page, Import Contacts page, Contacts page, and Product Import page)
  if (
    location.pathname === "/admin/pos" || 
    location.pathname === "/pos-login" ||
    location.pathname === "/admin/products" ||
    location.pathname === "/admin/import-contacts" ||
    location.pathname === "/admin/contacts" ||
    location.pathname === "/admin/import-products" ||
    !location.pathname.startsWith("/admin")
  ) {
    return null;
  }

  return (
    <Button
      onClick={() => navigate("/admin/pos")}
      variant="outline"
      size="sm"
      className="fixed top-4 right-4 z-50 shadow-lg"
    >
      <ArrowLeft className="h-4 w-4 mr-2" />
      Return to POS
    </Button>
  );
};
