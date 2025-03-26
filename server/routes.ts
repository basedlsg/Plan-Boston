import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { searchPlace } from "./lib/googlePlaces";
import { calculateTravelTime } from "./lib/itinerary";
import { parseItineraryRequest } from "./lib/nlp";
import { insertPlaceSchema, insertItinerarySchema, Place, PlaceDetails } from "@shared/schema";
import { z } from "zod";
import { format } from 'date-fns';
import { findAreasByCharacteristics, findQuietAreas, getAreaCrowdLevel, LondonArea, londonAreas } from "./data/london-areas";
import { getWeatherForecast, isVenueOutdoor, isWeatherSuitableForOutdoor, getWeatherAwareVenue } from "./lib/weatherService";

// Improved time parsing and validation
function parseTimeString(timeStr: string, baseDate?: Date): Date {
  // Use provided base date or current device time
  const currentDate = baseDate || new Date();
  const defaultStartTime = new Date(currentDate);
  defaultStartTime.setHours(9, 0, 0, 0);  // Default to 9 AM if no time specified

  // Try 24-hour format first (HH:MM)
  const military = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (military) {
    const [_, hours, minutes] = military;
    const date = new Date(currentDate);
    date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    return date;
  }

  // Try 12-hour format (HH:MM AM/PM)
  const standard = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (standard) {
    let [_, hours, minutes, period] = standard;
    let hour = parseInt(hours);

    if (period.toUpperCase() === 'PM' && hour !== 12) {
      hour += 12;
    } else if (period.toUpperCase() === 'AM' && hour === 12) {
      hour = 0;
    }

    const date = new Date(currentDate);
    date.setHours(hour, parseInt(minutes), 0, 0);
    return date;
  }

  throw new Error(`Invalid time format: ${timeStr}. Please use either "HH:MM" (24-hour) or "HH:MM AM/PM" (12-hour) format.`);
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
          const venueResult = await searchPlace(parsed.startLocation, {
            type: 'restaurant',
            openNow: true,
            minRating: 4.0
          });
          
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
                
                // Check if it's an outdoor venue and if weather conditions are suitable
                const { venue: recommendedVenue, weatherSuitable } = await getWeatherAwareVenue(
                  lunchPlace,
                  venueResult.alternatives,
                  lunchPlace.geometry.location.lat,
                  lunchPlace.geometry.location.lng,
                  lunchTime
                );
                
                // If weather is not suitable and we have an indoor alternative
                if (!weatherSuitable && recommendedVenue !== lunchPlace) {
                  console.log(`Weather not optimal for ${lunchPlace.name} - outdoor seating may be uncomfortable`);
                  console.log(`Suggesting alternative lunch venue: ${recommendedVenue.name}`);
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
            type: timeSlot.type
          });

          const appointmentTime = parseTimeString(timeSlot.time, baseDate);
          const venueResult = await searchPlace(timeSlot.location, {
            type: timeSlot.type,
            openNow: true
          });

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

          const newPlace = await storage.createPlace({
            placeId: place.place_id,
            name: place.name,
            address: place.formatted_address,
            location: place.geometry.location,
            details: place,
            alternatives: venueResult.alternatives,
            scheduledTime: appointmentTime.toISOString(),
          });

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

            for (const activity of suggestedActivities) {
              try {
                const venueResult = await searchPlace(activity, {
                  openNow: true,
                  minRating: 4.0
                });
                
                if (!venueResult || !venueResult.primary) {
                  console.log(`No suitable venue found for activity: ${activity}`);
                  continue;
                }
                
                // Use the primary venue from the result
                let suggestedPlace = venueResult.primary;

                if (suggestedPlace && !scheduledPlaces.has(suggestedPlace.place_id)) {
                // Explicitly define the activity time
                const activityTime: Date = new Date(current.time.getTime() + 90 * 60 * 1000);
                
                try {
                  // Check if we should use a weather-aware venue recommendation
                  if (process.env.WEATHER_API_KEY && suggestedPlace.types) {
                    console.log("Checking weather conditions for outdoor activities...");
                    
                    // Get weather-aware venue recommendation
                    const { venue: recommendedVenue, weatherSuitable } = await getWeatherAwareVenue(
                      suggestedPlace,
                      venueResult.alternatives,
                      suggestedPlace.geometry.location.lat,
                      suggestedPlace.geometry.location.lng,
                      activityTime
                    );
                    
                    // If conditions are not suitable for outdoor venues and we have an alternative
                    if (!weatherSuitable && recommendedVenue !== suggestedPlace) {
                      console.log(`Weather conditions not optimal for ${suggestedPlace.name} (outdoor venue)`);
                      console.log(`Suggesting indoor alternative: ${recommendedVenue.name}`);
                      suggestedPlace = recommendedVenue;
                    } else {
                      console.log(`Weather conditions suitable for outdoor activities at ${activityTime.toLocaleTimeString()}`);
                    }
                  }
                } catch (weatherError) {
                  console.warn("Weather service error (proceeding with original venue):", weatherError);
                }

                const newPlace = await storage.createPlace({
                  placeId: suggestedPlace.place_id,
                  name: suggestedPlace.name,
                  address: suggestedPlace.formatted_address,
                  location: suggestedPlace.geometry.location,
                  details: suggestedPlace,
                  alternatives: venueResult.alternatives,
                  scheduledTime: activityTime.toISOString(),
                });

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
      const itinerary = await storage.createItinerary({
        query,
        places: itineraryPlaces.map(sp => sp.place),
        travelTimes,
      });

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