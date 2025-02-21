import type { PlaceDetails } from "@shared/schema";

export function calculateTravelTime(
  from: PlaceDetails,
  to: PlaceDetails
): number {
  // Simple mock implementation - calculate straight line distance
  // and assume average speed of 20km/h
  const R = 6371; // Earth's radius in km
  const lat1 = from.geometry.location.lat;
  const lon1 = from.geometry.location.lng;
  const lat2 = to.geometry.location.lat;
  const lon2 = to.geometry.location.lng;

  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;

  // Assume average speed of 20km/h
  const timeInHours = distance / 20;
  return Math.round(timeInHours * 60); // Convert to minutes
}
