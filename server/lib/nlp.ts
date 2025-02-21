import Anthropic from '@anthropic-ai/sdk';
import type { PlaceDetails } from "@shared/schema";

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export type StructuredRequest = {
  startLocation: string;
  destinations: string[];
  fixedTimes: Array<{
    location: string;
    time: string;
  }>;
  preferences: {
    type?: string;
    requirements?: string[];
  };
};

export async function parseItineraryRequest(query: string): Promise<StructuredRequest> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      messages: [{
        role: "user",
        content: `Extract locations and times from this London itinerary request. Format as JSON with:
        - startLocation: starting point or current location
        - destinations: array of places to visit
        - fixedTimes: array of {location, time} for specific time commitments
        - preferences: any requirements for places (type, requirements array)
        
        Request: ${query}
        
        Return only JSON, no other text.`
      }],
      max_tokens: 1000,
    });

    return JSON.parse(response.content[0].text) as StructuredRequest;
  } catch (error) {
    console.error("Error parsing itinerary request:", error);
    throw new Error("Failed to understand the itinerary request. Please try rephrasing it.");
  }
}
