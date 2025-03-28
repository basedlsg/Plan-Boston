import { z } from "zod";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import type { PlaceDetails } from "@shared/schema";
import { StructuredRequest } from "@shared/types";
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
import processWithGemini from './geminiProcessor';

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

  try {
    // First attempt: Use the new Gemini processor
    console.log("Attempting to process query with new Gemini processor");
    const geminiResult = await processWithGemini(query);
    
    if (geminiResult) {
      console.log("Successfully processed query with new Gemini processor");
      
      // Sort fixed times chronologically if they exist
      if (geminiResult.fixedTimes) {
        geminiResult.fixedTimes.sort((a: {time?: string}, b: {time?: string}) => {
          if (!a.time) return -1;
          if (!b.time) return 1;
          return a.time.localeCompare(b.time);
        });
      }
      
      // Apply location validation and normalization when possible
      try {
        const { validateAndNormalizeLocation, processLocationWithAIAndMaps } = require('./mapGeocoding');
        
        // Process each destination
        if (geminiResult.destinations && geminiResult.destinations.length > 0) {
          const validatedDestinations = await Promise.all(
            geminiResult.destinations.map(async (destination: string) => {
              return await validateAndNormalizeLocation(destination);
            })
          );
          
          geminiResult.destinations = validatedDestinations.filter(Boolean);
        }
        
        // Process each fixed time location
        if (geminiResult.fixedTimes && geminiResult.fixedTimes.length > 0) {
          for (const fixedTime of geminiResult.fixedTimes) {
            // Only process if location is generic but searchTerm contains hints
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
        console.warn("Location enhancement skipped due to error:", error);
      }
      
      return geminiResult;
    }
    
    // If the new Gemini processor isn't available or fails, fall back to the original method
    console.log("New Gemini processor unavailable or failed, falling back to original method");
    
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

    // Try to use the original Gemini implementation for more intelligent parsing
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
              location: activity.location || "London",
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