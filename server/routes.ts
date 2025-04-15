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
import { findAreasByCharacteristics, findQuietAreas, getAreaCrowdLevel, LondonArea, londonAreas } from "./data/london-areas";
import { getWeatherForecast, isVenueOutdoor, isWeatherSuitableForOutdoor, getWeatherAwareVenue } from "./lib/weatherService";

// Import the timeUtils module
import { parseAndNormalizeTime } from './lib/timeUtils';

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
 * 
 * @param timeStr Time string to parse (e.g., "3pm", "15:00", "evening", "at 6")
 * @param baseDate Base date to use (defaults to current date)
 * @returns Date object with the specified time
 */
function parseTimeString(timeStr: string, baseDate?: Date): Date {
  try {
    // Use provided base date or current date
    const currentDate = baseDate || new Date();
    
    // Get the normalized time string in 24-hour format (HH:MM)
    const normalizedTime = parseAndNormalizeTime(timeStr);
    
    // Extract hours and minutes
    const [hoursStr, minutesStr] = normalizedTime.split(':');
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    
    // Create a new date with the specified time
    const date = new Date(currentDate);
    date.setHours(hours, minutes, 0, 0);
    
    console.log(`Parsed time "${timeStr}" as "${normalizedTime}" (${date.toLocaleTimeString()})`);
    return date;
  } catch (error) {
    console.error(`Error parsing time string "${timeStr}":`, error);
    
    // Provide a reasonable default (noon) instead of throwing an error
    const fallbackDate = new Date(baseDate || new Date());
    fallbackDate.setHours(12, 0, 0, 0);
    
    return fallbackDate;
  }
}

// Enhanced findInterestingActivities function with improved contextual awareness
export function findInterestingActivities(
  location: string,
  duration: number,
  timeOfDay: string,
  preferences: { type?: string; requirements?: string[] } = {}
): string[] {
  const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;
  const hour = parseInt(timeOfDay.split(':')[0]);
  const currentDate = new Date();
  const timeDate = new Date(currentDate);
  timeDate.setHours(hour, parseInt(timeOfDay.split(':')[1]) || 0, 0, 0);

  // More granular time slots for better suggestions
  const getTimeSlot = (hour: number) => 
    hour < 10 ? 'early-morning'
    : hour < 12 ? 'morning'
    : hour < 14 ? 'midday'
    : hour < 17 ? 'afternoon'
    : hour < 20 ? 'evening'
    : 'night';

  const currentTimeSlot = getTimeSlot(hour);
  
  // Define activity categories with more detailed options
  const activityCategories = {
    cultural: [
      'museum', 'art gallery', 'historic site', 'landmark', 'guided tour', 
      'architecture tour', 'cultural center', 'exhibition'
    ],
    dining: [
      'restaurant', 'bistro', 'cafe', 'food market', 'street food', 
      'food tour', 'cookery class', 'fine dining'
    ],
    entertainment: [
      'theater', 'cinema', 'comedy club', 'live music', 'concert', 
      'nightclub', 'jazz club', 'dance performance'
    ],
    shopping: [
      'shopping center', 'market', 'boutique shopping', 'department store', 
      'antique shop', 'bookstore', 'specialty shop', 'design store'
    ],
    outdoor: [
      'park', 'garden', 'riverside walk', 'canal walk', 'bike ride', 
      'outdoor sightseeing', 'boat tour', 'picnic spot'
    ],
    relaxation: [
      'spa', 'tea room', 'coffee shop', 'relaxing cafe', 'garden terrace', 
      'quiet reading spot', 'peaceful walk', 'meditation center'
    ]
  };

  // Time-appropriate activities
  const timeBasedActivities = {
    'early-morning': ['breakfast spot', 'bakery', 'morning walk', 'coffee shop', 'farmers market', 'yoga class'],
    'morning': ['artisan cafe', 'museum', 'gallery', 'shopping', 'sightseeing tour', 'coffee tasting'],
    'midday': ['lunch restaurant', 'bistro', 'food market', 'gallery', 'shopping', 'walking tour'],
    'afternoon': ['tea room', 'dessert cafe', 'museum', 'park', 'shopping', 'boat tour', 'gallery'],
    'evening': ['dinner restaurant', 'wine bar', 'cocktail bar', 'theater', 'comedy show', 'twilight tour'],
    'night': ['cocktail bar', 'pub', 'nightclub', 'late dinner', 'jazz club', 'evening walk', 'night tour']
  };
  
  // Duration-appropriate activities
  const getDurationBasedActivities = (hours: number) => {
    if (hours <= 1) {
      return ['coffee break', 'quick snack', 'short walk', 'small gallery', 'bookstore visit'];
    } else if (hours <= 2) {
      return ['museum visit', 'lunch spot', 'shopping trip', 'guided tour', 'coffee tasting'];
    } else {
      return ['full museum experience', 'theater show', 'extended dining', 'multiple galleries', 'walking tour'];
    }
  };

  // Try to get area information for weather-aware suggestions
  let areaInfo: LondonArea | undefined;
  try {
    const possibleArea = londonAreas.find((a: LondonArea) => 
      a.name.toLowerCase() === location.toLowerCase() || 
      a.neighbors.some((n: string) => n.toLowerCase() === location.toLowerCase())
    );
    if (possibleArea) {
      areaInfo = possibleArea;
    }
  } catch (error) {
    console.warn("Could not find area information for weather context");
  }

  // Weather-aware suggestions (try to get weather data if available)
  let isOutdoorSuitable = true;
  let weatherAwareActivities: string[] = [];
  
  try {
    // Only attempt weather-aware activity suggestions if we have coord data (would come from Google Places)
    // This is a placeholder for actual implementation that would use real coordinates
    // We'll make a best effort but won't require it
    if (areaInfo) {
      const useIndoorActivities = !isOutdoorSuitable;
      
      if (useIndoorActivities) {
        weatherAwareActivities = [
          ...activityCategories.cultural,
          ...activityCategories.dining,
          ...activityCategories.entertainment,
          ...activityCategories.shopping
        ].filter(activity => !activityCategories.outdoor.includes(activity));
      }
    }
  } catch (error) {
    console.warn("Could not get weather information for contextual suggestions");
  }

  // Handle specific meal-time requests with more diverse options
  if (preferences.type) {
    if (hour >= 7 && hour <= 10 && preferences.type.includes('breakfast')) {
      return [
        `breakfast at a local cafe in ${location}`,
        `brunch spot near ${location}`,
        `bakery with coffee in ${location}`
      ];
    }
    
    if (hour >= 12 && hour <= 15 && preferences.type.includes('lunch')) {
      return [
        `lunch restaurant in ${location}`,
        `casual bistro near ${location}`,
        `food market in ${location}`
      ];
    }
    
    if (hour >= 18 && hour <= 22 && preferences.type.includes('dinner')) {
      return [
        `dinner restaurant in ${location}`,
        `bistro for evening meal near ${location}`,
        `local dining spot in ${location}`
      ];
    }
  }

  // If user wants non-crowded places - enhanced with more activity variety
  if (preferences.requirements?.includes('non-crowded')) {
    const quietAreas = findQuietAreas(timeOfDay, isWeekend, location);
    if (quietAreas.length > 0) {
      // Get activity type based on time of day with more variety
      const activities = {
        'early-morning': ['quiet cafe', 'peaceful park walk', 'bakery', 'light breakfast'],
        'morning': ['artisan cafe', 'specialty coffee', 'small gallery', 'boutique shopping'],
        'midday': ['hidden gem restaurant', 'small museum', 'local gallery', 'quiet lunch spot'],
        'afternoon': ['boutique shopping', 'tea room', 'book shop', 'garden visit'],
        'evening': ['wine bar', 'quiet cocktail bar', 'intimate dining', 'small music venue'],
        'night': ['speakeasy bar', 'jazz club', 'quiet late night cafe', 'intimate wine bar']
      };

      const areaActivities = activities[currentTimeSlot];
      return quietAreas.slice(0, 2).map(area => {
        const activity = areaActivities[Math.floor(Math.random() * areaActivities.length)];
        return `${activity} in ${area.name}`;
      });
    }
  }

  // Enhanced area matching for preferences
  const userRequirements = preferences.requirements || [];
  
  // Infer additional requirements based on preferences.type
  if (preferences.type) {
    if (preferences.type.includes('cultural')) {
      userRequirements.push('cultural', 'historic');
    } else if (preferences.type.includes('dining')) {
      userRequirements.push('foodie', 'restaurants');
    } else if (preferences.type.includes('nightlife')) {
      userRequirements.push('lively', 'vibrant');
    } else if (preferences.type.includes('relaxing')) {
      userRequirements.push('peaceful', 'quiet');
    }
  }

  // Find areas matching enhanced characteristics
  const matchingAreas = findAreasByCharacteristics(
    userRequirements,
    location ? [location] : []
  );

  if (matchingAreas.length > 0) {
    const suggestions: string[] = [];
    
    for (const area of matchingAreas.slice(0, 2)) {
      let activityOptions: string[] = [];
      
      // Try to match activities with area.popularFor
      for (const popular of area.popularFor) {
        if (popular.includes('museum') || popular.includes('gallery')) {
          activityOptions.push(...activityCategories.cultural);
        } else if (popular.includes('restaurant') || popular.includes('food')) {
          activityOptions.push(...activityCategories.dining);
        } else if (popular.includes('shop') || popular.includes('market')) {
          activityOptions.push(...activityCategories.shopping);
        } else if (popular.includes('park') || popular.includes('garden')) {
          // Only suggest outdoor activities if weather is suitable
          if (isOutdoorSuitable) {
            activityOptions.push(...activityCategories.outdoor);
          }
        }
      }
      
      // If we couldn't match with popularFor, use time-based activities
      if (activityOptions.length === 0) {
        activityOptions = timeBasedActivities[currentTimeSlot];
      }
      
      // Get 1-2 activities 
      const randomIndex = Math.floor(Math.random() * activityOptions.length);
      const activity = activityOptions[randomIndex];
      suggestions.push(`${activity} in ${area.name}`);
      
      // If the area has a specific thing it's known for, suggest that too
      if (area.popularFor.length > 0) {
        const popularActivity = area.popularFor[Math.floor(Math.random() * area.popularFor.length)];
        suggestions.push(`${popularActivity} in ${area.name}`);
      }
    }
    
    return suggestions;
  }

  // Consider both time and duration for default suggestions
  const durationActivities = getDurationBasedActivities(duration);
  const timeActivities = timeBasedActivities[currentTimeSlot];
  
  // Combine time and duration appropriate activities
  const combinedActivities = [
    ...timeActivities,
    ...durationActivities,
    ...(weatherAwareActivities.length > 0 ? weatherAwareActivities : [])
  ];
  
  // Return 2-3 diverse suggestions
  const suggestions: string[] = [];
  const usedIndices = new Set<number>();
  
  for (let i = 0; i < Math.min(3, combinedActivities.length); i++) {
    let randomIndex: number;
    // Avoid duplicate suggestions
    do {
      randomIndex = Math.floor(Math.random() * combinedActivities.length);
    } while (usedIndices.has(randomIndex) && usedIndices.size < combinedActivities.length);
    
    usedIndices.add(randomIndex);
    const activity = combinedActivities[randomIndex];
    suggestions.push(`${activity} near ${location}`);
  }
  
  return suggestions;
}

// Update the /api/plan endpoint to handle fixed appointments better
export async function registerRoutes(app: Express) {
  const httpServer = createServer(app);

  // Add endpoint to get current server time
  app.get("/api/time", (_req, res) => {
    res.json({
      currentTime: new Date().toISOString(),
      timestamp: Date.now()
    });
  });

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

      // Handle lunch request specifically
      if (parsed.preferences?.type?.includes('lunch')) {
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

            scheduledPlaces.add(lunchPlace.place_id);
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

          if (scheduledPlaces.has(place.place_id)) {
            console.log("Skipping duplicate location:", place.name);
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

          scheduledPlaces.add(place.place_id);
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
              format(new Date(current.time.getTime() + 90 * 60 * 1000), 'HH:mm'),
              parsed.preferences
            );
            
            // Limit to maximum 2 activities per gap to prevent overcrowding
            const maxActivitiesPerGap = Math.min(2, suggestedActivities.length);
            // Calculate time increment for each activity to space them out evenly
            const timeSpacing = gap / (maxActivitiesPerGap + 1);
            
            // Store existing times to check for duplicates
            const existingTimes: number[] = itineraryPlaces.map(p => p.time.getTime());

            for (let i = 0; i < maxActivitiesPerGap; i++) {
              const activity = suggestedActivities[i];
              try {
                // Enhanced search options for gap filling
                const searchOptions: any = {
                  requireOpenNow: true,
                  minRating: 4.0,
                  keywords: []
                };
                
                // First check if this activity has a matching activity in the activities array
                // This would allow us to leverage rich search parameters from Gemini if available
                let matchingActivity;
                
                if (parsed.activities && Array.isArray(parsed.activities) && parsed.activities.length > 0) {
                  // Try to find a matching activity by similarity
                  matchingActivity = parsed.activities.find(a => 
                    a.description.toLowerCase().includes(activity.toLowerCase()) ||
                    activity.toLowerCase().includes(a.description.toLowerCase())
                  );
                  
                  // If we found a matching activity with search parameters, use them
                  if (matchingActivity?.searchParameters) {
                    console.log(`Found matching activity with rich search parameters: "${matchingActivity.description}"`);
                    
                    // Copy the rich search parameters
                    searchOptions.type = matchingActivity.searchParameters.type;
                    searchOptions.searchTerm = matchingActivity.searchParameters.searchTerm;
                    searchOptions.keywords = Array.isArray(matchingActivity.searchParameters.keywords) ? 
                                          [...matchingActivity.searchParameters.keywords] : 
                                          [];
                    searchOptions.minRating = typeof matchingActivity.searchParameters.minRating === 'number' ? 
                                          matchingActivity.searchParameters.minRating : 
                                          4.0;
                                          
                    // Also add any requirements as additional keywords
                    if (Array.isArray(matchingActivity.requirements) && matchingActivity.requirements.length > 0) {
                      searchOptions.keywords = [
                        ...searchOptions.keywords,
                        ...matchingActivity.requirements
                      ];
                    }
                    
                    console.log(`Using rich search parameters:`, JSON.stringify(searchOptions, null, 2));
                  }
                }
                
                // If no matching activity with rich parameters was found, use activity name as search term
                // and infer other parameters from text
                if (!matchingActivity?.searchParameters) {
                  // Add activity name as search term for better context
                  searchOptions.searchTerm = activity;
                  
                  // Add keywords based on common activity types
                  if (activity.toLowerCase().includes('coffee') || 
                      activity.toLowerCase().includes('cafe')) {
                    searchOptions.type = 'cafe';
                    searchOptions.keywords.push('coffee', 'espresso', 'cafe');
                  } else if (activity.toLowerCase().includes('dinner') || 
                            activity.toLowerCase().includes('lunch') || 
                            activity.toLowerCase().includes('restaurant') ||
                            activity.toLowerCase().includes('food')) {
                    searchOptions.type = 'restaurant';
                    searchOptions.keywords.push('restaurant', 'food', 'dining');
                  } else if (activity.toLowerCase().includes('museum') || 
                            activity.toLowerCase().includes('gallery') ||
                            activity.toLowerCase().includes('exhibition')) {
                    searchOptions.type = 'museum';
                    searchOptions.keywords.push('art', 'museum', 'exhibit');
                  } else if (activity.toLowerCase().includes('park') || 
                            activity.toLowerCase().includes('garden') ||
                            activity.toLowerCase().includes('green')) {
                    searchOptions.type = 'park';
                    searchOptions.keywords.push('park', 'green space', 'outdoor');
                  } else if (activity.toLowerCase().includes('shop') || 
                            activity.toLowerCase().includes('shopping') ||
                            activity.toLowerCase().includes('mall')) {
                    searchOptions.type = 'shopping_mall';
                    searchOptions.keywords.push('shopping', 'shop', 'store');
                  } else if (activity.toLowerCase().includes('market')) {
                    searchOptions.type = 'store';
                    searchOptions.keywords.push('market', 'food market', 'shops');
                  } else {
                    // Default to attraction
                    searchOptions.type = 'tourist_attraction';
                    searchOptions.keywords.push('attraction', 'sight', 'landmark');
                  }
                }
                
                // Use parsed requirements if available
                if (parsed.preferences?.requirements && Array.isArray(parsed.preferences.requirements)) {
                  searchOptions.keywords = [
                    ...searchOptions.keywords,
                    ...parsed.preferences.requirements
                  ];
                }
                
                const venueResult = await searchPlace(activity, searchOptions);
                
                if (!venueResult || !venueResult.primary) {
                  console.log(`No suitable venue found for activity: ${activity}`);
                  continue;
                }
                
                // Use the primary venue from the result
                let suggestedPlace = venueResult.primary;

                if (suggestedPlace && !scheduledPlaces.has(suggestedPlace.place_id)) {
                // Calculate evenly spaced time for this activity
                // First activity starts after 90 mins, subsequent activities are spaced evenly
                const activityOffset = 90 * 60 * 1000 + (i + 1) * timeSpacing;
                const proposedTime = current.time.getTime() + activityOffset;
                
                // Ensure this time doesn't conflict with existing times
                // We'll consider anything within 60 minutes to be a conflict
                const timeConflict = existingTimes.some(
                  existingTime => Math.abs(existingTime - proposedTime) < 60 * 60 * 1000
                );
                
                if (timeConflict) {
                  console.log(`Time conflict detected at ${new Date(proposedTime).toLocaleTimeString()}, skipping activity`);
                  continue;
                }
                
                // Set activity time and add to existing times list to check for future conflicts
                const activityTime = new Date(proposedTime);
                existingTimes.push(activityTime.getTime());
                
                // Log the scheduled time clearly
                console.log(`Scheduling gap activity "${activity}" at ${activityTime.toLocaleTimeString()} (${format(activityTime, 'h:mm a')})`);
                
                try {
                  // Check if we should use a weather-aware venue recommendation
                  if (process.env.WEATHER_API_KEY && suggestedPlace.types) {
                    console.log("Checking weather conditions for outdoor activities...");
                    
                    // Determine if venue is outdoors based on its types
                    const isOutdoor = suggestedPlace.types && isVenueOutdoor(suggestedPlace.types);
                    suggestedPlace.isOutdoorVenue = isOutdoor;
                    
                    // Get weather-aware venue recommendation
                    const { venue: recommendedVenue, weatherSuitable } = await getWeatherAwareVenue(
                      suggestedPlace,
                      venueResult.alternatives,
                      suggestedPlace.geometry.location.lat,
                      suggestedPlace.geometry.location.lng,
                      activityTime
                    );
                    
                    // Set weather information on both the suggested place and alternatives
                    suggestedPlace.weatherSuitable = weatherSuitable;
                    
                    // If this venue has alternatives, mark them appropriately
                    if (venueResult.alternatives && venueResult.alternatives.length > 0) {
                      venueResult.alternatives.forEach(alt => {
                        alt.isOutdoorVenue = alt.types ? isVenueOutdoor(alt.types) : false;
                        alt.weatherSuitable = weatherSuitable;
                      });
                    }
                    
                    // If conditions are not suitable for outdoor venues and we have an alternative
                    if (!weatherSuitable && recommendedVenue !== suggestedPlace) {
                      console.log(`Weather conditions not optimal for ${suggestedPlace.name} (outdoor venue)`);
                      console.log(`Suggesting indoor alternative: ${recommendedVenue.name}`);
                      recommendedVenue.weatherAwareRecommendation = true;
                      suggestedPlace = recommendedVenue;
                    } else {
                      console.log(`Weather conditions suitable for outdoor activities at ${activityTime.toLocaleTimeString()}`);
                    }
                  }
                } catch (weatherError) {
                  console.warn("Weather service error (proceeding with original venue):", weatherError);
                }

                // Try to create the place with better error handling
                let newPlace;
                try {
                  newPlace = await storage.createPlace({
                    placeId: suggestedPlace.place_id,
                    name: suggestedPlace.name,
                    address: suggestedPlace.formatted_address,
                    location: suggestedPlace.geometry.location,
                    details: suggestedPlace,
                    alternatives: venueResult.alternatives,
                    scheduledTime: activityTime.toISOString(),
                  });
                } catch (placeError: any) {
                  // If we get a duplicate key error, try to fetch the existing place
                  if (placeError.code === '23505') {
                    console.warn(`Duplicate place found for ${suggestedPlace.name}, trying to fetch existing record`);
                    const existingPlace = await storage.getPlaceByPlaceId(suggestedPlace.place_id);
                    if (existingPlace) {
                      console.log(`Using existing place record for ${suggestedPlace.name}`);
                      newPlace = existingPlace;
                    } else {
                      throw placeError; // Re-throw if we can't recover
                    }
                  } else {
                    throw placeError; // Re-throw other errors
                  }
                }

                scheduledPlaces.add(suggestedPlace.place_id);
                itineraryPlaces.push({
                  place: newPlace,
                  time: new Date(activityTime),
                  isFixed: false
                });
                
                // Log the alternatives found
                console.log(`Added activity ${suggestedPlace.name} with ${venueResult.alternatives.length} alternatives`);
              }
              } catch (error) {
                console.error(`Error finding venue for activity "${activity}":`, error);
              }
            }
          }
        }
      }

      // Handle cases where preferences exist but no fixed times
      if (itineraryPlaces.length === 0 && (
          parsed.preferences?.type || 
          (parsed.preferences?.requirements && parsed.preferences.requirements.length > 0) ||
          (parsed.activities && parsed.activities.length > 0)
        )) {
        console.log(`No fixed times but found preference for ${parsed.preferences?.type || 'activities with requirements'} or activities`);
        
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
                  
                  // Mark this place as scheduled
                  scheduledPlaces.add(venueResult.primary.place_id);
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
          
          // Fallback to a single venue if no activities were added
          console.log("Falling back to single venue recommendation based on preferences");
          // Reset current time to now for the fallback option
          currentTime.setTime(new Date().getTime());
          
          // First check if we have direct activity search parameters from Gemini
          let searchOptions: any = { keywords: [], requireOpenNow: true, minRating: 4.0 };
          
          // Check if we have an activity with search parameters from the NLP parsing
          const hasRichParams = parsed.activities !== undefined && 
                              Array.isArray(parsed.activities) && 
                              parsed.activities.length > 0 && 
                              parsed.activities[0]?.searchParameters !== undefined;
          
          if (hasRichParams) {
            // Use the rich search parameters directly from Gemini's activity details
            const activity = parsed.activities![0];
            console.log(`Using rich search parameters from Gemini for "${activity.description}"`);
            
            searchOptions = {
              type: activity.searchParameters.type,
              keywords: Array.isArray(activity.searchParameters.keywords) ? 
                       activity.searchParameters.keywords : [],
              requireOpenNow: !!activity.searchParameters.requireOpenNow,
              minRating: activity.searchParameters.minRating || 4.0,
              searchTerm: activity.searchParameters.searchTerm
            };
            
            // Add any requirements as additional keywords
            if (Array.isArray(activity.requirements) && activity.requirements.length > 0) {
              searchOptions.keywords = [
                ...searchOptions.keywords,
                ...activity.requirements
              ];
            }
            
            // Enable review checking for specific food-related searches
            const isFoodSpecificSearch = activity.description.toLowerCase().includes('sandwich') || 
                                        activity.description.toLowerCase().includes('pizza') ||
                                        activity.description.toLowerCase().includes('pasta') ||
                                        activity.description.toLowerCase().includes('burger') ||
                                        activity.description.toLowerCase().includes('focaccia') ||
                                        activity.description.toLowerCase().includes('sushi');
            
            if (isFoodSpecificSearch) {
              console.log(`Enabling review checking for specific food search: ${activity.description}`);
              searchOptions.checkReviewsForKeywords = true;
              
              // Extract food item keywords from the description
              const foodKeywords = activity.description
                .toLowerCase()
                .split(' ')
                .filter((word: string) => 
                  word.length > 3 && 
                  !['with', 'and', 'the', 'for', 'near', 'good', 'nice', 'best'].includes(word)
                );
              
              if (foodKeywords.length > 0) {
                // Add specific food keywords at the beginning of the keywords list for higher priority
                searchOptions.keywords = [
                  ...foodKeywords,
                  ...searchOptions.keywords
                ];
              }
            }
          } else {
            // Fall back to regular preference-based search parameters
            
            // Add requirements as keywords for better place matching
            if (parsed.preferences.requirements && parsed.preferences.requirements.length > 0) {
              searchOptions.keywords = [...parsed.preferences.requirements];
            }
            
            // Map preference type to search type
            if (parsed.preferences.type) {
              if (parsed.preferences.type.includes('coffee') || 
                  parsed.preferences.type.includes('cafe')) {
                searchOptions.type = 'cafe';
                searchOptions.searchTerm = 'coffee shop';
              } else if (parsed.preferences.type.includes('restaurant') || 
                        parsed.preferences.type.includes('dinner') ||
                        parsed.preferences.type.includes('lunch')) {
                searchOptions.type = 'restaurant';
                searchOptions.searchTerm = parsed.preferences.type;
              } else if (parsed.preferences.type.includes('bar') || 
                        parsed.preferences.type.includes('pub') ||
                        parsed.preferences.type.includes('drinks')) {
                searchOptions.type = 'bar';
                searchOptions.searchTerm = parsed.preferences.type;
              } else {
                // Generic search based on preference type
                searchOptions.type = parsed.preferences.type;
                // Also use it as a search term
                searchOptions.searchTerm = parsed.preferences.type;
              }
            } else if (parsed.preferences.requirements && parsed.preferences.requirements.length > 0) {
              // Try to determine type from requirements
              const requirements = parsed.preferences.requirements.map(r => r.toLowerCase());
              
              if (requirements.some(r => r.includes('coffee') || r.includes('cafe') || r.includes('quiet'))) {
                searchOptions.type = 'cafe';
                searchOptions.searchTerm = 'coffee shop';
              } else if (requirements.some(r => r.includes('restaurant') || r.includes('dinner') || r.includes('food'))) {
                searchOptions.type = 'restaurant';
                searchOptions.searchTerm = 'restaurant';
              } else if (requirements.some(r => r.includes('bar') || r.includes('pub') || r.includes('drinks'))) {
                searchOptions.type = 'bar';
                searchOptions.searchTerm = 'bar';
              } else {
                // Default to a generic activity
                searchOptions.type = 'tourist_attraction';
                searchOptions.searchTerm = 'attraction';
              }
            }
          }
          
          console.log(`Searching for ${searchOptions.type} near ${parsed.startLocation} with params:`, searchOptions);
          
          // Perform the search
          const venueResult = await searchPlace(parsed.startLocation, searchOptions);
          
          if (venueResult && venueResult.primary) {
            console.log(`Found venue: ${venueResult.primary.name}`);
            
            // Try to create the place with better error handling
            let newPlace;
            try {
              newPlace = await storage.createPlace({
                placeId: venueResult.primary.place_id,
                name: venueResult.primary.name,
                address: venueResult.primary.formatted_address,
                location: venueResult.primary.geometry.location,
                details: venueResult.primary,
                scheduledTime: currentTime.toISOString(),
                alternatives: venueResult.alternatives || []
              });
            } catch (placeError: any) {
              // If we get a duplicate key error, try to fetch the existing place
              if (placeError.code === '23505') {
                console.warn(`Duplicate place found for ${venueResult.primary.name}, trying to fetch existing record`);
                const existingPlace = await storage.getPlace(venueResult.primary.place_id);
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
              time: currentTime,
              isFixed: false
            });
            
            // Mark this place as scheduled
            scheduledPlaces.add(venueResult.primary.place_id);
          }
        } catch (error) {
          console.error(`Error finding venue for preference ${parsed.preferences.type}:`, error);
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

  return httpServer;
}