import { useState, useEffect } from "react";
import { MapPin, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";
import { LocationDialog } from "./LocationDialog";

export const Header = () => {
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [currentLocation, setCurrentLocation] = useState("Select location");

  useEffect(() => {
    // Load saved location from localStorage
    const savedLocation = localStorage.getItem("userLocationAddress");
    if (savedLocation) {
      setCurrentLocation(savedLocation);
    }
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="flex items-center justify-between h-14 px-4 max-w-screen-xl mx-auto">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="Global Market" className="h-14 w-auto" />
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
