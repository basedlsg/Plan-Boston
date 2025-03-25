import { londonAreas, LondonArea } from "../data/london-areas";

// Common London stations that should always have "station" appended
const COMMON_STATIONS = [
  "Bank",
  "Embankment",
  "Liverpool Street",
  "Charing Cross",
  "Victoria",
  "Waterloo",
  "London Bridge"
] as const;

// Common activity mappings to Google Places API types
export const ACTIVITY_TYPE_MAPPINGS = {
  "lunch": "restaurant",
  "dinner": "restaurant",
  "breakfast": "restaurant",
  "coffee": "cafe",
  "drinks": "bar",
  "shopping": "shopping_mall",
  "culture": "museum",
  "art": "art_gallery"
} as const;

type ActivityType = keyof typeof ACTIVITY_TYPE_MAPPINGS;
type Station = typeof COMMON_STATIONS[number];

// Helper to normalize location names
export function normalizeLocationName(location: string): string {
  // Handle null, undefined, or empty string
  if (!location || typeof location !== 'string') return '';
  
  const trimmed = location.trim();
  if (trimmed === '') return '';
  
  const lowercased = trimmed.toLowerCase();

  // Add "station" if it's a common tube station
  const station = COMMON_STATIONS.find(s => 
    s.toLowerCase() === lowercased ||
    lowercased === `${s.toLowerCase()} station`
  );

  if (station) {
    return `${station} Station`;
  }
  
  // Check if it's a known London area for exact match
  const exactAreaMatch = londonAreas.find(area => 
    area.name.toLowerCase() === lowercased
  );
  
  if (exactAreaMatch) {
    return exactAreaMatch.name; // Return with proper casing from our data
  }

  // For multi-word locations, capitalize each word
  if (trimmed.includes(' ')) {
    return trimmed.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  
  // Return with proper capitalization for single words
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

// Helper to verify if a returned place matches the requested location
export function verifyPlaceMatch(
  requestedLocation: string, 
  returnedName: string,
  types: string[]
): boolean {
  // Handle invalid inputs
  if (!requestedLocation || !returnedName) return false;
  if (!Array.isArray(types)) types = [];
  
  // Normalize inputs
  const normalized = requestedLocation.toLowerCase().trim();
  const returnedNormalized = returnedName.toLowerCase();
  
  if (normalized === '' || returnedNormalized === '') return false;

  // Exact match
  if (normalized === returnedNormalized) {
    return true;
  }

  // Check if the returned place contains the normalized name
  if (returnedNormalized.includes(normalized)) {
    return true;
  }
  
  // Check if the normalized name contains the returned place
  if (normalized.includes(returnedNormalized)) {
    return true;
  }

  // For areas and neighborhoods, be more lenient
  const isArea = types.some(t => 
    t.includes('sublocality') || 
    t.includes('neighborhood') || 
    t.includes('political')
  );

  if (isArea) {
    // Check if it's a known London area
    const matchingArea = londonAreas.find(area => {
      // Check the area name
      if (area.name.toLowerCase() === normalized) return true;
      
      // Check area name contains or is contained by the normalized string
      if (area.name.toLowerCase().includes(normalized) || 
          normalized.includes(area.name.toLowerCase())) {
        return true;
      }
      
      // Check the neighboring areas if available
      if (area.neighbors && Array.isArray(area.neighbors)) {
        return area.neighbors.some(n => {
          if (typeof n !== 'string') return false;
          const nLower = n.toLowerCase();
          return nLower === normalized || 
                 nLower.includes(normalized) || 
                 normalized.includes(nLower);
        });
      }
      
      return false;
    });

    if (matchingArea) {
      return true;
    }
  }
  
  // For stations, check if the returned name includes "station" and matches one of our known stations
  if (returnedNormalized.includes('station')) {
    for (const station of COMMON_STATIONS) {
      const stationLower = station.toLowerCase();
      if (returnedNormalized.includes(stationLower) || normalized.includes(stationLower)) {
        return true;
      }
    }
  }

  return false;
}

// Helper to suggest similar locations when a match isn't found
export function suggestSimilarLocations(location: string): string[] {
  // Handle null, undefined, or empty string
  if (!location || typeof location !== 'string' || location.trim() === '') {
    return ['Covent Garden', 'Soho', 'Camden']; // Default popular areas
  }
  
  const normalized = location.toLowerCase().trim();
  const suggestions = new Set<string>();

  // First check stations
  for (const station of COMMON_STATIONS) {
    const stationLower = station.toLowerCase();
    if (stationLower.includes(normalized) || normalized.includes(stationLower)) {
      suggestions.add(`${station} Station`);
    }
  }

  // Then check areas
  for (const area of londonAreas) {
    const areaLower = area.name.toLowerCase();
    if (areaLower.includes(normalized) || normalized.includes(areaLower)) {
      suggestions.add(area.name);
    }

    // Check neighboring areas if available
    if (area.neighbors && Array.isArray(area.neighbors)) {
      for (const neighbor of area.neighbors) {
        if (typeof neighbor === 'string') {
          const neighborLower = neighbor.toLowerCase();
          if (neighborLower.includes(normalized) || normalized.includes(neighborLower)) {
            suggestions.add(neighbor);
          }
        }
      }
    }
  }
  
  // If we didn't find any matches, return popular areas
  if (suggestions.size === 0) {
    return ['Covent Garden', 'Soho', 'Camden'];
  }

  // Convert to array and sort by relevance
  return Array.from(suggestions)
    .sort((a, b) => {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      
      const aScore = aLower === normalized ? 3 :
                    aLower.startsWith(normalized) ? 2 :
                    aLower.includes(normalized) ? 1 : 0;
                    
      const bScore = bLower === normalized ? 3 :
                    bLower.startsWith(normalized) ? 2 :
                    bLower.includes(normalized) ? 1 : 0;
                    
      return bScore - aScore;
    })
    .slice(0, 3); // Return up to 3 suggestions
}

// Convert activity types to Google Places API types
export function mapActivityToPlaceType(activity: string): string | undefined {
  if (!activity) return undefined;
  
  const normalized = activity.toLowerCase().trim();
  
  // Check if the normalized string is a valid key in our mapping
  const isValidActivityType = Object.keys(ACTIVITY_TYPE_MAPPINGS).includes(normalized);
  
  if (isValidActivityType) {
    return ACTIVITY_TYPE_MAPPINGS[normalized as ActivityType];
  }
  
  // Try to find partial matches
  for (const [key, value] of Object.entries(ACTIVITY_TYPE_MAPPINGS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }
  
  // Default to restaurant for food-related terms
  if (normalized.includes('food') || normalized.includes('eat')) {
    return 'restaurant';
  }
  
  return undefined;
}