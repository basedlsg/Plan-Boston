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
  if (!location) return '';
  const lowercased = location.toLowerCase().trim();

  // Add "station" if it's a common tube station
  const station = COMMON_STATIONS.find(s => 
    s.toLowerCase() === lowercased ||
    lowercased === `${s.toLowerCase()} station`
  );

  if (station) {
    return `${station} Station`;
  }

  // Return with proper capitalization
  return location.charAt(0).toUpperCase() + location.slice(1);
}

// Helper to verify if a returned place matches the requested location
export function verifyPlaceMatch(
  requestedLocation: string, 
  returnedName: string,
  types: string[]
): boolean {
  const normalized = requestedLocation.toLowerCase().trim();
  const returnedNormalized = returnedName.toLowerCase();

  // Exact match
  if (normalized === returnedNormalized) {
    return true;
  }

  // Check if the returned place contains the normalized name
  if (returnedNormalized.includes(normalized)) {
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
    const matchingArea = londonAreas.find(area => 
      area.name.toLowerCase() === normalized ||
      area.neighbors.some(n => n.toLowerCase() === normalized)
    );

    if (matchingArea) {
      return true;
    }
  }

  return false;
}

// Helper to suggest similar locations when a match isn't found
export function suggestSimilarLocations(location: string): string[] {
  const normalized = location.toLowerCase();
  const suggestions = new Set<string>();

  // First check stations
  for (const station of COMMON_STATIONS) {
    if (station.toLowerCase().includes(normalized) || 
        normalized.includes(station.toLowerCase())) {
      suggestions.add(`${station} Station`);
    }
  }

  // Then check areas
  for (const area of londonAreas) {
    if (area.name.toLowerCase().includes(normalized) || 
        normalized.includes(area.name.toLowerCase())) {
      suggestions.add(area.name);
    }

    // Check neighboring areas
    for (const neighbor of area.neighbors) {
      if (neighbor.toLowerCase().includes(normalized) || 
          normalized.includes(neighbor.toLowerCase())) {
        suggestions.add(neighbor);
      }
    }
  }

  // Convert to array and sort by relevance
  return Array.from(suggestions)
    .sort((a, b) => {
      const aScore = a.toLowerCase() === normalized ? 2 :
                    a.toLowerCase().includes(normalized) ? 1 : 0;
      const bScore = b.toLowerCase() === normalized ? 2 :
                    b.toLowerCase().includes(normalized) ? 1 : 0;
      return bScore - aScore;
    })
    .slice(0, 3); // Return up to 3 suggestions
}

// Convert activity types to Google Places API types
export function mapActivityToPlaceType(activity: string): string | undefined {
  const normalized = activity.toLowerCase().trim() as ActivityType;
  return ACTIVITY_TYPE_MAPPINGS[normalized];
}