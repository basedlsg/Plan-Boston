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
    time: string;  // Format: "HH:MM" (24-hour) or "HH:MM AM/PM" (12-hour)
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
        - startLocation: the user's current or starting location
        - destinations: array of specific places they want to visit
        - fixedTimes: array of {location, time} pairs for any time-specific commitments
          Time should be in 24-hour format (e.g., "21:00") or 12-hour format with AM/PM (e.g., "9:00 PM")
        - preferences: object containing:
          - type: type of place they're looking for (e.g. "coffee shop", "restaurant")
          - requirements: array of specific requirements (e.g. ["quiet", "work-friendly"])

        For example, if input is "I'm at Green Park and need a quiet coffee shop to work until my dinner at Duck & Waffle at 8pm",
        you should identify:
        - Green Park as startLocation
        - Duck & Waffle in destinations
        - fixedTimes with Duck & Waffle at "20:00" or "8:00 PM"
        - preferences for a quiet, work-friendly coffee shop

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