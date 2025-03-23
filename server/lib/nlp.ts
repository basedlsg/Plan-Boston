import Anthropic from '@anthropic-ai/sdk';
import type { PlaceDetails } from "@shared/schema";
import { londonAreas } from "../data/london-areas";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export type StructuredRequest = {
  startLocation: string | null;
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
  /(?:from|at|in)\s+(.+?)(?:\s+(?:at|and|,|--))/i,
  // Add more general location extraction patterns
  /(?:at|in|near)\s+(.+?)(?:\s+(?:at|and|,|--))/i,
  /(?:to|towards?)\s+(.+?)(?:\s+(?:at|and|,|--))/i
];

// Helper to validate if a location exists in our London areas data
function isKnownLondonArea(location: string | null | undefined): boolean {
  if (!location || typeof location !== 'string') return false;

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

// Helper to extract first location mentioned in text
function extractFirstLocation(text: string): string | null {
  // Look for locations after prepositions
  const locationPatterns = [
    /(?:at|in|near|by)\s+([A-Z][a-zA-Z\s]+?)(?:\s+(?:at|and|,|--))/,
    /(?:to|towards?)\s+([A-Z][a-zA-Z\s]+?)(?:\s+(?:at|and|,|--))/
  ];

  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

export async function parseItineraryRequest(query: string): Promise<StructuredRequest> {
  try {
    // First try to extract starting location using patterns
    const patternStartLocation = extractStartingLocation(query);

    const response = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `You are helping parse London day planning requests.
Extract:
1. Starting location (default to first mentioned location if no explicit start)
2. All mentioned locations (neighborhoods, landmarks, streets)
3. Activities with times, formatted as ISO time strings (convert informal times like "2pm" to "14:00")
4. Activity types and preferences

Parse this request: "${query}"

Return JSON only, no explanations, in this exact format:
{
  "startLocation": string | null,
  "destinations": string[],
  "fixedTimes": [{"location": string, "time": string, "type"?: string}],
  "preferences": {"type"?: string, "requirements"?: string[]}
}`
      }]
    });

    const content = response.content[0]?.type === 'text' ? response.content[0].text : null;
    if (!content) {
      throw new Error("Invalid response format from language model");
    }

    // Parse response and ensure proper structure with defaults
    const rawResponse = JSON.parse(content);
    const parsed: StructuredRequest = {
      startLocation: rawResponse.startLocation || null,
      destinations: Array.isArray(rawResponse.destinations) ? rawResponse.destinations : [],
      fixedTimes: Array.isArray(rawResponse.fixedTimes) ? rawResponse.fixedTimes : [],
      preferences: {
        type: rawResponse.preferences?.type || undefined,
        requirements: Array.isArray(rawResponse.preferences?.requirements) 
          ? rawResponse.preferences.requirements 
          : []
      }
    };

    // Use pattern-matched starting location if available
    if (patternStartLocation && !parsed.startLocation) {
      parsed.startLocation = patternStartLocation;
    }
    // Otherwise use the first activity location as starting point
    else if (!parsed.startLocation && parsed.fixedTimes.length > 0) {
      parsed.startLocation = parsed.fixedTimes[0].location;
    } else if (!parsed.startLocation && parsed.destinations.length > 0) {
      parsed.startLocation = parsed.destinations[0];
    }

    // If still no starting location, extract first mentioned location
    if (!parsed.startLocation) {
      const firstLocation = extractFirstLocation(query);
      if (firstLocation) {
        parsed.startLocation = firstLocation;
      }
    }

    // For activities like "lunch", ensure we have a type
    if (parsed.fixedTimes.length > 0 && !parsed.fixedTimes[0].type) {
      if (parsed.preferences.type?.includes('lunch')) {
        parsed.fixedTimes[0].type = 'restaurant';
      }
    }

    // Add "station" to common station names if missing
    const normalizeLocation = (loc: string): string => {
      if (!loc) return '';
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
      destinations: (parsed.destinations || [])
        .map(normalizeLocation)
        .filter(isKnownLondonArea),
      fixedTimes: (parsed.fixedTimes || [])
        .map(ft => ({
          ...ft,
          location: normalizeLocation(ft.location)
        }))
        .filter(ft => isKnownLondonArea(ft.location))
    };

    // If no valid locations were found, throw a helpful error
    if (!validatedRequest.startLocation && 
        validatedRequest.destinations.length === 0 && 
        validatedRequest.fixedTimes.length === 0) {
      throw new Error(
        "We need to know where in London you'll be. Try adding a neighborhood or landmark to your request.\n\n" +
        "Examples:\n" +
        "- \"I'm at Liverpool Street and want lunch\"\n" +
        "- \"Find me dinner in Soho at 7pm\"\n" +
        "- \"Plan a day starting from Green Park\""
      );
    }

    console.log("Parsed request:", validatedRequest);
    return validatedRequest;

  } catch (error) {
    console.error("Error parsing itinerary request:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to understand the itinerary request. Please try rephrasing it with a specific London location.");
  }
}