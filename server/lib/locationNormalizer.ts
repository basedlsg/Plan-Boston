import { londonAreas } from "../data/london-areas";

// Common variations of London landmark names
const LANDMARK_MAPPINGS: Record<string, string> = {
  "green park": "The Green Park",
  "hyde park": "Hyde Park",
  "regent's park": "Regent's Park",
  "regents park": "Regent's Park",
  "buckingham": "Buckingham Palace",
  "tower bridge": "Tower Bridge",
  "london bridge": "London Bridge",
  "british museum": "The British Museum",
  "covent garden": "Covent Garden",
  "piccadilly": "Piccadilly Circus",
  "oxford street": "Oxford Street",
  "south bank": "South Bank",
  "southbank": "South Bank"
};

// Helper to normalize location names
export function normalizeLocationName(location: string): string {
  const lowercased = location.toLowerCase().trim();
  
  // Check if it's a known landmark variation
  if (LANDMARK_MAPPINGS[lowercased]) {
    console.log(`Normalized landmark: ${location} -> ${LANDMARK_MAPPINGS[lowercased]}`);
    return LANDMARK_MAPPINGS[lowercased];
  }

  // Check if it's a known London area
  const matchingArea = londonAreas.find(area => 
    area.name.toLowerCase() === lowercased ||
    area.neighbors.some(n => n.toLowerCase() === lowercased)
  );

  if (matchingArea) {
    console.log(`Found matching area: ${location} -> ${matchingArea.name}`);
    return matchingArea.name;
  }

  // If not found in mappings, return original with proper capitalization
  return location.charAt(0).toUpperCase() + location.slice(1);
}

// Helper to verify if a returned place matches the requested location
export function verifyPlaceMatch(
  requestedLocation: string, 
  returnedName: string,
  types: string[]
): boolean {
  const normalized = normalizeLocationName(requestedLocation).toLowerCase();
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
  const suggestions: string[] = [];

  // Check landmarks
  for (const [variant, official] of Object.entries(LANDMARK_MAPPINGS)) {
    if (variant.includes(normalized) || normalized.includes(variant)) {
      suggestions.push(official);
    }
  }

  // Check areas
  for (const area of londonAreas) {
    if (area.name.toLowerCase().includes(normalized) || 
        normalized.includes(area.name.toLowerCase())) {
      suggestions.push(area.name);
    }

    // Check neighboring areas
    for (const neighbor of area.neighbors) {
      if (neighbor.toLowerCase().includes(normalized) || 
          normalized.includes(neighbor.toLowerCase())) {
        suggestions.push(neighbor);
      }
    }
  }

  return [...new Set(suggestions)].slice(0, 3); // Return up to 3 unique suggestions
}
