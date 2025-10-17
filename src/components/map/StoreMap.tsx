import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon issue with Leaflet + Webpack/Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

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

// Abidjan, Côte d'Ivoire coordinates
const defaultCenter: [number, number] = [5.3600, -4.0083];

// Custom user location icon
const userIcon = L.divIcon({
  className: 'custom-user-marker',
  html: '<div style="background-color: #22C55E; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

export function StoreMap({ stores, userLocation, onStoreSelect }: StoreMapProps) {
  const mapCenter = useMemo((): [number, number] => {
    if (userLocation) {
      return [userLocation.latitude, userLocation.longitude];
    }
    return defaultCenter;
  }, [userLocation]);

  const storeMarkers = useMemo(() => {
    return stores.map((store) => ({
      id: store.id,
      position: [
        store.latitude || defaultCenter[0],
        store.longitude || defaultCenter[1],
      ] as [number, number],
      title: store.name,
      address: store.address,
      city: store.city,
    }));
  }, [stores]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <MapContainer
        center={mapCenter}
        zoom={userLocation ? 13 : 12}
        style={{ width: '100%', height: '100%', borderRadius: '0.5rem' }}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {/* User location marker */}
        {userLocation && (
          <Marker
            position={[userLocation.latitude, userLocation.longitude]}
            icon={userIcon}
          >
            <Popup>Your Location</Popup>
          </Marker>
        )}
        
        {/* Store markers */}
        {storeMarkers.map((marker) => (
          <Marker
            key={marker.id}
            position={marker.position}
            eventHandlers={{
              click: () => onStoreSelect?.(marker.id),
            }}
          >
            <Popup>
              <div className="text-sm">
                <h3 className="font-semibold">{marker.title}</h3>
                <p className="text-muted-foreground">{marker.address}</p>
                <p className="text-muted-foreground">{marker.city}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
