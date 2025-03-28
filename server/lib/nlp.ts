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
import { getApiKey, isFeatureEnabled, validateApiKey } from "../config";

// Configure Gemini model with safety settings
let genAI: GoogleGenerativeAI | null = null;
let model: any = null;

// Initialize AI only if API key is available
// Check if AI processing is enabled
console.log("AI_PROCESSING feature flag status:", isFeatureEnabled("AI_PROCESSING"));

if (isFeatureEnabled("AI_PROCESSING")) {
  try {
    // Check if Gemini API key is valid
    const geminiApiKey = getApiKey("GEMINI_API_KEY");
    console.log("GEMINI_API_KEY validation:", validateApiKey("GEMINI_API_KEY"));
    
    if (!geminiApiKey) {
      console.error("Gemini API Key is missing or empty");
    } else if (!validateApiKey("GEMINI_API_KEY")) {
      console.error("Gemini API Key failed validation pattern");
    } else {
      console.log("Initializing Gemini API with valid API key");
      
      // Initialize Google Generative AI with centralized config
      genAI = new GoogleGenerativeAI(geminiApiKey);
      
      // Configure Gemini model with safety settings
      model = genAI.getGenerativeModel({
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
      
      console.log("Gemini API successfully initialized");
    }
  } catch (err) {
    console.error("Failed to initialize Gemini API:", err);
    // Leave genAI and model as null to trigger fallback handling
  }
}

export type StructuredRequest = {
  startLocation: string | null;
  destinations: string[];
  fixedTimes: Array<{
    location: string;
    time: string;  // Format: "HH:MM" (24-hour)
    type?: string; // e.g., "restaurant", "cafe"
    // Additional parameters for enhanced search
    searchTerm?: string;
    keywords?: string[];
    minRating?: number;
  }>;
  preferences: {
    type?: string;
    requirements?: string[];
  };
  // Enhanced response from Gemini with detailed activity information
  activities?: Array<{
    description: string;
    location: string;
    time: string;
    searchParameters: {
      searchTerm: string;
      type: string;
      keywords: string[];
      minRating: number;
      requireOpenNow: boolean;
    };
    requirements: string[];
  }>;
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

/**
 * Parse a natural language itinerary request into structured data
 * 
 * @param query User's natural language request
 * @returns StructuredRequest object with parsed locations, activities and preferences
 */
export async function parseItineraryRequest(query: string): Promise<StructuredRequest> {
  // Initialize basic fallback structure with direct extraction methods
  const extractedLocations = extractLocations(query);
  const extractedActivities = extractActivities(query);
  
  // Extract time from the query directly for 6PM, 9AM style inputs
  const timeRegex = /(\d{1,2})\s*(am|pm)/i;
  const timeMatch = query.match(timeRegex);
  let timeFromQuery = null;
  
  if (timeMatch) {
    const [_, hour, meridian] = timeMatch;
    const parsedHour = parseInt(hour);
    const hourIn24 = meridian.toLowerCase() === 'pm' && parsedHour < 12 ? parsedHour + 12 : parsedHour;
    timeFromQuery = `${hourIn24.toString().padStart(2, '0')}:00`;
  }

  // Create fallback structure that will be used if AI processing fails
  const fallbackStructure: StructuredRequest = {
    startLocation: null,
    destinations: extractedLocations.map(loc => loc.name),
    fixedTimes: extractedActivities.length > 0 ? 
      extractedActivities.map(activity => {
        const location = extractedLocations[0]?.name || "London";
        
        // Try to extract time from the query directly if it's a simple time reference
        const time = timeFromQuery || activity.timeContext?.preferredTime || 
              (activity.type === 'breakfast' ? '09:00' : 
               activity.type === 'lunch' ? '13:00' : 
               activity.type === 'dinner' ? '19:00' : '12:00');
        
        return {
          location,
          time,
          type: activity.venueType || activity.type,
          searchTerm: activity.naturalDescription
        };
      }) : 
      // If no activities extracted but we found a time, create an entry with that time
      timeFromQuery ? [{
        location: extractedLocations[0]?.name || "London",
        time: timeFromQuery,
        type: 'activity',
        searchTerm: query
      }] : [],
    preferences: {
      requirements: extractedActivities
        .filter(a => a.requirements)
        .flatMap(a => a.requirements || [])
    }
  };

  // Skip Gemini processing if the feature is disabled or model initialization failed
  if (!isFeatureEnabled("AI_PROCESSING") || !model) {
    console.log("AI processing skipped - using basic fallback structure");
    
    // Even though we're using the fallback structure, let's improve it with Google Maps verification
    // This will help improve the location data quality even without Gemini
    try {
      const { validateAndNormalizeLocation, processLocationWithAIAndMaps } = require('./mapGeocoding');
      
      // Process each destination
      if (fallbackStructure.destinations.length > 0) {
        const validatedDestinations = await Promise.all(
          fallbackStructure.destinations.map(async (destination: string) => {
            return await validateAndNormalizeLocation(destination);
          })
        );
        
        fallbackStructure.destinations = validatedDestinations.filter(Boolean);
      }
      
      // Process each fixed time location
      if (fallbackStructure.fixedTimes.length > 0) {
        for (const fixedTime of fallbackStructure.fixedTimes) {
          // Only process if location is explicitly set to "London" (generic) but searchTerm contains hints
          if (fixedTime.location === "London" && fixedTime.searchTerm) {
            const enhancedLocation = await processLocationWithAIAndMaps(fixedTime.searchTerm);
            if (enhancedLocation && enhancedLocation !== "London") {
              fixedTime.location = enhancedLocation;
              console.log(`Enhanced fixed time location from "London" to "${enhancedLocation}"`);
            }
          } else if (fixedTime.location) {
            const validatedLocation = await validateAndNormalizeLocation(fixedTime.location);
            if (validatedLocation) {
              fixedTime.location = validatedLocation;
            }
          }
        }
      }
    } catch (error) {
      console.error("Error during location enhancement:", error);
      // Continue with original fallback structure if enhancement fails
    }
    
    return fallbackStructure;
  }

  try {
    // Then use our comprehensive Gemini prompt for enhanced understanding
    const prompt = `
You are a London travel planning expert with deep knowledge of London's geography, neighborhoods, and venues. Analyze this request carefully:

"${query}"

TASK: Provide a complete interpretation for creating a London itinerary with Google Places API integration.

Step 1: Identify all London locations with full context:
- Distinguish between neighborhoods (Soho, Mayfair), landmarks (British Museum), and transport hubs (King's Cross)
- For ambiguous references, clarify which specific London location is meant
- Recognize colloquial area names and local terminology (The City, West End, etc.)

Step 2: Understand all activities with venue-specific details:
- Extract explicit activities (coffee, lunch, museum visit)
- Infer implied activities based on context ("something nice" → what specifically?)
- Capture qualitative requirements (quiet, fancy, historic, family-friendly)
- Note when activities are vague and need appropriate venue suggestions

Step 3: Interpret time references carefully:
- Convert all time formats to 24-hour format
- Handle time ranges correctly (e.g., "between 2-4pm" → 14:00-16:00)
- Interpret relative times (morning, afternoon, evening) 
- Avoid creating duplicate activities for similar times

Step 4: Create optimal Google Places search parameters:
- Provide the exact search term to use (e.g., "specialty coffee shop" rather than just "coffee")
- Specify the correct Google Places 'type' parameter (cafe, restaurant, museum, etc.)
- Suggest additional keywords that will improve search relevance
- Recommend minimum rating thresholds based on quality expectations

RETURN ONLY this JSON structure:
{
  "startLocation": string | null,
  "destinations": string[],
  "activities": [
    {
      "description": string, // Original activity description from request
      "location": string, // Where this should happen
      "time": string, // Time in 24h format or period name like "afternoon"
      "searchParameters": { // CRITICAL - Parameters for Google Places API
        "searchTerm": string, // Optimized search term (e.g., "quiet cafe with workspace")
        "type": string, // Google Places API type parameter (e.g., "cafe", "restaurant")
        "keywords": string[], // Additional keywords to improve search
        "minRating": number, // Recommended minimum rating (1.0-5.0)
        "requireOpenNow": boolean // Whether time constraints require the venue to be open now
      },
      "requirements": string[] // Special requirements like "quiet", "outdoor seating"
    }
  ],
  "preferences": {
    "venueQualities": string[], // Qualities applying to all venues (upscale, budget, etc.)
    "restrictions": string[] // Restrictions applying to all venues (no chains, etc.)
  }
}`;

    try {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      if (!responseText || responseText.trim() === '') {
        throw new Error("Empty response received from language model");
      }
    
      // Clean and parse the response
      let cleanedContent = responseText.trim();
      
      // Remove markdown code block syntax if present
      if (cleanedContent.startsWith('```json') || cleanedContent.startsWith('```')) {
        const firstBlockEnd = cleanedContent.indexOf('\n');
        const lastBlockStart = cleanedContent.lastIndexOf('```');
        
        if (firstBlockEnd !== -1) {
          cleanedContent = cleanedContent.substring(firstBlockEnd + 1);
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
      
      // Remove comments from JSON
      cleanedContent = cleanedContent
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');
      
      // Parse the JSON response with validation
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(cleanedContent);
      } catch (error) {
        // Try to extract JSON by looking for { and }
        const jsonStart = cleanedContent.indexOf('{');
        const jsonEnd = cleanedContent.lastIndexOf('}');
        
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          const extractedJson = cleanedContent.substring(jsonStart, jsonEnd + 1);
          parsedResponse = JSON.parse(extractedJson);
        } else {
          throw new Error("Could not find valid JSON object markers");
        }
      }

      // Validate response structure
      if (!parsedResponse || typeof parsedResponse !== 'object') {
        throw new Error("Invalid response structure from language model");
      }

      // Define the expected type for our fixed times entries
      // This should match the fixedTimes structure in the StructuredRequest interface
type FixedTimeEntry = {
        location: string;
        time: string;
        type?: string;
        // Additional search parameters for richer venue search
        searchTerm?: string;
        keywords?: string[];
        minRating?: number;
      };

      // Convert Gemini's parsed output to StructuredRequest
      const parsed: StructuredRequest = {
        startLocation: parsedResponse.startLocation,
        destinations: parsedResponse.destinations || [],
        fixedTimes: [],
        preferences: {
          type: undefined, // Will extract from activities or searchParameters
          requirements: []
        },
        // Include the activities array directly from Gemini's output
        activities: parsedResponse.activities && Array.isArray(parsedResponse.activities) ? 
                   parsedResponse.activities : []
      };
      
      // Extract activity type from the first activity's searchParameters if available
      if (parsedResponse.activities && 
          Array.isArray(parsedResponse.activities) && 
          parsedResponse.activities.length > 0 &&
          parsedResponse.activities[0].searchParameters &&
          parsedResponse.activities[0].searchParameters.type) {
        parsed.preferences.type = parsedResponse.activities[0].searchParameters.type;
      }
      
      // Process enhanced preferences structure
      if (parsedResponse.preferences) {
        // Ensure preferences.requirements is initialized as an array
        parsed.preferences.requirements = parsed.preferences.requirements || [];
        
        // Create a new array for collecting all requirements
        const requirementsList: string[] = [];
        
        // Handle venue qualities as requirements
        if (parsedResponse.preferences.venueQualities && Array.isArray(parsedResponse.preferences.venueQualities)) {
          for (const quality of parsedResponse.preferences.venueQualities) {
            requirementsList.push(quality);
          }
        }
        
        // Handle restrictions as requirements
        if (parsedResponse.preferences.restrictions && Array.isArray(parsedResponse.preferences.restrictions)) {
          for (const restriction of parsedResponse.preferences.restrictions) {
            requirementsList.push(restriction);
          }
        }
        
        // Still handle legacy format
        if (parsedResponse.preferences.requirements && Array.isArray(parsedResponse.preferences.requirements)) {
          for (const req of parsedResponse.preferences.requirements) {
            requirementsList.push(req);
          }
        }
        
        parsed.preferences.requirements = requirementsList;
      }

      // Process activities from the enhanced Gemini response
      if (parsedResponse.activities && Array.isArray(parsedResponse.activities)) {
        for (const activity of parsedResponse.activities) {
          if (activity && typeof activity === 'object' && 'location' in activity && 'time' in activity) {
            // Validate and normalize the location
            const location = findLocation(String(activity.location));
            if (location) {
              // Parse time correctly to maintain 24-hour format
              let timeValue = String(activity.time);
              
              // Handle time ranges (15:00-17:00)
              if (timeValue.includes('-')) {
                timeValue = timeValue.split('-')[0]; // Take the start time
              }
              
              if (timeValue.includes(':')) {
                // Properly preserve 24-hour format (don't convert 15:00 to 03:00)
                const [hours, minutes] = timeValue.split(':').map(Number);
                timeValue = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
              } else {
                // Handle relative times
                timeValue = expandRelativeTime(timeValue);
              }
              
              // Get the activity type from searchParameters or use a default
              const activityType = activity.searchParameters?.type || 
                                  (activity.description ? activity.description.split(' ')[0] : undefined);
              
              // Debug log to track search parameters before adding to fixedTimes
              console.log(`Adding activity with search parameters:`, {
                location: activity.location, // Use original location from activity
                activityDescription: activity.description,
                searchTerm: activity.searchParameters?.searchTerm,
                type: activityType,
                keywords: activity.searchParameters?.keywords,
                minRating: activity.searchParameters?.minRating
              });
              
              parsed.fixedTimes.push({
                location: activity.location, // Use original location from activity
                time: timeValue,
                // Use the venue type from searchParameters as the activity type
                type: activityType,
                // Store the rich search parameters - ensure they're copied correctly
                searchTerm: activity.searchParameters?.searchTerm,
                keywords: Array.isArray(activity.searchParameters?.keywords) ? 
                         [...activity.searchParameters.keywords] : // Make a copy of the array
                         undefined,
                minRating: typeof activity.searchParameters?.minRating === 'number' ? 
                         activity.searchParameters.minRating : 
                         undefined
              });
            }
          }
        }
      }
      
      // Fallback to legacy format if activities array isn't present
      if (parsed.fixedTimes.length === 0 && parsedResponse.fixedTimes && Array.isArray(parsedResponse.fixedTimes)) {
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
              
              // Add a debug log for the legacy format too
              console.log(`Adding legacy format activity:`, {
                location: location.name,
                time: timeValue,
                type: ft.type
              });

              parsed.fixedTimes.push({
                location: ft.location, // Use the original location directly without normalization
                time: timeValue,
                // Preserve the original activity type from the response
                type: ft.type ? String(ft.type) : undefined,
                // Include any search parameters if available
                searchTerm: ft.searchTerm ? String(ft.searchTerm) : undefined,
                keywords: Array.isArray(ft.keywords) ? [...ft.keywords] : undefined,
                minRating: typeof ft.minRating === 'number' ? ft.minRating : undefined
              });
            }
          }
        }
      }

      // Critical fix: If no startLocation but we have activities, use the first activity's location
      if (!parsed.startLocation && parsed.activities && parsed.activities.length > 0) {
        parsed.startLocation = parsed.activities[0].location;
        console.log(`No startLocation provided, using first activity location: ${parsed.startLocation}`);
      }
      
      // Backup: If we have destinations but no startLocation, use first destination
      if (!parsed.startLocation && parsed.destinations.length > 0) {
        const firstDestination = parsed.destinations.shift();
        if (firstDestination) {
          parsed.startLocation = firstDestination;
          console.log(`Using first destination as startLocation: ${parsed.startLocation}`);
        }
      }
      
      // Final check to ensure we have a startLocation
      if (!parsed.startLocation && parsed.fixedTimes.length > 0) {
        parsed.startLocation = parsed.fixedTimes[0].location;
        console.log(`Using first fixed time location as startLocation: ${parsed.startLocation}`);
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
            
            // Handle ambiguous times - if no AM/PM is specified, make intelligent assumptions
            // Assume 1-7 without meridian is PM (common for evening activities)
            const isPM = meridian === 'pm' || 
                        (meridian === null && hour >= 1 && hour <= 7);
            const isAM = meridian === 'am' || 
                        (meridian === null && (hour === 12 || hour >= 8 && hour <= 11));
            
            let hour24 = hour;
            if (isPM && hour < 12) hour24 += 12;
            if (isAM && hour === 12) hour24 = 0;
            
            standardizedTime = `${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          } else if (match[2]) {
            // With preposition case ("at 3pm")
            const hour = parseInt(match[2]);
            const minute = match[3] ? parseInt(match[3]) : 0;
            const meridian = match[4]?.toLowerCase().includes('p') ? 'pm' : 
                            match[4]?.toLowerCase().includes('a') ? 'am' : null;
            
            // Handle ambiguous times - if no AM/PM is specified, make intelligent assumptions
            // Assume 1-7 without meridian is PM (common for evening activities)
            const isPM = meridian === 'pm' || 
                        (meridian === null && hour >= 1 && hour <= 7);
            const isAM = meridian === 'am' || 
                        (meridian === null && (hour === 12 || hour >= 8 && hour <= 11));
            
            let hour24 = hour;
            if (isPM && hour < 12) hour24 += 12;
            if (isAM && hour === 12) hour24 = 0;
            
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
      
      // Sort fixed times chronologically
      parsed.fixedTimes.sort((a, b) => {
        if (!a.time) return -1;
        if (!b.time) return 1;
        return a.time.localeCompare(b.time);
      });

      return parsed;

    } catch (error) {
      // Log error details without excessive output
      console.error("Error during Gemini API processing:", {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        query: query.substring(0, 100) + (query.length > 100 ? '...' : '')
      });
      
      return fallbackStructure;
    }
  } catch (error) {
    // Log error details while avoiding excessive console output
    console.error("Fatal error in parseItineraryRequest:", {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
      query: query.substring(0, 100) + (query.length > 100 ? '...' : '')
    });

    return fallbackStructure;
  }
}