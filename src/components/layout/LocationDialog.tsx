import { useState } from "react";
import { MapPin, Locate, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface LocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LocationDialog({ open, onOpenChange }: LocationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");

  const handleGetCurrentLocation = () => {
    setLoading(true);
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          // Store coordinates in localStorage
          localStorage.setItem(
            "userLocation",
            JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              timestamp: Date.now(),
            })
          );

          // Try to get address from reverse geocoding (using a free service)
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${position.coords.latitude}&lon=${position.coords.longitude}&format=json`
          );
          const data = await response.json();
          
          if (data.address) {
            const locationStr = `${data.address.city || data.address.town || data.address.village || ''}, ${data.address.country || ''}`;
            localStorage.setItem("userLocationAddress", locationStr);
            toast.success(`Location set to ${locationStr}`);
          } else {
            toast.success("Current location detected");
          }
          
          onOpenChange(false);
          window.location.reload(); // Refresh to update location display
        } catch (error) {
          console.error("Error getting address:", error);
          toast.success("Current location detected");
          onOpenChange(false);
          window.location.reload();
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        toast.error("Unable to get your location");
        setLoading(false);
      }
    );
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!address.trim() || !city.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    const locationStr = `${city}, ${address}`;
    localStorage.setItem("userLocationAddress", locationStr);
    toast.success(`Location set to ${locationStr}`);
    onOpenChange(false);
    window.location.reload(); // Refresh to update location display
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Your Location</DialogTitle>
          <DialogDescription>
            Choose your delivery location to see nearby stores and delivery options
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Location Option */}
          <Button
            onClick={handleGetCurrentLocation}
            disabled={loading}
            className="w-full justify-start gap-2"
            variant="outline"
          >
            <Locate className="h-4 w-4" />
            {loading ? "Detecting location..." : "Use current location"}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or enter manually
              </span>
            </div>
          </div>

          {/* Manual Entry Form */}
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                placeholder="Enter your city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Street Address</Label>
              <Input
                id="address"
                placeholder="Enter your address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full">
              Confirm Location
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
