import { useState, useEffect } from "react";
import { MapPin, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";
import { LocationDialog } from "./LocationDialog";
import { LanguageSelector } from "./LanguageSelector";
import { supabase } from "@/integrations/supabase/client";

export const Header = () => {
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [currentLocation, setCurrentLocation] = useState("Select location");
  const [companyLogo, setCompanyLogo] = useState(logo);
  const [companyName, setCompanyName] = useState("Global Market");

  useEffect(() => {
    // Load saved location from localStorage
    const savedLocation = localStorage.getItem("userLocationAddress");
    if (savedLocation) {
      setCurrentLocation(savedLocation);
    }

    // Load company settings
    const loadSettings = async () => {
      const { data } = await supabase
        .from('settings')
        .select('logo_url, company_name')
        .limit(1)
        .maybeSingle();
      
      if (data) {
        if (data.logo_url) setCompanyLogo(data.logo_url);
        if (data.company_name) setCompanyName(data.company_name);
      }
    };

    loadSettings();
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="flex items-center justify-between h-14 px-4 max-w-screen-xl mx-auto">
          <Link to="/" className="flex items-center gap-2">
            <img src={companyLogo} alt={companyName} className="h-14 w-auto" />
          </Link>
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-muted-foreground max-w-[200px]"
            onClick={() => setLocationDialogOpen(true)}
          >
            <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="text-sm truncate">{currentLocation}</span>
          </Button>
          
          <LanguageSelector />
          
          <Link to="/notifications">
            <Button variant="ghost" size="icon">
              <Bell className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </header>

      <LocationDialog 
        open={locationDialogOpen} 
        onOpenChange={setLocationDialogOpen}
      />
    </>
  );
};
