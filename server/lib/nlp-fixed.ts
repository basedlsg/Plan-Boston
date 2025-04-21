import { z } from "zod";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import type { PlaceDetails } from "@shared/schema";
import { StructuredRequest } from "@shared/types";
import { nycAreas } from "../data/new-york-areas";
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
import { processWithGemini, StructuredRequest as GeminiStructuredRequest } from './geminiProcessor';
import { validateAndNormalizeLocation, processLocationWithAIAndMaps } from './mapGeocoding';
import { parseAndNormalizeTime } from './timeUtils';
import { format, parseISO } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

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

// Using the imported StructuredRequest interface from shared/types.ts

// Define fixed time entry type for use in parsing
type FixedTimeEntry = {
  location: string;
  time: string;
  type?: string;
  // Additional search parameters for richer venue search
  searchTerm?: string;
  keywords?: string[];
  minRating?: number;
  displayTime?: string; // New property for formatted display time in NYC timezone
  searchPreference?: string; // Specific user preference for the venue (e.g., "sandwich place")
};

/**
 * Helper function to correctly convert a time string into NYC timezone-aware values
 * 
 * @param timeString Time string in 24-hour format (HH:MM)
 * @returns Object containing the ISO timestamp and formatted display time
 */
function convertTimeStringToNYC(timeString: string): { isoTimestamp: string, displayTime: string } {
  const timeZone = 'America/New_York';
  const [hours, minutes] = timeString.split(':').map(Number);
  
  // Get current date in NYC time zone to ensure proper DST handling
  const now = new Date();
  const nycTime = toZonedTime(now, timeZone);
  
  // Extract date components from NYC time
  const year = nycTime.getFullYear();
  const month = nycTime.getMonth(); // 0-indexed in JavaScript
  const day = nycTime.getDate();
  
  // Create a new date with the parsed time components but NYC date
  const localDate = new Date(year, month, day, hours, minutes);
  
  // Calculate UTC equivalent by accounting for timezone offset
  const utcDate = new Date(localDate.getTime() + (localDate.getTimezoneOffset() * 60000));
  
  // Format for output
  const isoTimestamp = utcDate.toISOString();
  const displayTime = formatInTimeZone(localDate, timeZone, 'h:mm a');
  
  return { isoTimestamp, displayTime };
}

/**
 * Convert Gemini structured request to the application's expected format
 */
function convertGeminiToAppFormat(geminiResult: GeminiStructuredRequest | null): StructuredRequest | null {
  console.log("Converting Gemini result to app format:", JSON.stringify(geminiResult, null, 2));
  
  if (!geminiResult) {
    return null;
  }
  
  // Initialize the result structure
  const appFormatRequest: StructuredRequest = {
    startLocation: geminiResult.startLocation || "Midtown", // Default to Midtown Manhattan
    destinations: [],
    fixedTimes: [],
    preferences: {
      type: undefined,
      requirements: []
    }
  };
  
  // Inspect the venuePreference data in the Gemini response
  if (geminiResult.fixedTimeEntries && geminiResult.fixedTimeEntries.length > 0) {
    geminiResult.fixedTimeEntries.forEach(entry => {
      if (entry.searchParameters?.venuePreference) {
        console.log(`Found raw venuePreference in Gemini fixed time entry: "${entry.searchParameters.venuePreference}" for activity "${entry.activity}"`);
      }
    });
  }
  
  // Create a map to track unique activities by location and similar activity text
  // This will help us avoid duplicates from both fixedTimeEntries and flexibleTimeEntries
  const activityMap = new Map<string, FixedTimeEntry>();
  
  // Helper function to determine the most specific activity type
  const determineActivityType = (activityText: string): string => {
    const activityLower = activityText.toLowerCase();
    
    if (activityLower.includes('museum') || activityLower.includes('gallery') || activityLower.includes('exhibition')) {
      return "museum";
    } else if (activityLower.includes('lunch') || activityLower.includes('dinner') || 
               activityLower.includes('breakfast') || activityLower.includes('eat') || 
               activityLower.includes('restaurant') || activityLower.includes('food')) {
      return "restaurant";
    } else if (activityLower.includes('coffee') || activityLower.includes('cafe')) {
      return "cafe";
    } else if (activityLower.includes('park') || activityLower.includes('garden')) {
      return "park";
    } else if (activityLower.includes('shop') || activityLower.includes('store') || activityLower.includes('mall')) {
      return "shopping_mall";
    } else {
      return "attraction";
    }
  };
  
  // Helper function to create a unique key for an activity at a location
  const createActivityKey = (location: string, activityText: string): string => {
    // Normalize the location and activity text to avoid case-sensitive duplicates
    const normalizedLocation = location.toLowerCase();
    const normalizedActivity = activityText.toLowerCase();
    
    return `${normalizedLocation}|${determineActivityType(normalizedActivity)}`;
  };
  
  // Process fixed time entries if present
  if (geminiResult.fixedTimeEntries && Array.isArray(geminiResult.fixedTimeEntries)) {
    console.log("Raw fixed time entries from Gemini:", JSON.stringify(geminiResult.fixedTimeEntries, null, 2));
    for (const entry of geminiResult.fixedTimeEntries) {
      if (entry && typeof entry === 'object' && entry.location && entry.time) {
        // Parse time expressions using our enhanced timeUtils
        let timeValue = entry.time;
        let displayTime = '';
        
        // Process time values with our improved parser
        if (typeof timeValue === 'string') {
          // Parse times like "noon", "around 3 PM", etc.
          const originalTime = timeValue;
          timeValue = parseAndNormalizeTime(timeValue);
          console.log(`Fixed time entry: Normalized time from "${originalTime}" to "${timeValue}"`);
          
          // Convert the normalized time string (HH:MM) to NYC timezone-aware values
          const { isoTimestamp, displayTime: formattedTime } = convertTimeStringToNYC(timeValue);
          
          // Store the ISO timestamp for backend processing
          timeValue = isoTimestamp;
          displayTime = formattedTime;
          
          console.log(`Correctly interpreted time "${originalTime}" as NYC time: ${displayTime} (${timeValue})`);
        }
        
        // Determine the most appropriate activity type
        const activityType = entry.searchParameters?.venueType || determineActivityType(entry.activity);
        
        // Create a key for this activity
        const activityKey = createActivityKey(entry.location, entry.activity);
        
        // Check if there's a specific search preference from multiple possible locations
        let searchPreference: string | undefined = undefined;
        
        // First check for the venue preference at the top level of the Gemini response object
        if (geminiResult.venuePreference) {
          searchPreference = geminiResult.venuePreference;
          console.log(`Found top-level venue preference in Gemini response: "${searchPreference}" for activity: ${entry.activity}`);
        }
        // Then check for the entry-specific venuePreference field directly
        else if (entry.venuePreference) {
          searchPreference = entry.venuePreference;
          console.log(`Found entry-level venue preference: "${searchPreference}" for activity: ${entry.activity}`);
        }
        // Then check if searchParameters.venuePreference exists
        else if (entry.searchParameters?.venuePreference) {
          searchPreference = entry.searchParameters.venuePreference;
          console.log(`Found venue preference in searchParameters: "${searchPreference}" for activity: ${entry.activity}`);
        }
        
        // Log whether we found a preference or not, for debugging
        if (!searchPreference) {
          console.log(`No venue preference found in Gemini data for activity: ${entry.activity}`);
        }
        
        // Store in our map, potentially overwriting less specific entries
        activityMap.set(activityKey, {
          location: entry.location,
          time: timeValue,
          type: activityType,
          searchTerm: entry.activity,
          keywords: entry.searchParameters?.specificRequirements || undefined,
          minRating: 4.0, // Default to high quality
          displayTime: displayTime, // Add the display time for the frontend
          searchPreference: searchPreference // Add user's specific venue preference
        });
        
        console.log(`Processed fixed time entry: ${entry.activity} at ${entry.location}, time: ${timeValue}, type: ${activityType}`);
      }
    }
  }
  
  // Process flexible time entries - THIS IS THE KEY FIX for the correct timezone handling
  if (geminiResult.flexibleTimeEntries && Array.isArray(geminiResult.flexibleTimeEntries)) {
    console.log("Raw flexible time entries from Gemini:", JSON.stringify(geminiResult.flexibleTimeEntries, null, 2));
    
    for (const entry of geminiResult.flexibleTimeEntries) {
      if (entry && typeof entry === 'object' && entry.location) {
        // Convert time formats
        let timeValue = entry.time || "12:00";
        let displayTime = '';
        
        // Handle time periods using the timeUtils functions
        if (typeof timeValue === 'string') {
          // This will handle "morning", "afternoon", "evening", "night"
          // as well as "around noon", "around 3 PM", etc.
          const originalTime = timeValue;
          timeValue = parseAndNormalizeTime(timeValue);
          console.log(`Normalized time from "${originalTime}" to "${timeValue}"`);
          
          // Convert the normalized time string (HH:MM) to NYC timezone-aware values
          const { isoTimestamp, displayTime: formattedTime } = convertTimeStringToNYC(timeValue);
          
          // Store the ISO timestamp for backend processing
          timeValue = isoTimestamp;
          displayTime = formattedTime;
          
          console.log(`Correctly interpreted time "${originalTime}" as NYC time: ${displayTime} (${timeValue})`);
        }
        
        // Determine the most appropriate activity type
        const activityType = determineActivityType(entry.activity);
        
        // Create a key for this activity
        const activityKey = createActivityKey(entry.location, entry.activity);
        
        // Check if there's a specific search preference from multiple possible locations
        let searchPreference: string | undefined = undefined;
        
        // First check for the venue preference at the top level of the Gemini response object
        if (geminiResult.venuePreference) {
          searchPreference = geminiResult.venuePreference;
          console.log(`Found top-level venue preference in Gemini response: "${searchPreference}" for flexible activity: ${entry.activity}`);
        }
        // Then check for the entry-specific venuePreference field directly
        else if (entry.venuePreference) {
          searchPreference = entry.venuePreference;
          console.log(`Found entry-level venue preference (flexible): "${searchPreference}" for activity: ${entry.activity}`);
        }
        // Then check if searchParameters.venuePreference exists
        else if (entry.searchParameters?.venuePreference) {
          searchPreference = entry.searchParameters.venuePreference;
          console.log(`Found venue preference in searchParameters (flexible): "${searchPreference}" for activity: ${entry.activity}`);
        }
        
        // Log whether we found a preference or not, for debugging
        if (!searchPreference) {
          console.log(`No venue preference found in Gemini data for flexible activity: ${entry.activity}`);
        }
        
        // Only add if we don't already have this activity, or if we're adding a more specific type
        if (!activityMap.has(activityKey)) {
          activityMap.set(activityKey, {
            location: entry.location,
            time: timeValue,
            type: activityType,
            searchTerm: entry.activity,
            minRating: 4.0, // Default to high quality
            displayTime: displayTime, // Add the display time for the frontend
            searchPreference: searchPreference // Add user's specific venue preference
          });
          
          console.log(`Processed flexible time entry: ${entry.activity} at ${entry.location}, time: ${timeValue}, type: ${activityType}`);
        }
      }
    }
  }
  
  // Convert our map of unique activities to the fixedTimes array
  appFormatRequest.fixedTimes = Array.from(activityMap.values());
  console.log(`Final de-duplicated activities count: ${appFormatRequest.fixedTimes.length}`);
  
  // If we have no start location but have activities, use the first activity location
  if (!appFormatRequest.startLocation && appFormatRequest.fixedTimes.length > 0) {
    appFormatRequest.startLocation = appFormatRequest.fixedTimes[0].location;
    console.log(`No startLocation provided, using first activity location: ${appFormatRequest.startLocation}`);
  }
  
  // Process other preferences if available
  if (geminiResult.preferences) {
    // Extract budget preferences if available
    if (geminiResult.preferences.budget) {
      appFormatRequest.preferences.type = geminiResult.preferences.budget;
    }
    
    // Extract requirements/restrictions if available
    if (Array.isArray(geminiResult.specialRequests)) {
      appFormatRequest.preferences.requirements = geminiResult.specialRequests;
    }
  }
  
  // Sort fixed times chronologically
  appFormatRequest.fixedTimes.sort((a, b) => {
    if (!a.time) return -1;
    if (!b.time) return 1;
    return a.time.localeCompare(b.time);
  });
  
  // Create destinations array from fixed time locations
  const uniqueLocations = new Set<string>();
  appFormatRequest.fixedTimes.forEach(entry => {
    if (entry.location && entry.location !== "New York" && entry.location !== "NYC" && entry.location !== "Midtown") {
      uniqueLocations.add(entry.location);
    }
  });
  
  appFormatRequest.destinations = Array.from(uniqueLocations);
  
  console.log("Converted app format request:", JSON.stringify(appFormatRequest, null, 2));
  return appFormatRequest;
}

// Extract locations with confidence scores
function extractLocations(text: string): LocationContext[] {
  const locations: LocationContext[] = [];

  // Split text into potential location phrases
  const phrases = text.split(/[,.]|\s+(?:then|and|to|at)\s+/);

  for (const phrase of phrases) {
    // Look for common NYC street name patterns like "Wall St" or "5th Ave"
    const streetMatch = phrase.match(/\b(wall\s*st|fifth\s*ave|5th\s*avenue|broadway|times\s*square|madison\s*ave|lexington\s*ave|park\s*ave|canal\s*st|mott\s*st|mulberry\s*st|bowery|houston\s*st|bleecker\s*st|christopher\s*st|west\s*4th|42nd\s*st|34th\s*st|14th\s*st|canal\s*st|grand\s*st|delancey\s*st)\b/i);
    if (streetMatch?.[1]) {
      const streetName = streetMatch[1].trim();
      console.log(`Found NYC street reference: "${streetName}"`);
      
      // Map common street abbreviations to full names
      const normalizedStreet = streetName.toLowerCase()
        .replace(/wall\s*st/, "Wall Street")
        .replace(/5th\s*ave/, "Fifth Avenue")
        .replace(/fifth\s*ave/, "Fifth Avenue")
        .replace(/madison\s*ave/, "Madison Avenue")
        .replace(/lexington\s*ave/, "Lexington Avenue")
        .replace(/park\s*ave/, "Park Avenue")
        .replace(/canal\s*st/, "Canal Street")
        .replace(/mott\s*st/, "Mott Street")
        .replace(/mulberry\s*st/, "Mulberry Street")
        .replace(/houston\s*st/, "Houston Street")
        .replace(/bleecker\s*st/, "Bleecker Street")
        .replace(/christopher\s*st/, "Christopher Street")
        .replace(/west\s*4th/, "West 4th Street")
        .replace(/42nd\s*st/, "42nd Street")
        .replace(/34th\s*st/, "34th Street")
        .replace(/14th\s*st/, "14th Street")
        .replace(/grand\s*st/, "Grand Street")
        .replace(/delancey\s*st/, "Delancey Street");
      
      locations.push({
        name: normalizedStreet,
        confidence: 0.9,
        type: "street"
      });
      continue;
    }
    
    // Look for location indicators with prepositions (in, at, near, from)
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
  // We've already imported processWithGemini from './geminiProcessor'
  
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
        const location = extractedLocations[0]?.name || "Midtown";
        
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
        location: extractedLocations[0]?.name || "Midtown",
        time: timeFromQuery,
        type: 'activity',
        searchTerm: query
      }] : [],
    preferences: {
      type: null,
      requirements: []
    }
  };

  try {
    // First attempt: Use the new Gemini processor
    console.log("Attempting to process query with new Gemini processor");
    const rawGeminiResult = await processWithGemini(query);
    
    if (rawGeminiResult) {
      console.log("Successfully processed query with new Gemini processor");
      console.log("Raw Gemini API response:", JSON.stringify(rawGeminiResult, null, 2));
      
      // Convert from Gemini processor format to application format
      const geminiResult = convertGeminiToAppFormat(rawGeminiResult);
      
      if (geminiResult) {
        // We don't need to process flexible time entries here again.
        // The convertGeminiToAppFormat function we just updated already 
        // handles both fixedTimeEntries and flexibleTimeEntries with proper de-duplication.
        console.log("Using optimized Gemini result that was converted by convertGeminiToAppFormat function");
        console.log(`Gemini result contains ${geminiResult.fixedTimes.length} de-duplicated activities`);
        
        // Sort fixed times chronologically if they exist
        if (geminiResult.fixedTimes) {
          geminiResult.fixedTimes.sort((a, b) => {
            if (!a.time) return -1;
            if (!b.time) return 1;
            return a.time.localeCompare(b.time);
          });
        }
        
        // Apply location validation and normalization when possible
        try {
          // Using imported functions directly
          for (const destination of geminiResult.destinations) {
            const validatedLocation = await validateAndNormalizeLocation(destination);
            // If validation succeeds, replace the original location with the validated one
            if (validatedLocation) {
              console.log(`Validated "${destination}" as neighborhood: "${validatedLocation}"`);
              // Update it in-place
              const index = geminiResult.destinations.indexOf(destination);
              if (index !== -1) {
                geminiResult.destinations[index] = validatedLocation;
              }
            }
          }
          
          // Validate fixed time locations
          if (geminiResult.fixedTimes) {
            for (const fixedTime of geminiResult.fixedTimes) {
              if (fixedTime.location) {
                // Try more advanced mapping with AI first if it's a vague location
                if (fixedTime.location.toLowerCase() === 'central manhattan' || 
                    fixedTime.location.toLowerCase() === 'central nyc' || 
                    fixedTime.location.toLowerCase() === 'central new york') {
                  
                  const enhancedLocation = await processLocationWithAIAndMaps(fixedTime.location, fixedTime.searchTerm);
                  if (enhancedLocation && enhancedLocation !== "New York" && enhancedLocation !== "NYC" && enhancedLocation !== "Midtown") {
                    fixedTime.location = enhancedLocation;
                    console.log(`Enhanced fixed time location from generic to "${enhancedLocation}"`);
                  }
                } else if (fixedTime.location) {
                  const validatedLocation = await validateAndNormalizeLocation(fixedTime.location);
                  if (validatedLocation) {
                    fixedTime.location = validatedLocation;
                  }
                }
              }
            }
          }
        } catch (error) {
          console.warn("Location enhancement skipped due to error:", error);
        }
        
        // Debug the final processed output
        console.log("Final processed Gemini result:", JSON.stringify(geminiResult, null, 2));
        return geminiResult;
      }
    }
    
    // If the new Gemini processor isn't available or fails, fall back to the original method
    console.log("New Gemini processor unavailable or failed, falling back to original method");
    
    // Skip Gemini processing if the feature is disabled or model initialization failed
    if (!isFeatureEnabled("AI_PROCESSING") || !model) {
      console.log("AI processing skipped - using basic fallback structure");
      
      // Even though we're using the fallback structure, let's improve it with Google Maps verification
      // This will help improve the location data quality even without Gemini
      for (let i = 0; i < fallbackStructure.destinations.length; i++) {
        const destination = fallbackStructure.destinations[i];
        const validated = await validateAndNormalizeLocation(destination);
        if (validated) {
          fallbackStructure.destinations[i] = validated;
        }
      }
      
      // Also validate fixed time locations
      for (const fixedTime of fallbackStructure.fixedTimes) {
        const validated = await validateAndNormalizeLocation(fixedTime.location);
        if (validated) {
          fixedTime.location = validated;
        }
      }
      
      return fallbackStructure;
    }

    // Still here? Use the fallback structure
    return fallbackStructure;

  } catch (error) {
    console.error("Error during NLP processing:", error);
    return fallbackStructure;
  }
}

// Re-export everything from this file
export * from './nlp';