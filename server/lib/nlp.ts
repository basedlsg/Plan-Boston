import Anthropic from '@anthropic-ai/sdk';
import type { PlaceDetails } from "@shared/schema";
import { londonAreas } from "../data/london-areas";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export type StructuredRequest = {
  startLocation: string;
  destinations: string[];
  fixedTimes: Array<{
    location: string;
    time: string;  // Format: "HH:MM" (24-hour) or "HH:MM AM/PM" (12-hour)
    type?: string; // e.g., "restaurant" for lunch
  }>;
  preferences: {
    type?: string;
    requirements?: string[];
  };
};

// Common London stations that don't always include "station" in references
const COMMON_STATIONS = [
  "Bank",
  "Embankment",
  "Liverpool Street",
  "Charing Cross",
  "Victoria",
  "Waterloo",
  "London Bridge"
];

// Starting location patterns
const STARTING_PATTERNS = [
  /(?:I'm|I am|starting|start|begin|beginning|currently)(?:\s+(?:from|at|in|near))?\s+(.+?)(?:\s+(?:at|and|,|--))/i,
  /(?:from|at|in)\s+(.+?)(?:\s+(?:at|and|,|--))/i
];

// Helper to validate if a location exists in our London areas data
function isKnownLondonArea(location: string): boolean {
  return londonAreas.some(area => 
    area.name.toLowerCase() === location.toLowerCase() ||
    area.neighbors.some(n => n.toLowerCase() === location.toLowerCase())
  );
}

// Helper to extract starting location from text using patterns
function extractStartingLocation(text: string): string | null {
  for (const pattern of STARTING_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      let location = match[1].trim();

      // Add "station" if it's a common tube station
      if (COMMON_STATIONS.includes(location) && !location.toLowerCase().includes("station")) {
        location = `${location} Station`;
      }

      return location;
    }
  }
  return null;
}

export async function parseItineraryRequest(query: string): Promise<StructuredRequest> {
  try {
    // First try to extract starting location using patterns
    const patternStartLocation = extractStartingLocation(query);

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      messages: [{
        role: "user",
        content: `Extract locations, times, and activities from this London itinerary request. Format as JSON.

Note these special cases:
- If a location like "Bank" or "Embankment" is mentioned without "station", assume it's a tube station
- The starting location is: ${patternStartLocation || "not detected by pattern matching"}
- Look for specific activity types (lunch, dinner, coffee, shopping) and their locations
- Identify any requirements (quiet, non-crowded, interesting)

Example input: "lunch in Green Park at 2 then go to Fitzrovia for a nice non-crowded interesting activity"
Should identify:
- Green Park with lunch at 14:00
- Fitzrovia as destination
- Type: "lunch" for first activity
- Requirements: ["non-crowded", "interesting"]

Input: ${query}

Format response as:
{
  "startLocation": "",
  "destinations": [],
  "fixedTimes": [
    {
      "location": "location name",
      "time": "HH:MM",
      "type": "activity type (e.g. restaurant, cafe)"
    }
  ],
  "preferences": {
    "type": "activity type if specified",
    "requirements": ["requirements like quiet, non-crowded"]
  }
}`
      }],
      max_tokens: 1000,
      temperature: 0
    });

    const parsed = JSON.parse(response.content[0].text) as StructuredRequest;

    // Use pattern-matched starting location if available
    if (patternStartLocation && !parsed.startLocation) {
      parsed.startLocation = patternStartLocation;
    }
    // Otherwise use the first mentioned location
    else if (!parsed.startLocation && parsed.fixedTimes.length > 0) {
      parsed.startLocation = parsed.fixedTimes[0].location;
    } else if (!parsed.startLocation && parsed.destinations.length > 0) {
      parsed.startLocation = parsed.destinations[0];
    }

    // For activities like "lunch", ensure we have a type
    if (parsed.fixedTimes.length > 0 && !parsed.fixedTimes[0].type) {
      if (parsed.preferences.type?.includes('lunch')) {
        parsed.fixedTimes[0].type = 'restaurant';
      }
    }

    // Add "station" to common station names if missing
    const normalizeLocation = (loc: string) => {
      if (COMMON_STATIONS.includes(loc) && !loc.toLowerCase().includes("station")) {
        return `${loc} Station`;
      }
      return loc;
    };

    // Normalize all locations
    const validatedRequest = {
      ...parsed,
      startLocation: parsed.startLocation && isKnownLondonArea(normalizeLocation(parsed.startLocation)) 
        ? normalizeLocation(parsed.startLocation) 
        : null,
      destinations: parsed.destinations.map(normalizeLocation).filter(isKnownLondonArea),
      fixedTimes: parsed.fixedTimes.map(ft => ({
        ...ft,
        location: normalizeLocation(ft.location)
      })).filter(ft => isKnownLondonArea(ft.location))
    };

    console.log("Parsed request:", validatedRequest);
    return validatedRequest;

  } catch (error) {
    console.error("Error parsing itinerary request:", error);
    throw new Error("Failed to understand the itinerary request. Please try rephrasing it.");
  }
}