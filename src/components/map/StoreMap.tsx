import { useLoadScript, GoogleMap, Marker } from '@react-google-maps/api';
import { useMemo } from 'react';

interface Store {
  id: number;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

interface StoreMapProps {
  stores: Store[];
  onStoreSelect?: (storeId: number) => void;
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

export function StoreMap({ stores, onStoreSelect }: StoreMapProps) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: 'YOUR_GOOGLE_MAPS_API_KEY', // User needs to replace this
  });

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
      center={center}
      zoom={12}
      options={{
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
      }}
    >
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
