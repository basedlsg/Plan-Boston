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
import { format as formatDateFns } from 'date-fns';
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
          
          // Convert the normalized time string (HH:MM) to a proper timezone-aware datetime
          const timeZone = 'America/New_York';
          
          // Create a date object for today with the desired time components
          const now = new Date();
          const year = now.getFullYear();
          const month = now.getMonth(); // date-fns uses 0-indexed months
          const day = now.getDate();
          
          // Extract hours and minutes from the normalized time
          const [hours, minutes] = timeValue.split(':').map(Number);
          
          // Create a date object in local time zone
          const localDate = new Date(year, month, day, hours, minutes, 0, 0);
          
          // Convert this to a NYC time zone object
          const nycDate = toZonedTime(localDate, timeZone);
          
          // Generate the ISO timestamp for storage/backend use
          const isoTimestamp = nycDate.toISOString();
          
          // Generate the formatted display time string for NYC timezone
          displayTime = formatInTimeZone(nycDate, timeZone, 'h:mm a');
          
          // Store the ISO timestamp for backend processing
          timeValue = isoTimestamp;
          
          console.log(`Converted time "${originalTime}" to NYC time: ${displayTime} (${timeValue})`);
        }
        
        // Determine the most appropriate activity type
        const activityType = entry.searchParameters?.venueType || determineActivityType(entry.activity);
        
        // Create a key for this activity
        const activityKey = createActivityKey(entry.location, entry.activity);
        
        // Check if there's a specific search preference from multiple possible locations
        let searchPreference: string | undefined = undefined;
        
        // First check for the new top-level venuePreference field we added
        if (entry.venuePreference) {
          searchPreference = entry.venuePreference;
          console.log(`Found venue preference in top-level field: "${searchPreference}"`);
        }
        // Then check if searchParameters.venuePreference exists
        else if (entry.searchParameters?.venuePreference) {
          searchPreference = entry.searchParameters.venuePreference;
          console.log(`Found venue preference in searchParameters: "${searchPreference}"`);
        }
        // Finally try to extract from activity description if it contains venue-type keywords
        else {
          const activityDesc = entry.activity.toLowerCase();
          const venueKeywords = [
            "authentic", "traditional", "hipster", "trendy", "upscale", 
            "casual", "artisanal", "specialty", "boutique", "unique"
          ];
          
          for (const keyword of venueKeywords) {
            if (activityDesc.includes(keyword)) {
              // Extract possible venue preference from activity description
              const words = activityDesc.split(' ');
              const keywordIndex = words.findIndex(w => w.includes(keyword));
              
              if (keywordIndex !== -1 && keywordIndex < words.length - 1) {
                // Take up to 4 words after the keyword to capture the venue preference
                const preference = words.slice(keywordIndex, keywordIndex + 4).join(' ');
                console.log(`Extracted venue preference from activity description: "${preference}"`);
                searchPreference = preference;
                break;
              }
            }
          }
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
  
  // Process flexible time entries - THIS IS THE KEY FIX for the British Museum/Soho case
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
          
          // Convert the normalized time string (HH:MM) to a proper timezone-aware datetime
          const timeZone = 'America/New_York';
          
          // Create a date object for today with the desired time components
          const now = new Date();
          const year = now.getFullYear();
          const month = now.getMonth(); // date-fns uses 0-indexed months
          const day = now.getDate();
          
          // Extract hours and minutes from the normalized time
          const [hours, minutes] = timeValue.split(':').map(Number);
          
          // Create a date object in local time zone
          const localDate = new Date(year, month, day, hours, minutes, 0, 0);
          
          // Convert this to a NYC time zone object
          const nycDate = toZonedTime(localDate, timeZone);
          
          // Generate the ISO timestamp for storage/backend use
          const isoTimestamp = nycDate.toISOString();
          
          // Generate the formatted display time string for NYC timezone
          displayTime = formatInTimeZone(nycDate, timeZone, 'h:mm a');
          
          // Store the ISO timestamp for backend processing
          timeValue = isoTimestamp;
          
          console.log(`Converted time "${originalTime}" to NYC time: ${displayTime} (${timeValue})`);
        }
        
        // Determine the most appropriate activity type
        const activityType = determineActivityType(entry.activity);
        
        // Create a key for this activity
        const activityKey = createActivityKey(entry.location, entry.activity);
        
        // Check if there's a specific search preference from multiple possible locations
        let searchPreference: string | undefined = undefined;
        
        // First check for the new top-level venuePreference field we added
        if (entry.venuePreference) {
          searchPreference = entry.venuePreference;
          console.log(`Found venue preference in top-level field (flexible): "${searchPreference}"`);
        }
        // Then check if searchParameters.venuePreference exists
        else if (entry.searchParameters?.venuePreference) {
          searchPreference = entry.searchParameters.venuePreference;
          console.log(`Found venue preference in searchParameters (flexible): "${searchPreference}"`);
        }
        // Finally try to extract from activity description if it contains venue-type keywords
        else {
          const activityDesc = entry.activity.toLowerCase();
          const venueKeywords = [
            "authentic", "traditional", "hipster", "trendy", "upscale", 
            "casual", "artisanal", "specialty", "boutique", "unique"
          ];
          
          for (const keyword of venueKeywords) {
            if (activityDesc.includes(keyword)) {
              // Extract possible venue preference from activity description
              const words = activityDesc.split(' ');
              const keywordIndex = words.findIndex(w => w.includes(keyword));
              
              if (keywordIndex !== -1 && keywordIndex < words.length - 1) {
                // Take up to 4 words after the keyword to capture the venue preference
                const preference = words.slice(keywordIndex, keywordIndex + 4).join(' ');
                console.log(`Extracted venue preference from flexible activity: "${preference}"`);
                searchPreference = preference;
                break;
              }
            }
          }
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
      requirements: extractedActivities
        .filter(a => a.requirements)
        .flatMap(a => a.requirements || [])
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
          
          // Create destinations array from fixed time locations
          const uniqueLocations = new Set<string>();
          geminiResult.fixedTimes.forEach(entry => {
            if (entry.location && entry.location !== "New York" && entry.location !== "NYC" && entry.location !== "Midtown") {
              uniqueLocations.add(entry.location);
            }
          });
          
          geminiResult.destinations = Array.from(uniqueLocations);
          
          // Process each destination
          if (geminiResult.destinations.length > 0) {
            const validatedDestinations = await Promise.all(
              geminiResult.destinations.map(async (destination: string) => {
                return await validateAndNormalizeLocation(destination);
              })
            );
            
            geminiResult.destinations = validatedDestinations.filter(Boolean);
          }
          
          // Process each fixed time location
          if (geminiResult.fixedTimes.length > 0) {
            for (const fixedTime of geminiResult.fixedTimes) {
              // Only process if location is generic but searchTerm contains hints
              if ((fixedTime.location === "New York" || fixedTime.location === "NYC" || fixedTime.location === "Midtown") && fixedTime.searchTerm) {
                const enhancedLocation = await processLocationWithAIAndMaps(fixedTime.searchTerm);
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
      try {
        // Using imported functions directly
        
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
            if ((fixedTime.location === "New York" || fixedTime.location === "NYC" || fixedTime.location === "Midtown") && fixedTime.searchTerm) {
              const enhancedLocation = await processLocationWithAIAndMaps(fixedTime.searchTerm);
              if (enhancedLocation && enhancedLocation !== "New York" && enhancedLocation !== "NYC" && enhancedLocation !== "Midtown") {
                fixedTime.location = enhancedLocation;
                console.log(`Enhanced fixed time location from generic NYC reference to "${enhancedLocation}"`);
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

    // Try to use the original Gemini implementation for more intelligent parsing
    try {
      // Then use our comprehensive Gemini prompt for enhanced understanding
      const prompt = `
You are a New York City travel planning expert with deep knowledge of NYC's geography, neighborhoods, and venues. Analyze this request carefully:

"${query}"

TASK: Provide a complete interpretation for creating a NYC itinerary with Google Places API integration.

Step 1: Identify all NYC locations with full context:
- Distinguish between neighborhoods (SoHo, Greenwich Village), landmarks (Empire State Building), and transport hubs (Grand Central)
- For ambiguous references, clarify which specific NYC location is meant
- Recognize colloquial area names and local terminology (The Village, Midtown, FiDi, etc.)

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
            throw new Error(`Failed to parse response as JSON: ${error}`);
          }
        }
        
        // Simple validation: Check that we received some data
        if (!parsedResponse || (typeof parsedResponse !== 'object') || !Object.keys(parsedResponse).length) {
          throw new Error("JSON response is empty or invalid");
        }
        
        // Start with a copy of the fallback structure to ensure we have all required fields
        const parsed: StructuredRequest = {
          startLocation: parsedResponse.startLocation || null,
          destinations: Array.isArray(parsedResponse.destinations) ? parsedResponse.destinations : [],
          fixedTimes: [],
          preferences: {
            type: parsedResponse.preferences?.type || undefined,
            requirements: [
              ...(parsedResponse.preferences?.restrictions || []),
              ...(parsedResponse.preferences?.venueQualities || [])
            ]
          }
        };
        
        // Map activities to fixed times with enhanced search parameters
        if (Array.isArray(parsedResponse.activities) && parsedResponse.activities.length > 0) {
          // Using the FixedTimeEntry type defined at the top of the file
          
          parsed.fixedTimes = parsedResponse.activities.map((activity: any): FixedTimeEntry => {
            // Convert time formats and handle special cases
            let timeValue = activity.time || "12:00";
            
            // Process period-based times
            if (timeValue.toLowerCase().includes('morning')) {
              timeValue = '09:00';
            } else if (timeValue.toLowerCase().includes('afternoon')) {
              timeValue = '14:00';
            } else if (timeValue.toLowerCase().includes('evening')) {
              timeValue = '19:00';
            } else if (timeValue.toLowerCase().includes('night')) {
              timeValue = '21:00';
            }
            
            return {
              location: activity.location || "Midtown",
              time: timeValue,
              type: activity.searchParameters?.type,
              searchTerm: activity.searchParameters?.searchTerm || activity.description,
              keywords: activity.searchParameters?.keywords || [],
              minRating: activity.searchParameters?.minRating || 3.5
            };
          });
          
          // Ensure we have at least the preference requirements
          if (Array.isArray(parsedResponse.activities)) {
            for (const activity of parsedResponse.activities) {
              if (Array.isArray(activity.requirements)) {
                parsed.preferences.requirements = [
                  ...(parsed.preferences.requirements || []),
                  ...activity.requirements
                ];
              }
            }
          }
          
          // Ensure preferences is an array if requirements exist
          if (parsed.preferences.requirements && parsed.preferences.requirements.length > 0) {
            // Deduplicate the requirements array
            parsed.preferences.requirements = Array.from(new Set(parsed.preferences.requirements));
          }
        } else {
          // If no activities were extracted, fallback to our basic extraction
          parsed.fixedTimes = fallbackStructure.fixedTimes;
        }
        
        // Ensure we have destination information
        if ((!parsed.destinations || parsed.destinations.length === 0) && extractedLocations.length > 0) {
          parsed.destinations = extractedLocations.map(loc => loc.name);
        }
        
        // Add a smart default for start location if not specified
        if (!parsed.startLocation && parsed.destinations && parsed.destinations.length > 0) {
          // Use the first destination as default starting point
          parsed.startLocation = parsed.destinations[0];
        }
        
        // Remove duplicates from fixed times by checking for similar locations and times
        const stringified = parsed.fixedTimes.map((item: FixedTimeEntry) => JSON.stringify(item));
        const uniqueItems = new Set(stringified);
        parsed.fixedTimes = Array.from(uniqueItems).map(str => JSON.parse(str));
        
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
  } catch (error) {
    // This is the outer catch block to handle any errors in the entire function
    console.error("Catastrophic error in parseItineraryRequest:", {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
      query: query.substring(0, 100) + (query.length > 100 ? '...' : '')
    });
    
    return fallbackStructure;
  }
}