import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { searchPlace } from "./lib/googlePlaces";
import { calculateTravelTime } from "./lib/itinerary";
import { parseItineraryRequest } from "./lib/nlp";
import { StructuredRequest } from "@shared/types";
import { insertPlaceSchema, insertItinerarySchema, Place, PlaceDetails } from "@shared/schema";
import { z } from "zod";
import { format } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { findAreasByCharacteristics, findQuietAreas, getAreaCrowdLevel, NYCArea, nycAreas } from "./data/new-york-areas";
import { getWeatherForecast, isVenueOutdoor, isWeatherSuitableForOutdoor, getWeatherAwareVenue } from "./lib/weatherService";

// Import the timeUtils module
import { 
  parseAndNormalizeTime, 
  NYC_TIMEZONE, 
  formatISOToNYCTime, 
  timeStringToNYCISOString 
} from './lib/timeUtils';

/**
 * Detect the appropriate activity type from query and activity text
 * Used to improve type detection for vague queries
 * 
 * @param query The original user query
 * @param activity The specific activity text
 * @returns Place type string for Google Places API
 */
function detectActivityTypeFromQuery(query: string, activity: string): string {
  // Normalize queries to lowercase for matching
  const normalizedQuery = query.toLowerCase();
  const normalizedActivity = activity.toLowerCase();
  
  // Food-related detection - check both query and activity text
  const foodKeywords = [
    'sandwich', 'lunch', 'dinner', 'breakfast', 'brunch', 'food', 
    'restaurant', 'eat', 'meal', 'burger', 'steak', 'pizza', 
    'sushi', 'dining', 'hungry'
  ];
  
  // Check for food keywords in both query and activity
  const isFoodRelated = foodKeywords.some(keyword => 
    normalizedQuery.includes(keyword) || normalizedActivity.includes(keyword)
  );
  
  if (isFoodRelated) {
    return 'restaurant';
  }
  
  // Coffee/cafe detection - check both query and activity text
  const cafeKeywords = ['coffee', 'cafe', 'tea', 'espresso'];
  
  // Check for cafe keywords in both query and activity
  const isCafeRelated = cafeKeywords.some(keyword => 
    normalizedQuery.includes(keyword) || normalizedActivity.includes(keyword)
  );
  
  if (isCafeRelated) {
    return 'cafe';
  }
  
  // Spa/massage detection
  if (
    normalizedQuery.includes('spa') || 
    normalizedQuery.includes('massage') || 
    normalizedQuery.includes('relax') || 
    normalizedQuery.includes('treatment')
  ) {
    return 'spa';
  }
  
  // Shopping detection
  if (
    normalizedQuery.includes('shop') || 
    normalizedQuery.includes('store') || 
    normalizedQuery.includes('buy') || 
    normalizedQuery.includes('mall')
  ) {
    return 'shopping_mall';
  }
  
  // Attraction detection
  if (
    normalizedQuery.includes('see') || 
    normalizedQuery.includes('visit') || 
    normalizedQuery.includes('tour') || 
    normalizedQuery.includes('attraction')
  ) {
    return 'tourist_attraction';
  }
  
  // Nightlife detection
  if (
    normalizedQuery.includes('bar') || 
    normalizedQuery.includes('pub') || 
    normalizedQuery.includes('drink') || 
    normalizedQuery.includes('club')
  ) {
    return 'bar';
  }
  
  // Default to restaurant as a reasonable fallback for food-related activities
  if (normalizedActivity.includes('eat') || normalizedActivity.includes('food')) {
    return 'restaurant';
  }
  
  // Use tourist_attraction as a generic fallback
  return 'tourist_attraction';
}

/**
 * Parse a time string to a Date object
 * Provides consistent time parsing throughout the application
 * Uses America/New_York timezone for consistent local time representation
 * 
 * @param timeStr Time string to parse (e.g., "3pm", "15:00", "evening", "at 6", "around noon", "around 3 PM")
 * @param baseDate Base date to use (defaults to current date)
 * @returns Date object with the specified time in America/New_York timezone
 */
function parseTimeString(timeStr: string, baseDate?: Date): Date {
  try {
    // Using the imported constants and functions from timeUtils that are already imported at the top of the file
    
    // Use provided base date or current date
    const currentDate = baseDate || new Date();
    
    // Check if we already have an ISO timestamp (contains 'T' and 'Z')
    if (timeStr.includes('T') && timeStr.includes('Z')) {
      try {
        // Parse the ISO timestamp and return a Date object
        const date = new Date(timeStr);
        
        // Log for debugging
        console.log(`Parsed ISO timestamp "${timeStr}" to NYC time: ${formatInTimeZone(date, NYC_TIMEZONE, 'yyyy-MM-dd HH:mm:ss zzz')}`);
        
        return date;
      } catch (err) {
        console.warn(`Failed to parse ISO timestamp: ${timeStr}, falling back to manual parsing`);
        // Fall through to manual parsing
      }
    }
    
    // Get the normalized time string in 24-hour format (HH:MM)
    // Now handles "around X" phrases properly with our improved timeUtils
    const normalizedTime = parseAndNormalizeTime(timeStr);
    
    // Extract hours and minutes
    const [hoursStr, minutesStr] = normalizedTime.split(':');
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    
    // Create a new date with the specified time based on the provided base date
    const date = new Date(currentDate);
    date.setHours(hours, minutes, 0, 0);
    
    // Convert to NYC timezone
    const nycDate = toZonedTime(date, NYC_TIMEZONE);
    
    // Format time for logging
    const displayTime = formatInTimeZone(nycDate, NYC_TIMEZONE, 'h:mm a');
    const formattedTime = formatInTimeZone(nycDate, NYC_TIMEZONE, 'yyyy-MM-dd HH:mm:ss zzz');
    
    console.log(`Parsed time "${timeStr}" to normalized time "${normalizedTime}" and NYC time: ${displayTime} (${formattedTime})`);
    
    return nycDate;
  } catch (error) {
    console.error(`Error parsing time:`, error);
    // Return a default time if parsing fails
    const defaultDate = baseDate || new Date();
    // Default to 10:00 AM NYC time if parsing fails
    defaultDate.setHours(10, 0, 0, 0);
    
    // Convert to NYC timezone
    const nycDate = toZonedTime(defaultDate, 'America/New_York');
    
    return nycDate;
  }
}

export function findInterestingActivities(
  currentLocation: string,
  availableHours: number,
  preferences: any,
  // Optional user preferences
  dayPart: 'morning' | 'afternoon' | 'evening' | 'night' = 'afternoon'
): any[] {
  console.log("Finding activities based on preferences:", preferences);
  
  // Check for area matches first
  const possibleArea = nycAreas.find((a: NYCArea) => 
    a.name.toLowerCase().includes(currentLocation.toLowerCase()) ||
    a.keywords.some(k => currentLocation.toLowerCase().includes(k))
  );
  
  const areaParam = possibleArea ? possibleArea.name : undefined;
  
  // Start with empty results, we'll fill based on what we find
  const results = [];
  
  // Attempt to find an area in NYC that matches the specified preferences
  let matchedAreas: NYCArea[] = [];
  
  // If we have specific requirements, use them for filtering
  if (preferences?.requirements && preferences.requirements.length > 0) {
    matchedAreas = findAreasByCharacteristics(
      preferences.requirements,
      possibleArea ? [possibleArea.name] : undefined
    );
  } 
  // Otherwise use preference type as a guide
  else if (preferences?.type) {
    const typeToCharacteristics: Record<string, string[]> = {
      'cafe': ['quiet', 'relaxed'],
      'park': ['outdoor', 'nature'],
      'restaurant': ['dining', 'food'],
      'bar': ['lively', 'nightlife'],
      'shopping': ['shopping', 'busy'],
      'museum': ['culture', 'quiet'],
      'art': ['culture', 'creative'],
      'activity': ['interesting', 'popular'],
      'tourist_attraction': ['popular', 'must-see']
    };
    
    // Get characteristics matching the preference type, or use 'interesting' as default
    const characteristics = typeToCharacteristics[preferences.type] || ['interesting'];
    
    // Find areas matching these characteristics
    matchedAreas = findAreasByCharacteristics(
      characteristics,
      possibleArea ? [possibleArea.name] : undefined
    );
  }
  
  // If we got area matches, create suggested activities from them
  if (matchedAreas.length > 0) {
    // Limit to top 3 areas
    matchedAreas = matchedAreas.slice(0, 3);
    
    for (const area of matchedAreas) {
      // Time per activity in hours (roughly)
      const activityLength = Math.min(1.5, availableHours / matchedAreas.length);
      
      // Type of place to suggest based on preferences and time of day
      let placeType = 'tourist_attraction';
      
      if (preferences.type === 'cafe' || preferences.type === 'restaurant' || 
          preferences.type === 'bar' || preferences.type === 'shop') {
        placeType = preferences.type;
      } else {
        // Default types based on time of day if no specific type
        if (dayPart === 'morning') {
          placeType = 'cafe';
        } else if (dayPart === 'afternoon') {
          placeType = 'tourist_attraction';
        } else if (dayPart === 'evening' || dayPart === 'night') {
          placeType = 'bar';
        }
      }
      
      // Create a suggestion based on area characteristics
      results.push({
        activity: `Explore ${area.name}`,
        location: area.name,
        duration: Math.round(activityLength * 60), // Convert to minutes
        type: placeType,
        description: `${area.description || 'Interesting area to explore'} Known for ${area.knownFor.join(', ')}.`
      });
    }
  }
  
  // If no area-based suggestions or fewer than needed, add general suggestions
  if (results.length === 0) {
    // Default suggestion - tourist_attraction is a good generic fallback
    results.push({
      activity: "See interesting sights",
      location: possibleArea ? possibleArea.name : "NYC",
      duration: Math.round(Math.min(2, availableHours) * 60), // Convert to minutes
      type: "tourist_attraction",
      description: "Explore interesting attractions and sights in the area."
    });
  }
  
  return results;
}

export async function registerRoutes(app: Express) {
  const httpServer = createServer(app);
  
  app.post("/api/plan", async (req, res) => {
    try {
      const requestSchema = z.object({
        query: z.string(),
        date: z.string().optional(),
        startTime: z.string().optional()
      });

      const { query, date, startTime } = requestSchema.parse(req.body);

      // Parse the request using NLP
      const parsed = await parseItineraryRequest(query);
      console.log("Parsed request:", parsed);
      
      // Flag to control automatic gap-filling (set to false to only use explicitly requested activities)
      const enableGapFilling = false;

      // If no explicit start location, use the first location mentioned
      if (!parsed.startLocation) {
        // Use the first fixed time location or first destination
        parsed.startLocation = parsed.fixedTimes[0]?.location || parsed.destinations[0];
        if (!parsed.startLocation) {
          throw new Error("Could not determine a starting location from your request. Please mention where you'd like to start.");
        }
      }

      // Initialize base date and time
      const baseDate = date ? new Date(date) : new Date();
      let currentTime = startTime
        ? parseTimeString(startTime, baseDate)
        : new Date(baseDate.setHours(9, 0, 0, 0));

      const scheduledPlaces = new Set(); // Track unique places
      const itineraryPlaces = [];

      // Handle lunch request specifically - only if gap filling is enabled or explicitly requested
      if (enableGapFilling && parsed.preferences?.type?.includes('lunch')) {
        console.log("Searching for lunch venue near:", parsed.startLocation);
        try {
          // Enhanced search options for lunch
          const searchOptions: any = {
            type: 'restaurant',
            requireOpenNow: true,
            minRating: 4.0,
            searchTerm: 'lunch restaurant',
            keywords: ['restaurant', 'lunch', 'dining']
          };
          
          // Add requirements as keywords for better place matching
          if (parsed.preferences?.requirements && parsed.preferences.requirements.length > 0) {
            searchOptions.keywords = [
              ...searchOptions.keywords,
              ...parsed.preferences.requirements
            ];
          }
          
          const venueResult = await searchPlace(parsed.startLocation, searchOptions);
          
          if (!venueResult || !venueResult.primary) {
            console.error("Failed to find lunch venue near:", parsed.startLocation);
          } else {
            // Use the primary venue from the result
            let lunchPlace = venueResult.primary;

            // Apply weather-aware venue selection for lunch
            if (process.env.WEATHER_API_KEY && lunchPlace.types) {
              try {
                const lunchTime = parseTimeString('14:00', baseDate);
                console.log("Checking weather conditions for lunch venue...");
                
                // Determine if venue is outdoors based on its types
                const isOutdoor = lunchPlace.types && isVenueOutdoor(lunchPlace.types);
                lunchPlace.isOutdoorVenue = isOutdoor;
                
                // Check if it's an outdoor venue and if weather conditions are suitable
                const { venue: recommendedVenue, weatherSuitable } = await getWeatherAwareVenue(
                  lunchPlace,
                  venueResult.alternatives,
                  lunchPlace.geometry.location.lat,
                  lunchPlace.geometry.location.lng,
                  lunchTime
                );
                
                // Set weather information on both the suggested place and alternatives
                lunchPlace.weatherSuitable = weatherSuitable;
                
                // If this venue has alternatives, mark them appropriately
                if (venueResult.alternatives && venueResult.alternatives.length > 0) {
                  venueResult.alternatives.forEach(alt => {
                    alt.isOutdoorVenue = alt.types ? isVenueOutdoor(alt.types) : false;
                    alt.weatherSuitable = weatherSuitable;
                  });
                }
                
                // If weather is not suitable and we have an indoor alternative
                if (!weatherSuitable && recommendedVenue !== lunchPlace) {
                  console.log(`Weather not optimal for ${lunchPlace.name} - outdoor seating may be uncomfortable`);
                  console.log(`Suggesting alternative lunch venue: ${recommendedVenue.name}`);
                  recommendedVenue.weatherAwareRecommendation = true;
                  lunchPlace = recommendedVenue;
                }
              } catch (weatherError) {
                console.warn("Weather service error for lunch venue (proceeding with original):", weatherError);
              }
            }

            console.log("Found lunch venue:", {
              name: lunchPlace.name,
              address: lunchPlace.formatted_address,
              rating: lunchPlace.rating,
              alternatives: venueResult.alternatives.length
            });

            const lunchTime = parseTimeString('14:00', baseDate);
            const newPlace = await storage.createPlace({
              placeId: lunchPlace.place_id,
              name: lunchPlace.name,
              address: lunchPlace.formatted_address,
              location: lunchPlace.geometry.location,
              details: lunchPlace,
              alternatives: venueResult.alternatives,
              scheduledTime: lunchTime.toISOString(),
            });

            // Use composite key with lunch location
            scheduledPlaces.add(`${lunchPlace.place_id}:lunch`);
            itineraryPlaces.push({
              place: newPlace,
              time: lunchTime,
              isFixed: true
            });
          }
        } catch (error) {
          console.error("Error finding lunch venue:", error);
        }
      }

      // Handle fixed-time appointments first
      for (const timeSlot of parsed.fixedTimes) {
        try {
          console.log("Processing fixed time appointment:", {
            location: timeSlot.location,
            time: timeSlot.time,
            type: timeSlot.type,
            searchTerm: timeSlot.searchTerm,
            keywords: timeSlot.keywords,
            minRating: timeSlot.minRating
          });

          const appointmentTime = parseTimeString(timeSlot.time, baseDate);
          
          // Infer activity type for vague or missing types
          // NOTE: This is kept as a safety fallback even though Gemini should now provide types directly
          // It serves as a final safeguard in case the AI doesn't properly categorize an activity
          if (!timeSlot.type || timeSlot.type === 'activity') {
            // Infer the type from the query and search term
            timeSlot.type = detectActivityTypeFromQuery(
              query, 
              timeSlot.searchTerm || ''
            );
            console.log(`Inferred activity type for "${timeSlot.searchTerm}": ${timeSlot.type}`);
          }
          
          // Enhanced search options with parameters from fixedTimes
          const searchOptions: any = {
            type: timeSlot.type,
            requireOpenNow: true,
            // Make a copy of the keywords array if available or use an empty array
            keywords: Array.isArray(timeSlot.keywords) ? [...timeSlot.keywords] : [],
            // Use explicitly provided searchTerm or fall back to type
            searchTerm: timeSlot.searchTerm || timeSlot.type,
            // Use explicitly provided minRating or default to 0
            minRating: typeof timeSlot.minRating === 'number' ? timeSlot.minRating : 0
          };
          
          // Only add additional context if we don't have rich search parameters already
          if ((!timeSlot.searchTerm || !timeSlot.keywords || timeSlot.keywords.length === 0) && timeSlot.type) {
            // Add keywords based on common activity types only if not provided by Gemini
            if (timeSlot.type.includes('coffee') || timeSlot.type.includes('cafe')) {
              searchOptions.keywords.push('coffee', 'espresso', 'cafe');
              searchOptions.type = 'cafe';
              // Use activity type as search term only if not explicitly provided
              if (!timeSlot.searchTerm) {
                searchOptions.searchTerm = 'coffee shop';
              }
            } else if (timeSlot.type.includes('dinner') || 
                      timeSlot.type.includes('lunch') || 
                      timeSlot.type.includes('restaurant')) {
              searchOptions.keywords.push('restaurant', 'food', 'dining');
              searchOptions.type = 'restaurant';
              // Rating expectations are higher for restaurants
              if (!timeSlot.minRating) {
                searchOptions.minRating = 4.0;
              }
            } else if (timeSlot.type.includes('museum') || timeSlot.type.includes('gallery')) {
              searchOptions.keywords.push('art', 'museum', 'exhibit');
              searchOptions.type = 'museum';
            } else if (timeSlot.type.includes('park') || timeSlot.type.includes('garden')) {
              searchOptions.keywords.push('park', 'green space', 'outdoor');
              searchOptions.type = 'park';
            } else if (timeSlot.type.includes('shopping')) {
              searchOptions.keywords.push('shopping', 'mall', 'store');
              searchOptions.type = 'shopping_mall';
            }
          }
          
          // Search for the venue with enhanced parameters
          console.log(`Search options for ${timeSlot.location}:`, JSON.stringify(searchOptions, null, 2));
          
          // Log original values from fixedTimes for debugging
          console.log(`Original fixedTimes values:`, {
            searchTerm: timeSlot.searchTerm,
            keywords: timeSlot.keywords,
            minRating: timeSlot.minRating,
            type: timeSlot.type
          });
          
          // VERIFIED: Now directly using the non-null location from Gemini without additional checks
          // The location string should now always be valid as enforced by the Gemini prompt
          const venueResult = await searchPlace(timeSlot.location, searchOptions);

          if (!venueResult || !venueResult.primary) {
            throw new Error(`Could not find location: ${timeSlot.location}. Try specifying the full name (e.g. "The Green Park" instead of "Green Park")`);
          }

          // Use the primary venue from the result
          const place = venueResult.primary;

          console.log("Found location:", {
            name: place.name,
            address: place.formatted_address,
            type: place.types,
            alternatives: venueResult.alternatives.length
          });

          // Create a composite key using place_id + locationName to allow the same venue for different activities
          const compositeKey = `${place.place_id}:${timeSlot.location}`;
          
          if (scheduledPlaces.has(compositeKey)) {
            console.log("Skipping duplicate location-activity combination:", place.name, "at", timeSlot.location);
            continue;
          }

          // Try to create the place with better error handling
          let newPlace;
          try {
            newPlace = await storage.createPlace({
              placeId: place.place_id,
              name: place.name,
              address: place.formatted_address,
              location: place.geometry.location,
              details: place,
              alternatives: venueResult.alternatives,
              scheduledTime: appointmentTime.toISOString(),
            });
          } catch (placeError: any) {
            // If we get a duplicate key error, try to fetch the existing place
            if (placeError.code === '23505') {
              console.warn(`Duplicate place found for ${place.name}, trying to fetch existing record`);
              const existingPlace = await storage.getPlaceByPlaceId(place.place_id);
              if (existingPlace) {
                console.log(`Using existing place record for ${place.name}`);
                newPlace = existingPlace;
              } else {
                throw placeError; // Re-throw if we can't recover
              }
            } else {
              throw placeError; // Re-throw other errors
            }
          }

          scheduledPlaces.add(compositeKey);
          itineraryPlaces.push({
            place: newPlace,
            time: appointmentTime,
            isFixed: true
          });
        } catch (error: any) {
          console.error(`Error scheduling ${timeSlot.location}:`, error);
          throw new Error(`Error scheduling ${timeSlot.location}: ${error.message}`);
        }
      }

      // Sort fixed appointments chronologically
      itineraryPlaces.sort((a, b) => a.time.getTime() - b.time.getTime());

      // Gap-filling logic has been commented out to only include activities explicitly requested by the user
      /*
      // Fill gaps with interesting activities based on preferences
      if (parsed.preferences?.type || parsed.preferences?.requirements) {
        for (let i = 0; i < itineraryPlaces.length - 1; i++) {
          // Explicitly type the current and next variables
          const current: { place: Place, time: Date, isFixed: boolean } = itineraryPlaces[i];
          const next: { place: Place, time: Date, isFixed: boolean } = itineraryPlaces[i + 1];

          // Calculate gap between activities
          const gap = next.time.getTime() - (current.time.getTime() + 90 * 60 * 1000);
       
          if (gap > 1.5 * 60 * 60 * 1000) { // If gap > 1.5 hours
            const suggestedActivities = findInterestingActivities(
              current.place.name,
              gap / (60 * 60 * 1000),
              parsed.preferences,
              getDayPart(next.time)
            );
            
            // Only add the first suggestion to avoid overcrowding
            if (suggestedActivities.length > 0) {
              const activity = suggestedActivities[0];
              
              try {
                console.log(`Filling gap between ${current.place.name} and ${next.place.name} with activity: ${activity.activity}`);
                
                // Calculate the midpoint time for the gap activity
                const midpointTime = new Date(current.time.getTime() + gap / 2);
                
                // Determine activity type based on day part and preferences
                const activityType = 
                  parsed.preferences?.type || 
                  (midpointTime.getHours() < 12 ? 'cafe' : 
                  midpointTime.getHours() < 18 ? 'museum' : 'restaurant');
                
                // Enhanced search options for the gap activity
                const searchOptions: any = {
                  type: activity.type || activityType,
                  keywords: ['recommended', 'popular'],
                  minRating: 4.0,
                  // Use activity description as search term
                  searchTerm: activity.activity
                };
                
                // If we have requirements from preferences, add them as keywords
                if (parsed.preferences?.requirements && parsed.preferences.requirements.length > 0) {
                  searchOptions.keywords = [
                    ...searchOptions.keywords,
                    ...parsed.preferences.requirements
                  ];
                }
                
                const venueResult = await searchPlace(activity.location, searchOptions);
                
                if (venueResult && venueResult.primary) {
                  const place = venueResult.primary;
                  console.log(`Found gap-filling activity venue: ${place.name}`);
                  
                  // Create a composite key with gap location
                  const compositeKey = `${place.place_id}:gap`;
                  
                  if (scheduledPlaces.has(compositeKey)) {
                    console.log("Skipping duplicate gap-filling venue:", place.name);
                    continue;
                  }
                  
                  try {
                    const newPlace = await storage.createPlace({
                      placeId: place.place_id,
                      name: place.name,
                      address: place.formatted_address,
                      location: place.geometry.location,
                      details: place,
                      alternatives: venueResult.alternatives,
                      scheduledTime: midpointTime.toISOString(),
                    });
                    
                    scheduledPlaces.add(compositeKey);
                    
                    // Add to itinerary
                    itineraryPlaces.push({
                      place: newPlace,
                      time: midpointTime,
                      isFixed: false
                    });
                  } catch (error) {
                    console.error(`Error creating place for gap activity:`, error);
                  }
                }
              } catch (error) {
                console.error(`Error finding venue for activity "${activity.activity}":`, error);
              }
            }
          }
        }
      }
      */

      // Handle cases where preferences exist but no fixed times
      // Only include activities that were explicitly mentioned by the user
      if (itineraryPlaces.length === 0 && 
          (parsed.activities && parsed.activities.length > 0)
        ) {
        console.log(`No fixed times but found activities`);
        
        try {
          // Use current time as default starting point
          let currentTime = new Date();
          
          // Check if we have multiple activities from Gemini parsing
          if (parsed.activities && Array.isArray(parsed.activities) && parsed.activities.length > 0) {
            console.log(`Found ${parsed.activities.length} activities from Gemini with no fixed times`);
            
            // Store existing times to check for duplicates
            const existingTimes: number[] = [];
            
            // Process up to 3 activities maximum to avoid overcrowding
            const maxActivities = Math.min(3, parsed.activities.length);
            
            for (let i = 0; i < maxActivities; i++) {
              const activity = parsed.activities[i];
              if (!activity || !activity.description) continue;
              
              // Schedule activities 90 minutes apart
              const activityTime = new Date(currentTime.getTime() + (i * 90 * 60 * 1000));
              console.log(`Scheduling activity "${activity.description}" at ${activityTime.toLocaleTimeString()}`);
              
              // Create search options from activity parameters
              const searchOptions: any = {
                keywords: [],
                requireOpenNow: true,
                minRating: 4.0
              };
              
              // Use rich parameters if available
              if (activity.searchParameters) {
                searchOptions.type = activity.searchParameters.type;
                searchOptions.searchTerm = activity.searchParameters.searchTerm || activity.description;
                searchOptions.keywords = Array.isArray(activity.searchParameters.keywords) ? 
                                      [...activity.searchParameters.keywords] : [];
                searchOptions.minRating = activity.searchParameters.minRating || 4.0;
              } else {
                // Use activity description as search term
                searchOptions.searchTerm = activity.description;
              }
              
              // Add requirements as keywords
              if (Array.isArray(activity.requirements) && activity.requirements.length > 0) {
                searchOptions.keywords = [
                  ...searchOptions.keywords,
                  ...activity.requirements
                ];
              }
              
              try {
                const venueResult = await searchPlace(activity.description, searchOptions);
                
                if (venueResult && venueResult.primary) {
                  console.log(`Found venue for activity "${activity.description}": ${venueResult.primary.name}`);
                  
                  // Try to create the place with better error handling
                  let newPlace;
                  try {
                    newPlace = await storage.createPlace({
                      placeId: venueResult.primary.place_id,
                      name: venueResult.primary.name,
                      address: venueResult.primary.formatted_address,
                      location: venueResult.primary.geometry.location,
                      details: venueResult.primary,
                      scheduledTime: activityTime.toISOString(),
                      alternatives: venueResult.alternatives || []
                    });
                  } catch (placeError: any) {
                    // If we get a duplicate key error, try to fetch the existing place
                    if (placeError.code === '23505') {
                      console.warn(`Duplicate place found for ${venueResult.primary.name}, trying to fetch existing record`);
                      const existingPlace = await storage.getPlaceByPlaceId(venueResult.primary.place_id);
                      if (existingPlace) {
                        console.log(`Using existing place record for ${venueResult.primary.name}`);
                        newPlace = existingPlace;
                      } else {
                        throw placeError; // Re-throw if we can't recover
                      }
                    } else {
                      throw placeError; // Re-throw other errors
                    }
                  }
                  
                  // Add to itinerary
                  itineraryPlaces.push({
                    place: newPlace,
                    time: activityTime,
                    isFixed: false
                  });
                  
                  // Mark this place as scheduled with composite key
                  scheduledPlaces.add(`${venueResult.primary.place_id}:${activity.description}`);
                  existingTimes.push(activityTime.getTime());
                }
              } catch (error) {
                console.error(`Error finding venue for activity "${activity.description}":`, error);
              }
            }
            
            // If we successfully added activities, skip the fallback single venue logic
            if (itineraryPlaces.length > 0) {
              console.log(`Successfully added ${itineraryPlaces.length} activities from Gemini parsing`);
              // Skip the fallback logic
              return res.json(await storage.createItinerary({
                query,
                places: itineraryPlaces.map(sp => sp.place),
                travelTimes: [], // No travel times for now
              }));
            }
          }
        } catch (error) {
          console.error("Error processing activities with no fixed times:", error);
        }
      }

      // Final chronological sort
      itineraryPlaces.sort((a, b) => a.time.getTime() - b.time.getTime());

      // Calculate travel times between places
      const travelTimes = [];
      let lastPlace: PlaceDetails | null = null;

      for (const scheduledPlace of itineraryPlaces) {
        // First check if we have valid objects for calculating travel time
        if (lastPlace && 
            scheduledPlace.place.details && 
            typeof scheduledPlace.place.details === 'object' && 
            'name' in scheduledPlace.place.details && 
            'formatted_address' in scheduledPlace.place.details &&
            'geometry' in scheduledPlace.place.details) {
          
          // Type assertion to help TypeScript understand the structure
          const currentPlaceDetails = scheduledPlace.place.details as PlaceDetails;
          
          try {
            const travelTime = calculateTravelTime(lastPlace, currentPlaceDetails);
            travelTimes.push({
              from: lastPlace.name,
              to: scheduledPlace.place.name,
              duration: travelTime,
              arrivalTime: scheduledPlace.time.toISOString()
            });
          } catch (error) {
            console.error("Error calculating travel time:", error);
            // Add fallback travel time calculation if main calculation fails
            travelTimes.push({
              from: lastPlace.name,
              to: scheduledPlace.place.name,
              duration: 30, // Default 30 minutes as fallback
              arrivalTime: scheduledPlace.time.toISOString()
            });
          }
        }
        
        // Update last place reference for next iteration
        if (scheduledPlace.place.details && 
            typeof scheduledPlace.place.details === 'object' && 
            'name' in scheduledPlace.place.details && 
            'formatted_address' in scheduledPlace.place.details &&
            'geometry' in scheduledPlace.place.details &&
            'place_id' in scheduledPlace.place.details) {
          lastPlace = scheduledPlace.place.details as PlaceDetails;
        }
      }

      // Create the final itinerary
      const userId = req.session.userId;
      console.log(`Creating itinerary with user ID: ${userId || 'none (anonymous)'}`);
      const itinerary = await storage.createItinerary({
        query,
        places: itineraryPlaces.map(sp => sp.place),
        travelTimes,
      }, userId); // Associate with the current user if they're logged in

      res.json(itinerary);
    } catch (error: any) {
      console.error("Error creating itinerary:", error);
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/itinerary/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const itinerary = await storage.getItinerary(id);

    if (!itinerary) {
      res.status(404).json({ message: "Itinerary not found" });
      return;
    }

    res.json(itinerary);
  });

  // Add endpoint to get weather forecast for specific coordinates
  app.get("/api/weather", async (req, res) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      
      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ message: "Valid latitude and longitude are required" });
      }
      
      if (!process.env.WEATHER_API_KEY) {
        return res.status(503).json({ message: "Weather service is not configured" });
      }
      
      const forecast = await getWeatherForecast(lat, lng);
      res.json({
        current: forecast.current,
        hourly: forecast.hourly?.slice(0, 24), // Return 24 hours of forecasts
        location: { lat, lng }
      });
    } catch (error: any) {
      console.error("Weather API error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Test endpoint for timezone functionality
  app.get("/api/test-timezone", (req, res) => {
    // Create a test with different time formats
    const testTimes = [
      "3pm",
      "15:00",
      "morning",
      "noon",
      "evening",
      "at 6",
      "around 3 PM"
    ];
    
    const results = testTimes.map(timeStr => {
      // Process the time using our new functions
      const normalizedTime = parseAndNormalizeTime(timeStr);
      const isoTime = timeStringToNYCISOString(timeStr);
      const displayTime = formatISOToNYCTime(isoTime);
      
      return {
        original: timeStr,
        normalized: normalizedTime,
        iso: isoTime,
        display: displayTime
      };
    });
    
    res.status(200).json({
      message: "NYC timezone test results",
      currentNYCTime: formatInTimeZone(new Date(), NYC_TIMEZONE, 'yyyy-MM-dd h:mm:ss a zzz'),
      results
    });
  });

  return httpServer;
}

// Helper function to determine the part of the day (for recommendations)
function getDayPart(date: Date): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = date.getHours();
  
  if (hour >= 5 && hour < 12) {
    return 'morning';
  } else if (hour >= 12 && hour < 17) {
    return 'afternoon';
  } else if (hour >= 17 && hour < 22) {
    return 'evening';
  } else {
    return 'night';
  }
}