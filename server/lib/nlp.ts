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

// Helper to validate if a location exists in our London areas data
function isKnownLondonArea(location: string): boolean {
  return londonAreas.some(area => 
    area.name.toLowerCase() === location.toLowerCase() ||
    area.neighbors.some(n => n.toLowerCase() === location.toLowerCase())
  );
}

export async function parseItineraryRequest(query: string): Promise<StructuredRequest> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      messages: [{
        role: "user",
        content: `Extract locations, times, and activities from this London itinerary request. Format as JSON.

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

    // Use the first mentioned location as startLocation if none specified
    if (!parsed.startLocation && parsed.fixedTimes.length > 0) {
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

    // Validate locations against our London areas data
    const validatedRequest = {
      ...parsed,
      startLocation: parsed.startLocation && isKnownLondonArea(parsed.startLocation) ? parsed.startLocation : null,
      destinations: parsed.destinations.filter(isKnownLondonArea),
      fixedTimes: parsed.fixedTimes.filter(ft => isKnownLondonArea(ft.location))
    };

    console.log("Parsed request:", validatedRequest);
    return validatedRequest;

  } catch (error) {
    console.error("Error parsing itinerary request:", error);
    throw new Error("Failed to understand the itinerary request. Please try rephrasing it.");
  }
}