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
        content: `Extract locations and times from this London itinerary request. Format as JSON.
Consider:
- Locations can be neighborhoods (Fitzrovia, Soho), landmarks (Green Park, Tower Bridge), or areas
- Times can be in 12-hour ("2pm", "2:00 PM") or 24-hour format ("14:00")
- Activity types like "lunch", "dinner", "coffee", "shopping"
- Requirements like "quiet", "non-crowded", "interesting"

Example input: "lunch in Green Park at 2 then go to Fitzrovia for a nice non-crowded interesting activity"
Should identify:
- "Green Park" as location with "lunch" at "14:00"
- "Fitzrovia" as destination with requirements ["non-crowded", "interesting"]

Input: ${query}

Return JSON with:
{
  "startLocation": "first location mentioned if no explicit start",
  "destinations": ["other locations mentioned"],
  "fixedTimes": [{"location": "place", "time": "HH:MM", "type": "activity_type"}],
  "preferences": {
    "type": "activity type if specified",
    "requirements": ["any mentioned requirements"]
  }
}`
      }],
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });

    const parsed = JSON.parse(response.content[0].text) as StructuredRequest;

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