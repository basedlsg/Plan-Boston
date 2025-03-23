import { z } from "zod";
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
    time: string;  // Format: "HH:MM" (24-hour)
    type?: string; // e.g., "restaurant", "cafe"
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

// Common activity types and their variations
const ACTIVITY_TYPES = {
  restaurant: ["lunch", "dinner", "eat", "food", "restaurant", "dining"],
  cafe: ["coffee", "cafe", "breakfast", "brunch"],
  bar: ["drink", "pub", "bar", "cocktail"],
  shopping: ["shop", "shopping", "store", "retail"],
  culture: ["museum", "gallery", "exhibition", "art"],
  park: ["park", "garden", "outdoor", "walk"]
};

// Starting location patterns - more flexible for various phrasings
const STARTING_PATTERNS = [
  /(?:I'm|I am|starting|start|begin|beginning|currently)(?:\s+(?:from|at|in|near))?\s+(.+?)(?:\s+(?:at|and|,|--))/i,
  /(?:from|at|in)\s+(.+?)(?:\s+(?:at|and|,|--))/i,
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

// Helper to handle relative time periods
function expandRelativeTime(timeString: string): string {
  // Map of relative times to reasonable hour ranges
  const timeMap = {
    'morning': '10:00',
    'afternoon': '14:00',
    'evening': '18:00',
    'night': '20:00',
    'lunch': '12:30',
    'dinner': '19:00',
    'breakfast': '08:30'
  };

  // Try to match the timeString to our map
  const normalized = timeString.toLowerCase().trim();
  if (timeMap[normalized]) {
    return timeMap[normalized];
  }

  // If not found in our map, return the original string for further processing
  return timeString;
}

// Helper to normalize time strings to 24-hour format
function normalizeTimeString(timeString: string): string {
  try {
    // First, try to handle relative times
    const expandedTime = expandRelativeTime(timeString);

    // If it was expanded, it's already normalized
    if (expandedTime !== timeString) {
      return expandedTime;
    }

    // Already in 24-hour format
    if (/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(expandedTime)) {
      return expandedTime;
    }

    // Convert 12-hour format with am/pm
    const twelveHour = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i;
    const match = expandedTime.toLowerCase().match(twelveHour);

    if (match) {
      let [_, hours, minutes = "00", meridian] = match;
      let hour = parseInt(hours);

      if (meridian === "pm" && hour < 12) hour += 12;
      if (meridian === "am" && hour === 12) hour = 0;

      return `${hour.toString().padStart(2, '0')}:${minutes}`;
    }

    // Handle informal times
    const informal = /^(\d{1,2})(?:\s*(?:ish|around|about|approximately))?$/;
    const informalMatch = expandedTime.match(informal);

    if (informalMatch) {
      const hour = parseInt(informalMatch[1]);
      return `${hour.toString().padStart(2, '0')}:00`;
    }

    // Instead of throwing an error, return a default time based on context
    console.warn(`Could not parse time: ${timeString}, using default`);

    // Use the current time as context to choose a reasonable default
    const currentHour = new Date().getHours();
    if (currentHour < 11) return '12:00'; // Default to lunch if morning
    if (currentHour < 16) return '18:00'; // Default to dinner if afternoon
    return '20:00'; // Default to evening if later

  } catch (error) {
    console.error(`Error parsing time "${timeString}":`, error);
    return '12:00'; // Default to noon if all else fails
  }
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
        content: `Parse this London itinerary request: "${query}"

Extract the core elements regardless of phrasing:
1. LOCATIONS: Any mentioned place in London (neighborhoods, landmarks, streets, stations)
2. ACTIVITIES: What they want to do (dining, sightseeing, etc.)
3. TIMES: When activities should occur (convert to 24-hour format)
4. PREFERENCES: Desired qualities (quiet, fancy, cheap, etc.)

Return JSON only, no explanations, in this exact format:
{
  "startLocation": string | null,
  "destinations": string[],
  "fixedTimes": [{"location": string, "time": string, "type"?: string}],
  "preferences": {"type"?: string, "requirements"?: string[]}
}`
      }]
    });

    if (!response.content[0] || typeof response.content[0].text !== 'string') {
      throw new Error("Invalid response format from language model");
    }

    // Parse response and ensure proper structure with defaults
    const rawResponse = JSON.parse(response.content[0].text);
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
          location: normalizeLocation(ft.location),
          time: normalizeTimeString(ft.time) // Normalize time here
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