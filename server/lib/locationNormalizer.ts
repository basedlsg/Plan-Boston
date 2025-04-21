import { nycAreas, NYCArea } from "../data/new-york-areas";

// Dictionary of neighborhood name variations and colloquial references
// This helps match common ways people refer to neighborhoods
const NYC_NEIGHBORHOOD_VARIATIONS: Record<string, string[]> = {
  "Harlem": ["harlem", "uptown harlem", "upper harlem", "central harlem"],
  "East Harlem": ["spanish harlem", "el barrio", "east harlem"],
  "West Village": ["west village", "greenwich village west", "west village nyc"],
  "Greenwich Village": ["greenwich village", "the village", "village"],
  "SoHo": ["soho", "so ho", "south of houston"],
  "TriBeCa": ["tribeca", "tri beca", "triangle below canal"],
  "Financial District": ["fidi", "financial district", "wall street area"],
  "Upper East Side": ["ues", "upper east side", "east side"],
  "Upper West Side": ["uws", "upper west side", "west side"],
  "Williamsburg": ["williamsburg", "billyburg", "north brooklyn"],
  "Dumbo": ["dumbo", "down under manhattan bridge overpass"],
  "Times Square": ["times square", "times sq", "broadway district", "theater district"],
  "East Village": ["east village", "alphabet city", "lower east side north"],
  "Midtown": ["midtown", "midtown manhattan", "central manhattan"],
  "Chelsea": ["chelsea", "chelsea nyc", "west chelsea"],
  "Lower East Side": ["les", "lower east side", "lower manhattan east"],
  "Murray Hill": ["murray hill", "kips bay area", "midtown east"]
};

// Common NYC stations/subway stops that should always have "station" appended
const COMMON_STATIONS = [
  "Grand Central",
  "Penn Station",
  "Times Square",
  "Union Square",
  "World Trade Center",
  "Atlantic Terminal",
  "Columbus Circle",
  "Herald Square",
  "Bryant Park",
  "Fulton Street",
  "Canal Street",
  "Wall Street",
  "Chambers Street",
  "Jay Street",
  "Borough Hall",
  "Rockefeller Center",
  "14th Street",
  "Lexington Avenue",
  "34th Street"
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
  "art": "art_gallery",
  "entertainment": "movie_theater",
  "park": "park",
  "hotel": "lodging",
  "workout": "gym",
  "spa": "spa",
  "tourism": "tourist_attraction",
  "nightlife": "night_club",
  "dessert": "bakery",
  // Non-venue activities that shouldn't be sent to Google Places API
  "meeting": null,
  "arrive": null,
  "depart": null,
  "explore": null,
  "walk": null,
  "travel": null,
  "relax": null,
  "break": null,
  "rest": null,
  "visit": null
} as const;

type ActivityType = keyof typeof ACTIVITY_TYPE_MAPPINGS;
type Station = typeof COMMON_STATIONS[number];

// Common misspellings and variants of NYC locations
const SPELLING_CORRECTIONS: Record<string, string> = {
  'greenwhich': 'Greenwich',
  'greenwich village': 'Greenwich Village',
  'green village': 'Greenwich Village',
  'times sq': 'Times Square',
  'time square': 'Times Square',
  'timesquare': 'Times Square',
  'central pk': 'Central Park',
  'soho': 'SoHo',
  'williamsburg': 'Williamsburg',
  'dumbo': 'DUMBO',
  'down under manhattan bridge': 'DUMBO',
  'downtown brooklyn': 'Downtown Brooklyn',
  'upper east': 'Upper East Side',
  'upper west': 'Upper West Side',
  'west village': 'West Village',
  'east village': 'East Village',
  'financial district': 'Financial District',
  'fin district': 'Financial District',
  'fidi': 'Financial District',
  'midtown': 'Midtown',
  'mid town': 'Midtown',
  'china town': 'Chinatown',
  'chelsea': 'Chelsea',
  'gramercy': 'Gramercy',
  'gramercy park': 'Gramercy Park',
  'hells kitchen': 'Hell\'s Kitchen',
  'hell\'s kitchen': 'Hell\'s Kitchen',
  'tribeca': 'Tribeca',
  'little italy': 'Little Italy',
  'nolita': 'NoLita',
  'noho': 'NoHo',
  'flatbush': 'Flatbush',
  'brooklyn heights': 'Brooklyn Heights',
  'park slope': 'Park Slope',
  'grand central': 'Grand Central Station',
  'penn sta': 'Penn Station'
};

// Helper to normalize location names with improved spelling corrections
export function normalizeLocationName(location: string): string {
  // Handle null, undefined, or empty string
  if (!location || typeof location !== 'string') return '';
  
  const trimmed = location.trim();
  if (trimmed === '') return '';
  
  const lowercased = trimmed.toLowerCase();
  
  // Check for colloquial neighborhood names first
  for (const [canonicalName, variations] of Object.entries(NYC_NEIGHBORHOOD_VARIATIONS)) {
    if (variations.includes(lowercased)) {
      console.log(`Matched colloquial name: "${location}" -> "${canonicalName}"`);
      return canonicalName;
    }
  }
  
  // Check for common spelling corrections
  for (const [misspelled, correct] of Object.entries(SPELLING_CORRECTIONS)) {
    if (lowercased === misspelled) {
      return correct;
    }
  }
  
  // Handle hyphenated location names (e.g., "Covent-Garden" → "Covent Garden")
  if (trimmed.includes('-')) {
    const dehyphenated = trimmed.replace(/-/g, ' ');
    // Check if the dehyphenated version has a correction
    const dehyphenatedLower = dehyphenated.toLowerCase();
    for (const [misspelled, correct] of Object.entries(SPELLING_CORRECTIONS)) {
      if (dehyphenatedLower === misspelled) {
        return correct;
      }
    }
    
    // If no correction found, properly capitalize the dehyphenated version
    return dehyphenated.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  // Check if it's a common tube station that needs "Station" appended
  const station = COMMON_STATIONS.find(s => 
    s.toLowerCase() === lowercased ||
    lowercased === `${s.toLowerCase()} station`
  );

  // Normalize station names
  if (station) {
    return `${station} Station`;
  }
  
  // For other locations, apply proper capitalization
  // Convert to title case (first letter of each word capitalized)
  return trimmed.split(' ')
    .map(word => {
      // Special case for King's Cross and similar possessives
      if (word.toLowerCase() === 'kings') return 'King\'s';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
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
  
  // Check if this is a known neighborhood variation
  for (const [canonicalName, variations] of Object.entries(NYC_NEIGHBORHOOD_VARIATIONS)) {
    // If the requested location is a variation of this canonical neighborhood name
    if (variations.includes(normalized)) {
      // Check if the returned name matches or contains the canonical form
      if (returnedNormalized.includes(canonicalName.toLowerCase())) {
        console.log(`Matched variation "${normalized}" to canonical "${canonicalName}"`);
        return true;
      }
    }
    
    // If the returned location contains any of the variations
    if (variations.some(variation => returnedNormalized.includes(variation))) {
      console.log(`Matched returned location "${returnedNormalized}" to a variation of "${canonicalName}"`);
      return true;
    }
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
    
    // Check if it's a known NYC area in our database
    const matchingArea = nycAreas.find((area: NYCArea) => {
      const areaLower = area.name.toLowerCase();
      
      // Check the area name
      if (areaLower === normalized) return true;
      
      // Check area name contains or is contained by the normalized string
      if (areaLower.includes(normalized) || normalized.includes(areaLower)) {
        return true;
      }
      
      // Check the neighboring areas if available
      if (area.neighbors && Array.isArray(area.neighbors)) {
        return area.neighbors.some((n: string) => {
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
    return ['Times Square', 'SoHo', 'Central Park']; // Default popular areas
  }
  
  const normalized = location.toLowerCase().trim();
  const suggestions = new Set<string>();

  // First check if this is a neighborhood variation
  for (const [canonicalName, variations] of Object.entries(NYC_NEIGHBORHOOD_VARIATIONS)) {
    // If the requested location is similar to any of the variations
    if (variations.some(variation => 
      variation.includes(normalized) || normalized.includes(variation)
    )) {
      suggestions.add(canonicalName);
      
      // If we have a direct match, also suggest the neighboring areas
      if (variations.includes(normalized)) {
        const matchingArea = nycAreas.find(area => area.name === canonicalName);
        if (matchingArea && matchingArea.neighbors) {
          // Add a few neighboring areas as suggestions
          matchingArea.neighbors.slice(0, 2).forEach(neighbor => {
            suggestions.add(neighbor);
          });
        }
      }
    }
  }
  
  // Then check stations
  for (const station of COMMON_STATIONS) {
    const stationLower = station.toLowerCase();
    if (stationLower.includes(normalized) || normalized.includes(stationLower)) {
      suggestions.add(`${station} Station`);
    }
  }

  // Split the location into words for partial matching
  const requestWords = normalized.split(/\s+/).filter(word => word.length > 2);

  // Check areas, preserving original area names from our database
  for (const area of nycAreas) {
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
    return ['Times Square', 'SoHo', 'Greenwich Village'];
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
export function mapActivityToPlaceType(activity: string): string | null | undefined {
  if (!activity) return undefined;
  
  const normalized = activity.toLowerCase().trim();
  
  // Check if the normalized string is a valid key in our mapping
  const isValidActivityType = Object.keys(ACTIVITY_TYPE_MAPPINGS).includes(normalized);
  
  if (isValidActivityType) {
    // The value might be null for non-venue activities
    const mappedValue = ACTIVITY_TYPE_MAPPINGS[normalized as ActivityType];
    return mappedValue; // This might be null for non-venue activities
  }
  
  // Try to find partial matches
  for (const [key, value] of Object.entries(ACTIVITY_TYPE_MAPPINGS)) {
    if ((normalized.includes(key) || key.includes(normalized)) && value !== null) {
      return value;
    }
  }
  
  // Default to restaurant for food-related terms
  if (normalized.includes('food') || normalized.includes('eat')) {
    return 'restaurant';
  }
  
  return undefined;
}