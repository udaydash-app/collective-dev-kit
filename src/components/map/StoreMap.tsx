import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon issue with Leaflet
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

export function StoreMap({ stores, userLocation, onStoreSelect }: StoreMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Initialize map
    const center = userLocation 
      ? [userLocation.latitude, userLocation.longitude] as [number, number]
      : defaultCenter;

    mapRef.current = L.map(mapContainerRef.current).setView(center, userLocation ? 13 : 12);

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(mapRef.current);

    // Add user location marker
    if (userLocation) {
      const userIcon = L.divIcon({
        className: 'custom-user-marker',
        html: '<div style="background-color: #22C55E; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      L.marker([userLocation.latitude, userLocation.longitude], { icon: userIcon })
        .bindPopup('Your Location')
        .addTo(mapRef.current);
    }

    // Add store markers
    stores.forEach((store) => {
      const position: [number, number] = [
        store.latitude || defaultCenter[0],
        store.longitude || defaultCenter[1],
      ];

      const marker = L.marker(position)
        .bindPopup(`
          <div style="font-size: 14px;">
            <h3 style="font-weight: 600; margin-bottom: 4px;">${store.name}</h3>
            <p style="color: #64748b; margin: 2px 0;">${store.address}</p>
            <p style="color: #64748b; margin: 2px 0;">${store.city}</p>
          </div>
        `)
        .addTo(mapRef.current!);

      if (onStoreSelect) {
        marker.on('click', () => onStoreSelect(store.id));
      }
    });

    // Cleanup
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [stores, userLocation, onStoreSelect]);

  return (
    <div 
      ref={mapContainerRef} 
      style={{ 
        width: '100%', 
        height: '100%', 
        borderRadius: '0.5rem',
        minHeight: '400px'
      }} 
    />
  );
}
