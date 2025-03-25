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
      }],
      system: "Extract starting location, destinations, times, and preferences from London itinerary requests. Return as JSON."
    });

    // Check for valid response format from Anthropic API
    const content = response.content[0];
    if (!content || typeof content !== 'object') {
      throw new Error("Invalid response format from language model");
    }
    
    // Handle Anthropic API response format
    const textContent = 'text' in content ? content.text : '';
    if (typeof textContent !== 'string') {
      throw new Error("Invalid text content from language model");
    }

    // Parse Claude's response
    const claudeParsed = JSON.parse(textContent);

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
    const allLocationsList = [
      ...extractedLocations.map(l => l.name),
      ...(claudeParsed.destinations || []),
      claudeParsed.startLocation
    ].filter(Boolean);
    
    // Remove duplicates without using Set spread which causes TypeScript issues
    const uniqueLocations: string[] = [];
    allLocationsList.forEach(loc => {
      if (!uniqueLocations.includes(loc)) {
        uniqueLocations.push(loc);
      }
    });

    // Validate each location
    for (const loc of uniqueLocations) {
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
    // Define the expected type for our fixed times entries
    type FixedTimeEntry = {
      location: string;
      time: string;
      type?: string;
    };
    
    const fixedTimesList: FixedTimeEntry[] = [];
    
    // Add times from extracted activities
    for (const activity of extractedActivities) {
      if (activity.timeContext?.preferredTime) {
        fixedTimesList.push({
          location: parsed.startLocation || parsed.destinations[0],
          time: activity.timeContext.preferredTime,
          type: activity.venueType
        });
      }
    }

    // Add Claude's fixed times
    if (claudeParsed.fixedTimes && Array.isArray(claudeParsed.fixedTimes)) {
      for (const ft of claudeParsed.fixedTimes) {
        if (ft && typeof ft === 'object' && 'location' in ft && 'time' in ft) {
          const location = findLocation(String(ft.location));
          if (location) {
            fixedTimesList.push({
              location: location.name,
              time: parseTimeExpression(String(ft.time)).time || getDefaultTime(ft.type ? String(ft.type) : ''),
              type: ft.type ? String(ft.type) : undefined
            });
          }
        }
      }
    }

    // Remove duplicates without using Set which causes TypeScript issues
    const stringified = fixedTimesList.map(item => JSON.stringify(item));
    const uniqueStringified: string[] = [];
    stringified.forEach(str => {
      if (!uniqueStringified.includes(str)) {
        uniqueStringified.push(str);
      }
    });
    const uniqueFixedTimes = uniqueStringified.map(item => JSON.parse(item) as FixedTimeEntry);
    
    parsed.fixedTimes = uniqueFixedTimes;

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