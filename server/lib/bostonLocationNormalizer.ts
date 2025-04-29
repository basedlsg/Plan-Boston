import { bostonAreas, BostonArea } from "../data/boston-areas";

// Dictionary of neighborhood name variations and colloquial references
// This helps match common ways people refer to neighborhoods
const BOSTON_NEIGHBORHOOD_VARIATIONS: Record<string, string[]> = {
  "Back Bay": ["back bay", "backbay", "newbury street area", "copley square area"],
  "Beacon Hill": ["beacon hill", "beaconhill", "the hill", "state house area"],
  "North End": ["north end", "little italy", "italian district", "boston's little italy"],
  "Fenway": ["fenway", "fenway park area", "kenmore", "kenmore square"],
  "Seaport": ["seaport district", "seaport", "innovation district", "south boston waterfront"],
  "Downtown": ["downtown", "downtown crossing", "financial district", "government center"],
  "South End": ["south end", "southend", "tremont street area"],
  "Cambridge": ["cambridge", "harvard square", "central square", "kendall square", "harvard", "mit area"],
  "Somerville": ["somerville", "davis square", "union square", "assembly row"],
  "Charlestown": ["charlestown", "navy yard", "bunker hill area"],
  "Jamaica Plain": ["jamaica plain", "jp", "jamaica pond area"],
  "Allston/Brighton": ["allston", "brighton", "allston-brighton", "student area"],
  "Chinatown": ["chinatown", "chinese district", "theater district", "leather district"],
  "Dorchester": ["dorchester", "dot", "uphams corner", "fields corner"],
  "Financial District": ["financial district", "fidi", "post office square", "downtown financial"]
};

// Common Boston stations/subway stops that should always have "Station" appended
const COMMON_STATIONS = [
  "South Station",
  "North Station",
  "Park Street",
  "Downtown Crossing",
  "Government Center",
  "Harvard Square",
  "Kendall/MIT",
  "Copley",
  "Back Bay",
  "JFK/UMass",
  "Hynes Convention Center",
  "Forest Hills",
  "Maverick",
  "Alewife",
  "Porter",
  "Quincy Center"
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

// Common misspellings and variants of Boston locations
const SPELLING_CORRECTIONS: Record<string, string> = {
  'backbay': 'Back Bay',
  'beaconhill': 'Beacon Hill',
  'northend': 'North End',
  'southend': 'South End',
  'harvard sq': 'Harvard Square',
  'kendall': 'Kendall Square',
  'govt center': 'Government Center',
  'faneuil': 'Faneuil Hall',
  'faneuil hall': 'Faneuil Hall',
  'quincy mkt': 'Quincy Market',
  'quincy market': 'Quincy Market',
  'fenway': 'Fenway',
  'seaport': 'Seaport',
  'downtown': 'Downtown',
  'cambridge': 'Cambridge',
  'somerville': 'Somerville',
  'charlestown': 'Charlestown',
  'jamaica plain': 'Jamaica Plain',
  'allston': 'Allston/Brighton',
  'brighton': 'Allston/Brighton',
  'chinatown': 'Chinatown',
  'dorchester': 'Dorchester',
  'fin district': 'Financial District',
  'fidi': 'Financial District',
  'south station': 'South Station',
  'north station': 'North Station',
  'newbury st': 'Newbury Street',
  'boylston st': 'Boylston Street',
  'tremont st': 'Tremont Street',
  'boston common': 'Boston Common',
  'public garden': 'Public Garden',
  'freedom trail': 'Freedom Trail'
};

// Helper to normalize location names with improved spelling corrections
export function normalizeLocationName(location: string): string {
  // Handle null, undefined, or empty string
  if (!location || typeof location !== 'string') return '';
  
  const trimmed = location.trim();
  if (trimmed === '') return '';
  
  const lowercased = trimmed.toLowerCase();
  
  // Check for colloquial neighborhood names first
  for (const [canonicalName, variations] of Object.entries(BOSTON_NEIGHBORHOOD_VARIATIONS)) {
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
  
  // Handle hyphenated location names (e.g., "Allston-Brighton" → "Allston/Brighton")
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

  // Check if it's a common T station that needs "Station" appended
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
  for (const [canonicalName, variations] of Object.entries(BOSTON_NEIGHBORHOOD_VARIATIONS)) {
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
    // For area-type results, just one word match can be sufficient
    if (requestWords.length > 0 && returnedWords.length > 0) {
      const anyWordMatch = requestWords.some(word => 
        returnedWords.some(retWord => retWord.includes(word) || word.includes(retWord))
      );
      if (anyWordMatch) {
        return true;
      }
    }
  }
  
  return false;
}

// Suggest similar locations when a location isn't found
export function suggestSimilarLocations(location: string): string[] {
  if (!location) return [];
  
  const normalized = location.toLowerCase().trim();
  const suggestions: string[] = [];
  
  // Check for partial matches in neighborhood variations
  for (const [canonicalName, variations] of Object.entries(BOSTON_NEIGHBORHOOD_VARIATIONS)) {
    if (variations.some(v => v.includes(normalized) || normalized.includes(v))) {
      suggestions.push(canonicalName);
    }
  }
  
  // Check Boston areas for partial matches in name
  for (const area of bostonAreas) {
    if (area.name.toLowerCase().includes(normalized) || 
        normalized.includes(area.name.toLowerCase())) {
      if (!suggestions.includes(area.name)) {
        suggestions.push(area.name);
      }
    }
  }
  
  // Check for keywords in area characteristics
  const words = normalized.split(/\s+/).filter(w => w.length > 3);
  if (words.length > 0) {
    for (const area of bostonAreas) {
      for (const word of words) {
        if (area.characteristics.some(c => c.toLowerCase().includes(word)) || 
            area.popularFor.some(p => p.toLowerCase().includes(word))) {
          if (!suggestions.includes(area.name)) {
            suggestions.push(area.name);
          }
          break;
        }
      }
    }
  }
  
  // Limit to 5 suggestions
  return suggestions.slice(0, 5);
}

// Map activity descriptions to Google Places API types
export function mapActivityToPlaceType(activity: string): string | null | undefined {
  if (!activity) return null;
  
  const lowered = activity.toLowerCase();
  
  // Direct type mapping
  for (const [key, value] of Object.entries(ACTIVITY_TYPE_MAPPINGS)) {
    if (lowered.includes(key)) {
      return value;
    }
  }
  
  // More nuanced mappings
  if (lowered.includes("brunch")) return "restaurant";
  if (lowered.includes("diner")) return "restaurant";
  if (lowered.includes("pub")) return "bar";
  if (lowered.includes("brewery")) return "bar";
  if (lowered.includes("bistro")) return "restaurant";
  if (lowered.includes("gallery")) return "art_gallery";
  if (lowered.includes("concert")) return "night_club";
  if (lowered.includes("show")) return "performing_arts_theater";
  if (lowered.includes("monument")) return "tourist_attraction";
  if (lowered.includes("landmark")) return "tourist_attraction";
  if (lowered.includes("historic")) return "tourist_attraction";
  if (lowered.includes("garden")) return "park";
  if (lowered.includes("ice cream")) return "cafe";
  if (lowered.includes("dessert")) return "bakery";
  
  // Boston-specific mappings
  if (lowered.includes("freedom trail")) return "tourist_attraction";
  if (lowered.includes("duck tour")) return "tourist_attraction";
  if (lowered.includes("harbor cruise")) return "tourist_attraction";
  if (lowered.includes("red sox") || lowered.includes("fenway")) return "stadium";
  if (lowered.includes("seafood")) return "restaurant";
  if (lowered.includes("market") || lowered.includes("quincy market")) return "shopping_mall";
  if (lowered.includes("university") || lowered.includes("campus")) return "university";
  
  // Generic fallbacks based on context
  if (lowered.includes("visit") || lowered.includes("see") || lowered.includes("tour")) {
    return "tourist_attraction";
  }
  
  // For completely vague activities, return null (don't attempt a venue search)
  if (lowered.includes("relax") || lowered.includes("explore") || 
      lowered.includes("walk") || lowered.includes("stroll")) {
    return null;
  }
  
  // Default to tourist_attraction for unrecognized activities
  return "tourist_attraction";
} 