'use client';

import { useEffect, useRef, useState } from 'react';

interface Activity {
  id: string;
  title: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
}

interface ItineraryMapProps {
  activities: Activity[];
  destination: string;
}

// Light, travel-journal map styling to match the daytime sky palette.
const MAP_LIGHT_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#f4f8fd' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5a6a85' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#0b1e3c' }],
  },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#dff1e3' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#e3ecf7' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#8a97af' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#e8eef7' }],
  },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#bcd6f5' }] },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#4a6b95' }],
  },
];

export function ItineraryMap({ activities, destination }: ItineraryMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const initMap = async () => {
      if (!mapRef.current) return;

      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        setError('Google Maps API key not configured');
        setIsLoading(false);
        return;
      }

      try {
        if (!window.google) {
          const script = document.createElement('script');
          script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
          script.async = true;
          script.defer = true;

          await new Promise<void>((resolve, reject) => {
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Google Maps'));
            document.head.appendChild(script);
          });
        }

        if (!mapRef.current) return;

        const geocoder = new google.maps.Geocoder();
        const result = await geocoder.geocode({ address: destination });
        if (!result.results[0]) throw new Error('Could not find destination');

        const center = result.results[0].geometry.location;
        if (!mapRef.current) return;

        const newMap = new google.maps.Map(mapRef.current, {
          center,
          zoom: 13,
          styles: MAP_LIGHT_STYLES,
          disableDefaultUI: false,
          backgroundColor: '#f4f8fd',
        });

        setMap(newMap);

        const bounds = new google.maps.LatLngBounds();
        const markers: google.maps.Marker[] = [];
        const markerPositions: { lat: number; lng: number }[] = [];

        const adjustPositionIfOverlapping = (
          position: google.maps.LatLng
        ): google.maps.LatLng => {
          const lat = position.lat();
          const lng = position.lng();
          const minDistance = 0.0001;

          for (const existingPos of markerPositions) {
            const distance = Math.sqrt(
              Math.pow(lat - existingPos.lat, 2) + Math.pow(lng - existingPos.lng, 2)
            );
            if (distance < minDistance) {
              const angle = markerPositions.length * (Math.PI / 4);
              const offsetLat = lat + minDistance * Math.cos(angle);
              const offsetLng = lng + minDistance * Math.sin(angle);
              return new google.maps.LatLng(offsetLat, offsetLng);
            }
          }
          return position;
        };

        for (let i = 0; i < activities.length; i++) {
          const activity = activities[i];
          let position: google.maps.LatLng | null = null;

          if (activity.latitude && activity.longitude) {
            position = new google.maps.LatLng(activity.latitude, activity.longitude);
          } else if (activity.locationName || activity.title) {
            try {
              const searchQuery = activity.locationName
                ? `${activity.locationName}, ${destination}`
                : `${activity.title}, ${destination}`;
              const result = await geocoder.geocode({ address: searchQuery });
              if (result.results[0]) position = result.results[0].geometry.location;
            } catch (err) {
              console.error(
                `Failed to geocode ${activity.locationName || activity.title}:`,
                err
              );
            }
          }

          if (position) {
            const adjustedPosition = adjustPositionIfOverlapping(position);
            markerPositions.push({
              lat: adjustedPosition.lat(),
              lng: adjustedPosition.lng(),
            });

            const marker = new google.maps.Marker({
              position: adjustedPosition,
              map: newMap,
              title: activity.title,
              label: {
                text: (i + 1).toString(),
                color: '#ffffff',
                fontWeight: '700',
                fontSize: '12px',
              },
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 14,
                fillColor: '#0b1e3c',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
              },
            });

            const lat = adjustedPosition.lat();
            const lng = adjustedPosition.lng();
            const navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

            const infoWindow = new google.maps.InfoWindow({
              content: `<div style="padding:6px 8px; min-width:200px; font-family:Inter, sans-serif;">
                <div style="font-weight:600; margin-bottom:4px; font-size:14px; color:#0b1e3c;">${activity.title}</div>
                ${activity.locationName ? `<div style="color:#5a6a85; font-size:12px; margin-bottom:8px;">${activity.locationName}</div>` : ''}
                <a href="${navigationUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block; background:#0b1e3c; color:white; padding:6px 12px; text-decoration:none; border-radius:999px; font-size:12px; font-weight:500;">Navigate</a>
              </div>`,
            });

            marker.addListener('click', () => infoWindow.open(newMap, marker));

            markers.push(marker);
            bounds.extend(adjustedPosition);
          }
        }

        if (markers.length > 1) {
          const directionsService = new google.maps.DirectionsService();
          const directionsRenderer = new google.maps.DirectionsRenderer({
            map: newMap,
            suppressMarkers: true,
            polylineOptions: {
              strokeColor: '#0b1e3c',
              strokeWeight: 3,
              strokeOpacity: 0.6,
            },
          });

          const maxWaypoints = 23;
          const waypoints = markers.slice(1, -1).map((marker) => ({
            location: marker.getPosition()!,
            stopover: true,
          }));

          try {
            if (waypoints.length <= maxWaypoints) {
              const result = await directionsService.route({
                origin: markers[0].getPosition()!,
                destination: markers[markers.length - 1].getPosition()!,
                waypoints,
                travelMode: google.maps.TravelMode.WALKING,
                optimizeWaypoints: false,
              });
              directionsRenderer.setDirections(result);
            } else {
              const path = markers.map((marker) => marker.getPosition()!);
              new google.maps.Polyline({
                path,
                geodesic: true,
                strokeColor: '#0b1e3c',
                strokeOpacity: 0.55,
                strokeWeight: 3,
                map: newMap,
              });
            }
          } catch (err: unknown) {
            const e = err as { code?: string; message?: string };
            if (e?.code === 'ZERO_RESULTS' || e?.message?.includes('ZERO_RESULTS')) {
              const path = markers.map((marker) => marker.getPosition()!);
              new google.maps.Polyline({
                path,
                geodesic: true,
                strokeColor: '#0b1e3c',
                strokeOpacity: 0.35,
                strokeWeight: 2,
                icons: [
                  {
                    icon: {
                      path: 'M 0,-1 0,1',
                      strokeOpacity: 1,
                      scale: 2,
                    },
                    offset: '0',
                    repeat: '10px',
                  },
                ],
                map: newMap,
              });
            }
          }
        }

        if (markers.length > 0) newMap.fitBounds(bounds);
        setIsLoading(false);
      } catch (err) {
        console.error('Map initialization error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load map');
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(initMap, 100);
    return () => {
      clearTimeout(timeoutId);
      if (map) google.maps.event.clearInstanceListeners(map);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, destination]);

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-center">
        <p className="text-sm text-rose-800">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative h-[480px] w-full overflow-hidden rounded-2xl border border-[color:var(--border)]">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-sm">
          <div className="text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-[color:var(--border)] border-t-[color:var(--accent)]" />
            <p className="mt-3 text-sm text-[color:var(--ink-muted)]">Loading map</p>
          </div>
        </div>
      )}
      <div ref={mapRef} className="h-full w-full" />
    </div>
  );
}
