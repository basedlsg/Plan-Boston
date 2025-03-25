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

// Helper to normalize location names - now preserves original names except for stations
export function normalizeLocationName(location: string): string {
  // Handle null, undefined, or empty string
  if (!location || typeof location !== 'string') return '';
  
  const trimmed = location.trim();
  if (trimmed === '') return '';
  
  // Only standardize station names, preserve all other location names
  const lowercased = trimmed.toLowerCase();

  // Check if it's a common tube station that needs "Station" appended
  const station = COMMON_STATIONS.find(s => 
    s.toLowerCase() === lowercased ||
    lowercased === `${s.toLowerCase()} station`
  );

  // Only normalize station names
  if (station) {
    return `${station} Station`;
  }
  
  // Otherwise, preserve the original name as entered by the user
  return trimmed;
}

// Helper to verify if a returned place matches the requested location
// Updated to be more lenient with neighborhood matching
export function verifyPlaceMatch(
  requestedLocation: string, 
  returnedName: string,
  types: string[]
): boolean {
  // Handle invalid inputs
  if (!requestedLocation || !returnedName) return false;
  if (!Array.isArray(types)) types = [];
  
  // Normalize inputs for comparison
  const normalized = requestedLocation.toLowerCase().trim();
  const returnedNormalized = returnedName.toLowerCase().trim();
  
  if (normalized === '' || returnedNormalized === '') return false;

  // Exact match
  if (normalized === returnedNormalized) {
    return true;
  }

  // Check if the returned place contains the normalized name or vice versa
  if (returnedNormalized.includes(normalized) || normalized.includes(returnedNormalized)) {
    return true;
  }
  
  // Split words and check for partial matches
  const requestWords = normalized.split(/\s+/).filter(word => word.length > 2);
  const returnedWords = returnedNormalized.split(/\s+/).filter(word => word.length > 2);
  
  // If the requested location has multiple meaningful words, check if most match
  if (requestWords.length > 1) {
    const matchingWords = requestWords.filter(word => 
      returnedWords.some(retWord => retWord.includes(word) || word.includes(retWord))
    );
    // If more than half the words match, consider it a match
    if (matchingWords.length >= Math.ceil(requestWords.length / 2)) {
      return true;
    }
  }

  // For areas and neighborhoods, be extra lenient
  const isArea = types.some(t => 
    t.includes('sublocality') || 
    t.includes('neighborhood') || 
    t.includes('political') ||
    t.includes('locality')
  );

  if (isArea) {
    // For neighborhoods, even a single word match can be considered valid
    // since Google may return full official names like "Mayfair, London, UK"
    for (const word of requestWords) {
      if (word.length > 3 && returnedNormalized.includes(word)) {
        return true;
      }
    }
    
    // Check if it's a known London area in our database
    const matchingArea = londonAreas.find(area => {
      const areaLower = area.name.toLowerCase();
      
      // Check the area name
      if (areaLower === normalized) return true;
      
      // Check area name contains or is contained by the normalized string
      if (areaLower.includes(normalized) || normalized.includes(areaLower)) {
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

  // Split the location into words for partial matching
  const requestWords = normalized.split(/\s+/).filter(word => word.length > 2);

  // Check areas, preserving original area names from our database
  for (const area of londonAreas) {
    const areaLower = area.name.toLowerCase();
    
    // Full or partial location matching
    if (areaLower.includes(normalized) || normalized.includes(areaLower)) {
      suggestions.add(area.name); // Use proper case from our data
    } else {
      // Try word-level matching for multi-word locations
      const matchingWords = requestWords.filter(word => 
        areaLower.includes(word) || word.includes(areaLower)
      );
      if (matchingWords.length > 0) {
        suggestions.add(area.name);
      }
    }

    // Check neighboring areas, maintaining their original names
    if (area.neighbors && Array.isArray(area.neighbors)) {
      for (const neighbor of area.neighbors) {
        if (typeof neighbor === 'string') {
          const neighborLower = neighbor.toLowerCase();
          if (neighborLower.includes(normalized) || normalized.includes(neighborLower)) {
            suggestions.add(neighbor); // Keep the original name
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
      
      const aScore = aLower === normalized ? 5 :
                    aLower.startsWith(normalized) ? 4 :
                    normalized.startsWith(aLower) ? 3 :
                    aLower.includes(normalized) ? 2 :
                    normalized.includes(aLower) ? 1 : 0;
                    
      const bScore = bLower === normalized ? 5 :
                    bLower.startsWith(normalized) ? 4 :
                    normalized.startsWith(bLower) ? 3 :
                    bLower.includes(normalized) ? 2 :
                    normalized.includes(bLower) ? 1 : 0;
                    
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