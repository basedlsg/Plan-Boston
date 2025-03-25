import type { PlaceDetails } from "@shared/schema";

/**
 * Calculate travel time between two places
 * 
 * @param from Starting location
 * @param to Destination location
 * @returns Travel time in minutes
 */
export function calculateTravelTime(
  from: PlaceDetails,
  to: PlaceDetails
): number {
  // Validate input parameters
  if (!from || !to) {
    console.warn("Missing 'from' or 'to' parameter in calculateTravelTime");
    return 30; // Default to 30 minutes
  }

  // Check for required geometry properties
  if (!from.geometry?.location || !to.geometry?.location) {
    console.warn("Missing geometry data in calculateTravelTime parameters");
    return 30; // Default to 30 minutes
  }

  // Check for required lat/lng properties
  const fromLat = from.geometry.location.lat;
  const fromLng = from.geometry.location.lng;
  const toLat = to.geometry.location.lat;
  const toLng = to.geometry.location.lng;

  if (typeof fromLat !== 'number' || typeof fromLng !== 'number' || 
      typeof toLat !== 'number' || typeof toLng !== 'number') {
    console.warn("Invalid coordinate values in calculateTravelTime:", 
      { fromLat, fromLng, toLat, toLng });
    return 30; // Default to 30 minutes
  }

  try {
    // Simple mock implementation - calculate straight line distance
    // and assume average speed of 20km/h
    const R = 6371; // Earth's radius in km
    
    const dLat = (toLat - fromLat) * Math.PI / 180;
    const dLon = (toLng - fromLng) * Math.PI / 180;

    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(fromLat * Math.PI / 180) * Math.cos(toLat * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    // Assume average speed of 20km/h
    const timeInHours = distance / 20;
    const minutes = Math.round(timeInHours * 60); // Convert to minutes
    
    // Add reasonable minimum and maximum constraints
    if (minutes < 5) return 5; // Minimum travel time of 5 minutes
    if (minutes > 120) return 120; // Cap at 2 hours
    
    return minutes;
  } catch (error) {
    console.error("Error calculating travel time:", error);
    return 30; // Default to 30 minutes in case of calculation error
  }
}
