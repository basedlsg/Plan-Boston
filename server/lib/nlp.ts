import { z } from "zod";
import Anthropic from '@anthropic-ai/sdk';
import type { PlaceDetails } from "@shared/schema";
import { londonAreas } from "../data/london-areas";
import { 
  findLocation, 
  parseActivity, 
  parseTimeExpression, 
  getDefaultTime,
  LocationContext,
  ActivityContext 
} from "./languageProcessing";

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

// Extract locations with confidence scores
function extractLocations(text: string): LocationContext[] {
  const locations: LocationContext[] = [];

  // Split text into potential location phrases
  const phrases = text.split(/[,.]|\s+(?:then|and|to|at)\s+/);

  for (const phrase of phrases) {
    // Look for location indicators
    const locationMatch = phrase.match(/(?:in|at|near|from)\s+([A-Z][a-zA-Z\s]+)/);
    if (locationMatch?.[1]) {
      const location = findLocation(locationMatch[1]);
      if (location) {
        locations.push(location);
      }
    }
  }

  return locations;
}

// Extract activities with their context
function extractActivities(text: string): ActivityContext[] {
  const activities: ActivityContext[] = [];

  // Split text into activity segments
  const segments = text.split(/[,.]|\s+(?:then|and)\s+/);

  for (const segment of segments) {
    // Look for activity indicators
    if (segment.match(/(?:want|like|need|do|have|get)\s+(.+)/)) {
      const activity = parseActivity(segment);
      activities.push(activity);
    }
  }

  return activities;
}

export async function parseItineraryRequest(query: string): Promise<StructuredRequest> {
  try {
    // First use our direct extraction methods
    const extractedLocations = extractLocations(query);
    const extractedActivities = extractActivities(query);

    // Then use Claude for additional understanding
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

    // Parse Claude's response
    const claudeParsed = JSON.parse(response.content[0].text);

    // Combine Claude's understanding with our direct extraction
    const parsed: StructuredRequest = {
      startLocation: null,
      destinations: [],
      fixedTimes: [],
      preferences: {
        type: claudeParsed.preferences?.type,
        requirements: claudeParsed.preferences?.requirements || []
      }
    };

    // Use locations from both sources
    const allLocations = new Set([
      ...extractedLocations.map(l => l.name),
      ...claudeParsed.destinations || [],
      claudeParsed.startLocation
    ].filter(Boolean));

    // Validate each location
    for (const loc of allLocations) {
      const validatedLoc = findLocation(loc);
      if (validatedLoc) {
        if (!parsed.startLocation) {
          parsed.startLocation = validatedLoc.name;
        } else {
          parsed.destinations.push(validatedLoc.name);
        }
      }
    }

    // Combine activities and times
    const fixedTimes = new Set();
    for (const activity of extractedActivities) {
      if (activity.timeContext?.preferredTime) {
        fixedTimes.add({
          location: parsed.startLocation || parsed.destinations[0],
          time: activity.timeContext.preferredTime,
          type: activity.venueType
        });
      }
    }

    // Add Claude's fixed times
    if (claudeParsed.fixedTimes) {
      for (const ft of claudeParsed.fixedTimes) {
        const location = findLocation(ft.location);
        if (location) {
          fixedTimes.add({
            location: location.name,
            time: parseTimeExpression(ft.time).time || getDefaultTime(ft.type || ''),
            type: ft.type
          });
        }
      }
    }

    parsed.fixedTimes = Array.from(fixedTimes);

    // If no locations were found, provide a helpful error
    if (!parsed.startLocation && parsed.destinations.length === 0) {
      throw new Error(
        "We need to know where in London you'll be. Try adding a neighborhood or landmark to your request.\n\n" +
        "Examples:\n" +
        "- \"I'm at Liverpool Street and want lunch\"\n" +
        "- \"Find me dinner in Soho at 7pm\"\n" +
        "- \"Plan a day starting from Green Park\""
      );
    }

    console.log("Parsed request:", parsed);
    return parsed;

  } catch (error) {
    console.error("Error parsing itinerary request:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to understand the itinerary request. Please try rephrasing it with a specific London location.");
  }
}