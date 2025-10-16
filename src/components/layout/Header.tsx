import { MapPin, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export const Header = () => {
  return (
    <header className="sticky top-0 z-40 bg-card border-b border-border">
      <div className="flex items-center justify-between h-14 px-4 max-w-screen-xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">GM</span>
          </div>
          <span className="font-bold text-lg hidden sm:inline">Global Market</span>
        </Link>
        
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <MapPin className="h-4 w-4 mr-2" />
          <span className="text-sm">Select location</span>
        </Button>
        
        <Link to="/notifications">
          <Button variant="ghost" size="icon">
            <Bell className="h-5 w-5" />
          </Button>
        </Link>
      </div>
    </header>
  );
};
