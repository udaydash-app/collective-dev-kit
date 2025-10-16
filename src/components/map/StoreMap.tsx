import { useLoadScript, GoogleMap, Marker } from '@react-google-maps/api';
import { useMemo } from 'react';

interface Store {
  id: string;
  name: string;
  address: string;
  city: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface UserLocation {
  latitude: number;
  longitude: number;
}

interface StoreMapProps {
  stores: Store[];
  userLocation?: UserLocation | null;
  onStoreSelect?: (storeId: string) => void;
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

// Abidjan, Côte d'Ivoire coordinates
const center = {
  lat: 5.3600,
  lng: -4.0083,
};

export function StoreMap({ stores, userLocation, onStoreSelect }: StoreMapProps) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: 'YOUR_GOOGLE_MAPS_API_KEY', // User needs to replace this
  });

  const mapCenter = useMemo(() => {
    if (userLocation) {
      return { lat: userLocation.latitude, lng: userLocation.longitude };
    }
    return center;
  }, [userLocation]);

  const markers = useMemo(() => {
    return stores.map((store) => ({
      id: store.id,
      position: {
        lat: store.latitude || center.lat,
        lng: store.longitude || center.lng,
      },
      title: store.name,
    }));
  }, [stores]);

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-full bg-muted rounded-lg">
        <p className="text-destructive">Error loading map</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full bg-muted rounded-lg">
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={mapCenter}
      zoom={userLocation ? 13 : 12}
      options={{
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
      }}
    >
      {/* User location marker */}
      {userLocation && (
        <Marker
          position={{ lat: userLocation.latitude, lng: userLocation.longitude }}
          title="Your Location"
          icon={{
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: "#22C55E",
            fillOpacity: 1,
            strokeColor: "#FFFFFF",
            strokeWeight: 2,
          }}
        />
      )}
      
      {/* Store markers */}
      {markers.map((marker) => (
        <Marker
          key={marker.id}
          position={marker.position}
          title={marker.title}
          onClick={() => onStoreSelect?.(marker.id)}
        />
      ))}
    </GoogleMap>
  );
}
