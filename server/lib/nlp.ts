import { z } from "zod";
import Anthropic from '@anthropic-ai/sdk';
import type { PlaceDetails } from "@shared/schema";
import { londonAreas } from "../data/london-areas";
import { 
  findLocation, 
  parseActivity, 
  parseTimeExpression, 
  getDefaultTime,
  expandRelativeTime,
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

  // Split text into activity segments - expanded to catch more transition words
  const segments = text.split(/[,.]|\s+(?:then|and|afterwards|later|after that|following that|next)\s+/);

  for (const segment of segments) {
    // Expanded regex to capture more vague activity indicators
    if (segment.match(/(?:want|like|need|do|have|get|see|visit|explore|enjoy|experience|something|activity)\s+(.+)/) ||
        segment.match(/(?:around|at|by|from|until|before|after)\s+\d{1,2}(?::\d{2})?(?:\s*[ap]m)?/) || // Time indicators
        segment.match(/(?:in the|during the|for)\s+(?:morning|afternoon|evening|night)/)) { // Period indicators
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
    // The newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
    const response = await anthropic.messages.create({
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `Parse this London itinerary request: "${query}"

Extract the core elements regardless of phrasing:
1. LOCATIONS: Any mentioned place in London (neighborhoods, landmarks, streets, stations)
2. ACTIVITIES: ALL things they want to do (dining, sightseeing, etc.) - INCLUDE vague activities like "do something nice" or "see the area"
3. TIMES: ALL time references (convert to 24-hour format) - capture EVERY time mentioned (morning, afternoon, specific times)
4. PREFERENCES: Desired qualities (quiet, fancy, cheap, etc.)

Be EXHAUSTIVE - capture EVERY activity with its corresponding time and location.

Return JSON only, no explanations, in this exact format:
{
  "startLocation": string | null,
  "destinations": string[],
  "fixedTimes": [{"location": string, "time": string, "type"?: string}],
  "preferences": {"type"?: string, "requirements"?: string[]}
}`
      }],
      system: "Extract ALL activities, times, and locations from London itinerary requests. Be comprehensive and thorough. Return as JSON."
    });

    // Add detailed logging to debug the response structure
    console.log("Raw Claude API response:", JSON.stringify(response));
    
    // Check if response and content array exist and have valid length
    if (!response || !response.content || !Array.isArray(response.content) || response.content.length === 0) {
      console.error("Invalid response structure:", response);
      throw new Error("Invalid response format: Missing or empty content array from language model");
    }
    
    // Access first content item with proper null checking
    const content = response.content[0];
    if (!content || typeof content !== 'object') {
      console.error("Invalid content object:", content);
      throw new Error("Invalid response format: First content item is not an object");
    }
    
    // Handle Anthropic API response format with proper type checking
    let textContent = '';
    if ('text' in content && content.text !== null && content.text !== undefined) {
      textContent = String(content.text);
    } else {
      console.error("Missing text property in content:", content);
      throw new Error("Invalid response format: Content object missing 'text' property");
    }
    
    if (textContent.trim() === '') {
      console.error("Empty text content received");
      throw new Error("Empty response received from language model");
    }

    // Clean the text content by removing markdown code block syntax
    let cleanedContent = textContent.trim();
    
    // Remove markdown code block markers if present
    if (cleanedContent.startsWith('```json') || cleanedContent.startsWith('```')) {
      // Find the position of the first and last backtick sections
      const firstBlockEnd = cleanedContent.indexOf('\n');
      const lastBlockStart = cleanedContent.lastIndexOf('```');
      
      if (firstBlockEnd !== -1) {
        // Remove the opening code block marker
        cleanedContent = cleanedContent.substring(firstBlockEnd + 1);
        
        // Remove the closing code block marker if present
        if (lastBlockStart !== -1 && lastBlockStart > firstBlockEnd) {
          cleanedContent = cleanedContent.substring(0, lastBlockStart).trim();
        }
      }
    }
    
    // Remove any extra characters after the last closing brace
    const lastBrace = cleanedContent.lastIndexOf('}');
    if (lastBrace !== -1) {
      cleanedContent = cleanedContent.substring(0, lastBrace + 1);
    }
    
    console.log("Cleaned JSON content:", cleanedContent);
    
    // Try/catch for JSON parsing with detailed error information
    let claudeParsed;
    try {
      claudeParsed = JSON.parse(cleanedContent);
      console.log("Successfully parsed Claude response:", claudeParsed);
    } catch (error: unknown) {
      console.error("JSON parse error:", error);
      console.error("Problematic text content:", cleanedContent);
      console.log("Original text response:", textContent);
      
      // Advanced error recovery - try to extract JSON by looking for { and }
      try {
        const jsonStart = cleanedContent.indexOf('{');
        const jsonEnd = cleanedContent.lastIndexOf('}');
        
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          const extractedJson = cleanedContent.substring(jsonStart, jsonEnd + 1);
          console.log("Attempting to parse extracted JSON:", extractedJson);
          claudeParsed = JSON.parse(extractedJson);
          console.log("Successfully parsed extracted JSON:", claudeParsed);
        } else {
          throw new Error("Could not find valid JSON object markers");
        }
      } catch (extractError) {
        // Handle unknown error type safely
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to parse JSON response: ${errorMessage}`);
      }
    }

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

    // Use locations from both sources with null/undefined checks
    const allLocationsList = [
      ...(extractedLocations && extractedLocations.length > 0 ? extractedLocations.map(l => l.name) : []),
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
    
    // Add times from extracted activities with null/undefined checks
    if (extractedActivities && extractedActivities.length > 0) {
      for (const activity of extractedActivities) {
        if (activity && activity.timeContext?.preferredTime) {
          fixedTimesList.push({
            location: parsed.startLocation || parsed.destinations[0] || 'Central London',
            time: activity.timeContext.preferredTime,
            type: activity.venueType === null ? undefined : activity.venueType
          });
        }
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

    // Normalize time formats first (ensure HH:MM 24-hour format)
    fixedTimesList.forEach(item => {
      if (item.time && item.time.includes(':')) {
        const parts = item.time.split(':');
        if (parts.length === 2) {
          const hour = parseInt(parts[0]);
          const minute = parseInt(parts[1]);
          // Create normalized 24-hour format
          item.time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        }
      }
    });
    
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
    
    // Clear any duplicate entries with the same time value but different formatting
    const uniqueTimeEntries = new Map<string, any>();
    const timeEquivalences = new Map<string, string>();
    
    // First, find all 12-hour / 24-hour equivalences (e.g., 3:00 PM = 15:00)
    parsed.fixedTimes.forEach(entry => {
      if (entry.time && entry.time.includes(':')) {
        const [hourStr, minuteStr] = entry.time.split(':');
        const hour = parseInt(hourStr);
        const minute = parseInt(minuteStr);
        
        if (hour >= 0 && hour < 24) {
          // Generate both 12-hour and 24-hour versions for tracking
          const hour24 = hour;
          const hour12 = hour24 > 12 ? hour24 - 12 : (hour24 === 0 ? 12 : hour24);
          
          const time24h = `${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          const time12h = `${hour12}:${minute.toString().padStart(2, '0')}`;
          
          // Map all variations to the 24-hour format for normalization
          timeEquivalences.set(time12h, time24h);
          timeEquivalences.set(time24h, time24h);
          
          // Also handle non-zero-padded versions
          timeEquivalences.set(`${hour24}:${minute.toString().padStart(2, '0')}`, time24h);
          timeEquivalences.set(`${hour12}:${minute.toString().padStart(2, '0')}`, time24h);
        }
      }
    });
    
    // Now process entries with normalized times
    parsed.fixedTimes.forEach(entry => {
      // Normalize the time to 24-hour format
      if (entry.time) {
        const normalizedTime = timeEquivalences.get(entry.time) || entry.time;
        
        // Create a unique key for each activity (using time, location, and activity type)
        const activityKey = `${normalizedTime}-${entry.location}-${entry.type || 'activity'}`;
        
        if (!uniqueTimeEntries.has(activityKey)) {
          // Update the entry with the normalized time format
          entry.time = normalizedTime;
          uniqueTimeEntries.set(activityKey, entry);
        }
      } else {
        // Handle entries without time values
        uniqueTimeEntries.set(`no-time-${entry.location}-${entry.type || 'activity'}`, entry);
      }
    });
    
    // Replace the fixed times with de-duplicated list
    parsed.fixedTimes = Array.from(uniqueTimeEntries.values());
    
    // Post-processing step: Ensure all time references have corresponding activities
    // Extract all time references from the query
    const timeReferenceRegexes = [
      /\b(around|at|by|from|until|before|after)\s+(\d{1,2})(?:[:.]?(\d{2}))?\s*([ap]\.?m\.?)?/gi,
      /\b(\d{1,2})(?:[:.]?(\d{2}))?\s*([ap]\.?m\.?)/gi, // Direct time reference without preposition
      /\b(morning|afternoon|evening|night|noon|midnight)\b/gi,
      /\b(breakfast|brunch|lunch|dinner|tea)\s+time\b/gi
    ];
    
    const timeReferences: { time: string, originalText: string }[] = [];
    const existingTimes = new Set(parsed.fixedTimes.map(ft => ft.time));
    
    // Find all time references
    for (const regex of timeReferenceRegexes) {
      let match;
      while ((match = regex.exec(query)) !== null) {
        const fullMatch = match[0];
        let standardizedTime = '';
        
        // Process numeric times - handle both cases with or without preposition
        if (match[1] && /^\d+$/.test(match[1])) {
          // No preposition case (direct time reference - "3pm")
          const hour = parseInt(match[1]);
          const minute = match[2] ? parseInt(match[2]) : 0;
          const meridian = match[3]?.toLowerCase().includes('p') ? 'pm' : 
                          match[3]?.toLowerCase().includes('a') ? 'am' : null;
          
          let hour24 = hour;
          if (meridian === 'pm' && hour < 12) hour24 += 12;
          if (meridian === 'am' && hour === 12) hour24 = 0;
          
          standardizedTime = `${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        } else if (match[2]) {
          // With preposition case ("at 3pm")
          const hour = parseInt(match[2]);
          const minute = match[3] ? parseInt(match[3]) : 0;
          const meridian = match[4]?.toLowerCase().includes('p') ? 'pm' : 
                          match[4]?.toLowerCase().includes('a') ? 'am' : null;
          
          let hour24 = hour;
          if (meridian === 'pm' && hour < 12) hour24 += 12;
          if (meridian === 'am' && hour === 12) hour24 = 0;
          
          standardizedTime = `${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        } else if (match[1] && /^(morning|afternoon|evening|night|noon|midnight|breakfast|brunch|lunch|dinner|tea)$/.test(match[1].toLowerCase())) {
          // Handle time periods
          standardizedTime = expandRelativeTime(match[1]);
        }
        
        if (standardizedTime) {
          timeReferences.push({
            time: standardizedTime,
            originalText: fullMatch
          });
        }
      }
    }
    
    // Add placeholder activities for any time reference without a matching activity
    for (const timeRef of timeReferences) {
      // Check for exact match first
      let hasMatchingActivity = parsed.fixedTimes.some(ft => 
        ft.time === timeRef.time
      );
      
      // Check for alternative time formats and ambiguous times (3:00 could be 3 AM or PM)
      if (!hasMatchingActivity) {
        // Parse the time to handle potential format differences
        const timeComponents = timeRef.time.split(':');
        if (timeComponents.length === 2) {
          const hour = parseInt(timeComponents[0]);
          const minute = parseInt(timeComponents[1]);
          
          // Generate all potential time formats for comparison
          const potentialTimeFormats = [];
          
          // 24-hour format: 03:00 or 15:00
          potentialTimeFormats.push(hour.toString().padStart(2, '0') + ':' + minute.toString().padStart(2, '0'));
          
          // 12-hour format: 3:00
          potentialTimeFormats.push((hour > 12 ? hour - 12 : hour).toString() + ':' + minute.toString().padStart(2, '0'));
          
          // If hour < 12, also check the PM equivalent (e.g., 3:00 → check 15:00 too)
          if (hour < 12) {
            potentialTimeFormats.push((hour + 12).toString().padStart(2, '0') + ':' + minute.toString().padStart(2, '0'));
          }
          
          // If hour > 12, also check the AM equivalent (e.g., 15:00 → check 3:00 too)
          if (hour >= 12 && hour < 24) {
            potentialTimeFormats.push((hour - 12).toString().padStart(2, '0') + ':' + minute.toString().padStart(2, '0'));
          }
          
          // Check all time formats
          hasMatchingActivity = parsed.fixedTimes.some(ft => 
            potentialTimeFormats.includes(ft.time)
          );
        }
      }
      
      if (!hasMatchingActivity) {
        // Find nearest location mentioned near this time reference
        const locationBefore = query.substring(0, query.indexOf(timeRef.originalText))
          .match(/\b(in|at|near|by)\s+([A-Z][a-zA-Z\s]+)\b/i);
        
        const locationAfter = query.substring(query.indexOf(timeRef.originalText))
          .match(/\b(in|at|near|by)\s+([A-Z][a-zA-Z\s]+)\b/i);
        
        let locationName = parsed.startLocation;
        
        if (locationBefore && locationBefore[2]) {
          const loc = findLocation(locationBefore[2]);
          if (loc) locationName = loc.name;
        } else if (locationAfter && locationAfter[2]) {
          const loc = findLocation(locationAfter[2]);
          if (loc) locationName = loc.name;
        }
        
        // Guess activity type based on context
        const sentenceWithTime = query.substring(
          Math.max(0, query.indexOf(timeRef.originalText) - 50),
          Math.min(query.length, query.indexOf(timeRef.originalText) + 50)
        );
        
        let activityType = 'activity'; // Default
        
        // Try to infer meaningful activity type from context
        if (sentenceWithTime.includes('eat') || sentenceWithTime.includes('food') || 
            sentenceWithTime.includes('restaurant')) {
          activityType = 'restaurant';
        } else if (sentenceWithTime.includes('coffee') || sentenceWithTime.includes('cafe')) {
          activityType = 'coffee';
        } else if (sentenceWithTime.includes('museum') || sentenceWithTime.includes('gallery')) {
          activityType = 'museum';
        } else if (sentenceWithTime.includes('park') || sentenceWithTime.includes('garden')) {
          activityType = 'park';
        } else if (sentenceWithTime.includes('shopping') || sentenceWithTime.includes('shop')) {
          activityType = 'shopping';
        } else if (sentenceWithTime.includes('something') || sentenceWithTime.includes('activity')) {
          activityType = 'activity';
        }
        
        // Add a new fixed time entry for this previously uncaptured activity
        parsed.fixedTimes.push({
          location: locationName || 'Central London',
          time: timeRef.time,
          type: activityType
        });
      }
    }

    // Intelligently assign a starting location if none was provided
    if (!parsed.startLocation) {
      // Case 1: If there are destinations, use the first one as the starting point
      if (parsed.destinations.length > 0) {
        parsed.startLocation = parsed.destinations[0];
        parsed.destinations.shift(); // Remove it from destinations since it's now the starting point
      } 
      // Case 2: If there are fixed times with locations, use the first one
      else if (parsed.fixedTimes.length > 0 && parsed.fixedTimes[0].location) {
        parsed.startLocation = parsed.fixedTimes[0].location;
      }
      // Case 3: Use transport hubs or time-appropriate locations as starting points
      else {
        const currentHour = new Date().getHours();
        
        // Morning (6-11): Transport hubs are logical starting points
        if (currentHour >= 6 && currentHour < 12) {
          const transportHubs = ["King's Cross", "Liverpool Street", "Waterloo", "Victoria", "Paddington"];
          parsed.startLocation = transportHubs[0]; // Default to King's Cross
        } 
        // Lunchtime (12-14): Central shopping/business areas
        else if (currentHour >= 12 && currentHour < 15) {
          parsed.startLocation = "Oxford Street"; // Shopping and central
        }
        // Afternoon (15-17): Cultural areas
        else if (currentHour >= 15 && currentHour < 18) {
          parsed.startLocation = "South Kensington"; // Museum district
        }
        // Evening/Night (18-23): Entertainment districts
        else if (currentHour >= 18 && currentHour < 24) {
          parsed.startLocation = "Soho"; // Nightlife center
        }
        // Late night/early morning (0-5): Safe, well-lit areas
        else {
          parsed.startLocation = "Leicester Square"; // 24-hour area
        }
      }
    }
    
    // If still no locations found after auto-assignment, provide a helpful error
    if (!parsed.startLocation && parsed.destinations.length === 0) {
      throw new Error(
        "We need to know where in London you'd like to explore. Try adding a neighborhood or landmark to your request.\n\n" +
        "Examples:\n" +
        "- \"I'm at Liverpool Street and want lunch\"\n" +
        "- \"Find me dinner in Soho at 7pm\"\n" +
        "- \"Plan a day starting from Green Park\"\n\n" +
        "Or tell us about your interests and we'll suggest a starting point."
      );
    }

    console.log("Parsed request:", parsed);
    return parsed;

  } catch (error: unknown) {
    console.error("Error parsing itinerary request:", error);
    
    // Handle validation/parsing errors with more helpful messages
    if (error instanceof Error) {
      // If it's about locations not found, give detailed recommendation
      if (error.message.includes("location") || error.message.includes("where in London")) {
        throw new Error(
          `${error.message}\n\nPopular London areas you could mention:\n` +
          "• Central: Soho, Covent Garden, Westminster, Leicester Square\n" +
          "• West: Notting Hill, Kensington, Chelsea, Holland Park\n" +
          "• East: Shoreditch, City of London, Canary Wharf\n" +
          "• North: Camden Town, King's Cross, Hampstead\n" +
          "• South: Greenwich, South Bank"
        );
      }
      // If it's about API or parsing issues, provide gentler message
      else if (error.message.includes("JSON") || error.message.includes("API") || error.message.includes("language model")) {
        throw new Error(
          "We're having trouble understanding your request right now. Please try:\n" +
          "1. Being more specific about where and when\n" +
          "2. Keeping your request simple and focused\n" +
          "3. Using common London landmarks or neighborhoods"
        );
      }
      // Otherwise just rethrow the original error
      throw error;
    }
    
    // If it's not an Error instance, create a generic one
    throw new Error(
      "We couldn't understand your request. Please try rephrasing with:\n" +
      "• A clear starting location in London\n" +
      "• The type of activities you're interested in\n" +
      "• Any specific time constraints"
    );
  }
}