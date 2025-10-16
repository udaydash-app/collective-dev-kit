import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MapPin, Clock, Phone, Navigation, Loader2 } from "lucide-react";
import { StoreMap } from "@/components/map/StoreMap";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePageView } from "@/hooks/useAnalytics";

interface Store {
  id: string;
  name: string;
  address: string;
  city: string;
  hours: string;
  phone: string;
  latitude: number | null;
  longitude: number | null;
  distance?: number;
}

interface UserLocation {
  latitude: number;
  longitude: number;
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default function Stores() {
  usePageView("Stores");
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, address, city, hours, phone, latitude, longitude")
        .eq("is_active", true);

      if (error) throw error;
      setStores(data || []);
    } catch (error) {
      console.error("Error fetching stores:", error);
      toast.error("Failed to load stores");
    } finally {
      setLoading(false);
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setUserLocation(location);
        
        // Calculate distances for stores with coordinates
        const storesWithDistance = stores.map(store => {
          if (store.latitude && store.longitude) {
            const distance = calculateDistance(
              location.latitude,
              location.longitude,
              store.latitude,
              store.longitude
            );
            return { ...store, distance };
          }
          return store;
        });

        // Sort by distance
        storesWithDistance.sort((a, b) => (a.distance || 999) - (b.distance || 999));
        setStores(storesWithDistance);

        toast.success("Location captured successfully!");
        setGettingLocation(false);
      },
      (error) => {
        console.error("Geolocation error:", error);
        toast.error("Unable to get your location. Please enable location services.");
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/profile">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Store Locator</h1>
          </div>
          <Button
            variant="outline"
            onClick={handleGetCurrentLocation}
            disabled={gettingLocation}
            className="gap-2"
          >
            {gettingLocation ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Getting...
              </>
            ) : (
              <>
                <Navigation className="h-4 w-4" />
                My Location
              </>
            )}
          </Button>
        </div>

        {userLocation && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4">
              <p className="text-sm font-medium">
                📍 Current Location: {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="aspect-video bg-muted rounded-lg overflow-hidden">
          <StoreMap stores={stores} userLocation={userLocation} />
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-24 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : stores.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">No stores found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {stores.map((store) => (
              <Card key={store.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{store.name}</h3>
                      {store.distance && (
                        <p className="text-sm text-primary">{store.distance.toFixed(1)} km away</p>
                      )}
                    </div>
                    <Button size="sm">Shop Now</Button>
                  </div>
                  
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{store.address}, {store.city}</span>
                    </div>
                    {store.hours && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 flex-shrink-0" />
                        <span>{store.hours}</span>
                      </div>
                    )}
                    {store.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 flex-shrink-0" />
                        <span>{store.phone}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
