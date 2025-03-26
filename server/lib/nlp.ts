import { z } from "zod";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
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

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Configure Gemini model with safety settings
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-pro-latest",
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
  ],
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

    // Then use Gemini for additional understanding
    const prompt = `Parse this London itinerary request: "${query}"

Extract ONLY the explicitly mentioned elements:
1. LOCATIONS: Specific places mentioned in London
2. ACTIVITIES: Only activities clearly stated in the request
3. TIMES: Only times explicitly mentioned (convert to 24-hour format)
4. PREFERENCES: Qualities mentioned for the experience

DO NOT add activities, times or locations that aren't clearly in the request.

IMPORTANT RULES:
1. ONLY extract what is EXPLICITLY mentioned in the user's request
2. DO NOT infer, assume, or add ANY activities that are not clearly stated by the user
3. DO NOT include "default" or "suggested" activities
4. DO NOT create activities for locations mentioned without a specific activity
5. DO NOT interpret generic preferences as specific activities
6. ONLY include locations in "destinations" if they are explicitly mentioned as places to visit
7. Time references MUST be paired with an actual activity or venue request

Example: 
If user says "coffee in Hampstead Heath and dinner in Shoreditch", ONLY extract these two activities.
DO NOT add activities like "exploring Hampstead Heath" or "walk in the park" unless explicitly mentioned.

Return JSON only, in this exact format:
{
  "startLocation": string | null,
  "destinations": string[],
  "fixedTimes": [{"location": string, "time": string, "type"?: string}],
  "preferences": {"type"?: string, "requirements"?: string[]}
}

JSON ONLY, no preamble or explanations.`;

    try {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      // Add detailed logging to debug the response structure
      console.log("Raw Gemini API response:", responseText);
      
      if (!responseText || responseText.trim() === '') {
        console.error("Empty text content received");
        throw new Error("Empty response received from language model");
      }
    
      // Clean the text content by removing markdown code block syntax
      let cleanedContent = responseText.trim();
      
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
      
      // Parse the JSON response
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(cleanedContent);
        console.log("Successfully parsed Gemini response:", parsedResponse);
      } catch (error: unknown) {
        console.error("JSON parse error:", error);
        console.error("Problematic text content:", cleanedContent);
        console.log("Original text response:", responseText);
        
        // Advanced error recovery - try to extract JSON by looking for { and }
        try {
          const jsonStart = cleanedContent.indexOf('{');
          const jsonEnd = cleanedContent.lastIndexOf('}');
          
          if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            const extractedJson = cleanedContent.substring(jsonStart, jsonEnd + 1);
            console.log("Attempting to parse extracted JSON:", extractedJson);
            parsedResponse = JSON.parse(extractedJson);
            console.log("Successfully parsed extracted JSON:", parsedResponse);
          } else {
            throw new Error("Could not find valid JSON object markers");
          }
        } catch (extractError) {
          // Handle unknown error type safely
          const errorMessage = error instanceof Error ? error.message : String(error);
          throw new Error(`Failed to parse JSON response: ${errorMessage}`);
        }
      }

      // Define the expected type for our fixed times entries
      type FixedTimeEntry = {
        location: string;
        time: string;
        type?: string;
      };

      // Convert Gemini's parsed output to StructuredRequest
      const parsed: StructuredRequest = {
        startLocation: parsedResponse.startLocation,
        destinations: parsedResponse.destinations || [],
        fixedTimes: [],
        preferences: {
          type: parsedResponse.preferences?.type,
          requirements: parsedResponse.preferences?.requirements || []
        }
      };

      // Process fixed times from Gemini's response
      if (parsedResponse.fixedTimes && Array.isArray(parsedResponse.fixedTimes)) {
        for (const ft of parsedResponse.fixedTimes) {
          if (ft && typeof ft === 'object' && 'location' in ft && 'time' in ft) {
            const location = findLocation(String(ft.location));
            if (location) {
              // Parse time but preserve original activity type
              let timeValue = String(ft.time);
              // Handle time ranges (15:00-17:00)
              if (timeValue.includes('-')) {
                timeValue = timeValue.split('-')[0]; // Take the start time
              }
              // Handle relative times
              if (!timeValue.includes(':')) {
                timeValue = expandRelativeTime(timeValue);
              }
              
              parsed.fixedTimes.push({
                location: location.name,
                time: timeValue,
                // Preserve the original activity type from the response
                type: ft.type ? String(ft.type) : undefined
              });
            }
          }
        }
      }

      // Set startLocation if not already set
      if (!parsed.startLocation && parsed.destinations.length > 0) {
        const firstDestination = parsed.destinations.shift();
        if (firstDestination) {
          parsed.startLocation = firstDestination;
        }
      }

      // Normalize time formats first (ensure HH:MM 24-hour format)
      parsed.fixedTimes.forEach((item: FixedTimeEntry) => {
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
      const stringified = parsed.fixedTimes.map((item: FixedTimeEntry) => JSON.stringify(item));
      const uniqueStringified: string[] = [];
      stringified.forEach((str: string) => {
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
            const potentialTimeFormats: string[] = [];
            
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
            const location = findLocation(locationBefore[2]);
            if (location) {
              locationName = location.name;
            }
          } else if (locationAfter && locationAfter[2]) {
            const location = findLocation(locationAfter[2]);
            if (location) {
              locationName = location.name;
            }
          }
          
          if (locationName) {
            // Add vague time-based activity only if we have a valid location
            const activityTypeOptions = ["activity", "visit", "explore"];
            const nearestActivity = extractedActivities.find(a => 
              query.indexOf(a.naturalDescription) < query.indexOf(timeRef.originalText) + timeRef.originalText.length &&
              query.indexOf(a.naturalDescription) > query.indexOf(timeRef.originalText) - 100 // Within 100 chars of time reference
            );
            
            // Only add a time-based activity if:
            // 1. We found an appropriate activity description nearby, or
            // 2. The time appears to be significant (i.e., explicitly mentioned)
            if (nearestActivity || 
                timeRef.originalText.match(/\b(at|around|by)\s+\d{1,2}/i)) {
              
              // Create a new fixed time entry
              parsed.fixedTimes.push({
                location: locationName,
                time: timeRef.time,
                type: nearestActivity?.type || activityTypeOptions[0]
              });
            }
          }
        }
      }

      // Sort fixed times chronologically
      parsed.fixedTimes.sort((a, b) => {
        if (!a.time) return -1;
        if (!b.time) return 1;
        return a.time.localeCompare(b.time);
      });

      return parsed;

    } catch (error: any) {
      console.error("Error calling Gemini API:", error);
      
      // Return a basic structure from our direct extraction methods as a fallback
      return {
        startLocation: null,
        destinations: extractedLocations.map(loc => loc.name),
        fixedTimes: [],
        preferences: {
          requirements: []
        }
      };
    }
  } catch (error: any) {
    console.error("Fatal error in parseItineraryRequest:", error);
    throw new Error(`Failed to parse itinerary request: ${error.message}`);
  }
}