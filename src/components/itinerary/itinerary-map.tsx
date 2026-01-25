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

export function ItineraryMap({ activities, destination }: ItineraryMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const initMap = async () => {
      // Check if ref exists first
      if (!mapRef.current) {
        console.warn('Map ref not ready yet');
        return;
      }

      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        setError('Google Maps API key not configured');
        setIsLoading(false);
        return;
      }

      try {
        // Load Google Maps script
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

        // Double-check ref still exists after async operations
        if (!mapRef.current) {
          console.warn('Map ref lost during initialization');
          return;
        }

        // Create map centered on destination
        const geocoder = new google.maps.Geocoder();
        const result = await geocoder.geocode({ address: destination });
        
        if (!result.results[0]) {
          throw new Error('Could not find destination');
        }

        const center = result.results[0].geometry.location;

        // Final check before creating map
        if (!mapRef.current) {
          console.warn('Map ref lost before map creation');
          return;
        }

        const newMap = new google.maps.Map(mapRef.current, {
          center,
          zoom: 13,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }],
            },
          ],
        });

        setMap(newMap);

        // Add markers for activities with locations
        const bounds = new google.maps.LatLngBounds();
        const markers: google.maps.Marker[] = [];
        const markerPositions: { lat: number; lng: number }[] = [];

        // Helper function to check if position is too close to existing markers
        const adjustPositionIfOverlapping = (position: google.maps.LatLng): google.maps.LatLng => {
          const lat = position.lat();
          const lng = position.lng();
          const minDistance = 0.0001; // Approximately 11 meters
          
          for (const existingPos of markerPositions) {
            const distance = Math.sqrt(
              Math.pow(lat - existingPos.lat, 2) + Math.pow(lng - existingPos.lng, 2)
            );
            
            if (distance < minDistance) {
              // Offset the marker in a circular pattern
              const angle = markerPositions.length * (Math.PI / 4); // 45 degrees per marker
              const offsetLat = lat + (minDistance * Math.cos(angle));
              const offsetLng = lng + (minDistance * Math.sin(angle));
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
              // Try with location name first, then fall back to title + destination
              const searchQuery = activity.locationName 
                ? `${activity.locationName}, ${destination}`
                : `${activity.title}, ${destination}`;
              
              const result = await geocoder.geocode({ address: searchQuery });
              if (result.results[0]) {
                position = result.results[0].geometry.location;
              }
            } catch (err) {
              console.error(`Failed to geocode ${activity.locationName || activity.title}:`, err);
            }
          }

          if (position) {
            // Adjust position if it overlaps with existing markers
            const adjustedPosition = adjustPositionIfOverlapping(position);
            markerPositions.push({ lat: adjustedPosition.lat(), lng: adjustedPosition.lng() });

            const marker = new google.maps.Marker({
              position: adjustedPosition,
              map: newMap,
              title: activity.title,
              label: {
                text: (i + 1).toString(),
                color: 'white',
                fontWeight: 'bold',
              },
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 20,
                fillColor: '#3b82f6',
                fillOpacity: 1,
                strokeColor: '#1e40af',
                strokeWeight: 2,
              },
            });

            // Create navigation link
            const lat = adjustedPosition.lat();
            const lng = adjustedPosition.lng();
            const navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

            const infoWindow = new google.maps.InfoWindow({
              content: `<div style="padding: 8px; min-width: 200px;">
                <h3 style="font-weight: bold; margin-bottom: 4px; font-size: 14px;">${activity.title}</h3>
                ${activity.locationName ? `<p style="color: #666; font-size: 12px; margin-bottom: 8px;">${activity.locationName}</p>` : ''}
                <a 
                  href="${navigationUrl}" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style="display: inline-block; background: #3b82f6; color: white; padding: 6px 12px; text-decoration: none; border-radius: 4px; font-size: 12px; font-weight: 500;"
                >
                  🧭 Navigate Here
                </a>
              </div>`,
            });

            marker.addListener('click', () => {
              infoWindow.open(newMap, marker);
            });

            markers.push(marker);
            bounds.extend(adjustedPosition);
          }
        }

        // Draw route between markers
        if (markers.length > 1) {
          const directionsService = new google.maps.DirectionsService();
          const directionsRenderer = new google.maps.DirectionsRenderer({
            map: newMap,
            suppressMarkers: true,
            polylineOptions: {
              strokeColor: '#3b82f6',
              strokeWeight: 3,
              strokeOpacity: 0.7,
            },
          });

          // Google Maps Directions API has a limit of 25 waypoints
          // If we have too many, just draw lines between consecutive points
          const maxWaypoints = 23; // Leave room for origin and destination
          const waypoints = markers.slice(1, -1).map(marker => ({
            location: marker.getPosition()!,
            stopover: true,
          }));

          try {
            if (waypoints.length <= maxWaypoints) {
              // Try to get directions with all waypoints
              const result = await directionsService.route({
                origin: markers[0].getPosition()!,
                destination: markers[markers.length - 1].getPosition()!,
                waypoints,
                travelMode: google.maps.TravelMode.WALKING,
                optimizeWaypoints: false, // Keep the order as planned
              });

              directionsRenderer.setDirections(result);
            } else {
              // Too many waypoints - draw simple polylines instead
              console.warn(`Too many waypoints (${waypoints.length}), drawing simple lines`);
              const path = markers.map(marker => marker.getPosition()!);
              
              new google.maps.Polyline({
                path,
                geodesic: true,
                strokeColor: '#3b82f6',
                strokeOpacity: 0.7,
                strokeWeight: 3,
                map: newMap,
              });
            }
          } catch (err: any) {
            console.error('Failed to calculate route:', err);
            
            // Fallback: Draw simple polylines between consecutive markers
            // This happens when no walking route exists (e.g., across water, restricted areas)
            if (err?.code === 'ZERO_RESULTS' || err?.message?.includes('ZERO_RESULTS')) {
              console.warn('No route found, drawing straight lines between points');
              
              const path = markers.map(marker => marker.getPosition()!);
              
              new google.maps.Polyline({
                path,
                geodesic: true,
                strokeColor: '#94a3b8', // Gray color to indicate it's not a real route
                strokeOpacity: 0.5,
                strokeWeight: 2,
                strokeStyle: 'dashed',
                map: newMap,
              });
            }
          }
        }

        // Fit map to show all markers
        if (markers.length > 0) {
          newMap.fitBounds(bounds);
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Map initialization error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load map');
        setIsLoading(false);
      }
    };

    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      initMap();
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      // Cleanup map instance
      if (map) {
        google.maps.event.clearInstanceListeners(map);
      }
    };
  }, [activities, destination]);

  if (error) {
    return (
      <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 text-center">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[500px] rounded-lg overflow-hidden border-2 border-foreground">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-gray-600">Loading map...</p>
          </div>
        </div>
      )}
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}
