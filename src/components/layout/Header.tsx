import { useState, useEffect } from "react";
import { MapPin, Bell, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";
import { LocationDialog } from "./LocationDialog";
import { LanguageSelector } from "./LanguageSelector";
import { supabase } from "@/integrations/supabase/client";
import { KeyboardBadge } from "@/components/ui/keyboard-badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
      <header className="sticky top-0 z-30 bg-card border-b border-border pointer-events-none">
        <div className="flex items-center justify-between h-14 px-4 max-w-screen-xl mx-auto gap-2 pointer-events-auto">
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <img src={companyLogo} alt={companyName} className="h-14 w-auto" />
          </Link>
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-muted-foreground max-w-[200px] flex-shrink-0"
            onClick={() => setLocationDialogOpen(true)}
          >
            <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="text-sm truncate">{currentLocation}</span>
          </Button>
          
          <div className="flex items-center gap-2 ml-auto">
            <LanguageSelector />
            
            <TooltipProvider>
              <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => {
                    const event = new CustomEvent('show-shortcuts');
                    window.dispatchEvent(event);
                  }}
                  className="relative"
                >
                  <Keyboard className="h-5 w-5" />
                  <span className="absolute -bottom-1 -right-1">
                    <KeyboardBadge keys="?" className="scale-75" />
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Keyboard shortcuts</p>
              </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <Link to="/notifications">
              <Button variant="ghost" size="icon">
                <Bell className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <LocationDialog 
        open={locationDialogOpen} 
        onOpenChange={setLocationDialogOpen}
      />
    </>
  );
};
