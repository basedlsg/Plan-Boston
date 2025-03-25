import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { searchPlace } from "./lib/googlePlaces";
import { calculateTravelTime } from "./lib/itinerary";
import { parseItineraryRequest } from "./lib/nlp";
import { insertPlaceSchema, insertItinerarySchema, Place, PlaceDetails } from "@shared/schema";
import { z } from "zod";
import { format } from 'date-fns';
import { findAreasByCharacteristics, findQuietAreas, getAreaCrowdLevel, LondonArea } from "./data/london-areas";

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

// Update the findInterestingActivities function
function findInterestingActivities(
  location: string,
  duration: number,
  timeOfDay: string,
  preferences: { type?: string; requirements?: string[] } = {}
): string[] {
  const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;
  const hour = parseInt(timeOfDay.split(':')[0]);

  const getTimeSlot = (hour: number) => 
    hour < 12 ? 'morning'
    : hour < 14 ? 'midday'
    : hour < 17 ? 'afternoon'
    : 'evening';

  // Handle lunch-specific requests
  if (hour >= 12 && hour <= 15 && preferences.type?.includes('lunch')) {
    return [`restaurant near ${location}`];
  }

  // If user wants non-crowded places
  if (preferences.requirements?.includes('non-crowded')) {
    const quietAreas = findQuietAreas(timeOfDay, isWeekend, location);
    if (quietAreas.length > 0) {
      const currentTimeSlot = getTimeSlot(hour);

      // Get activity type based on time of day
      const activities = {
        morning: ['artisan cafe', 'specialty coffee'],
        midday: ['gallery', 'museum'],
        afternoon: ['boutique shopping', 'tea room'],
        evening: ['wine bar', 'cocktail bar']
      };

      const areaActivities = activities[currentTimeSlot];
      return quietAreas.slice(0, 1).map(area => {
        const activity = areaActivities[Math.floor(Math.random() * areaActivities.length)];
        return `${activity} in ${area.name}`;
      });
    }
  }

  // Find areas matching other characteristics
  const matchingAreas = findAreasByCharacteristics(
    preferences.requirements || [],
    location ? [location] : []
  );

  if (matchingAreas.length > 0) {
    return matchingAreas.slice(0, 1).map(area => {
      const timeAppropriate = hour >= 17 ? 'evening activity' : 'afternoon activity';
      return `interesting ${timeAppropriate} in ${area.name}`;
    });
  }

  // Default suggestions based on time
  const defaultActivities = {
    morning: ['artisan cafe', 'breakfast spot'],
    midday: ['lunch restaurant', 'bistro'],
    afternoon: ['tea room', 'art gallery'],
    evening: ['wine bar', 'cocktail bar']
  };

  const currentTimeSlot = getTimeSlot(hour);
  const activities = defaultActivities[currentTimeSlot];
  return [`${activities[0]} near ${location}`];
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
        const venueResult = await searchPlace(parsed.startLocation, {
          type: 'restaurant',
          openNow: true,
          minRating: 4.0
        });
        
        // Use the primary venue from the result
        const lunchPlace = venueResult.primary;

        if (lunchPlace) {
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
            scheduledTime: lunchTime.toISOString(),
          });

          scheduledPlaces.add(lunchPlace.place_id);
          itineraryPlaces.push({
            place: newPlace,
            time: lunchTime,
            isFixed: true
          });
        } else {
          console.error("Failed to find lunch venue near:", parsed.startLocation);
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

          if (!venueResult) {
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
              const venueResult = await searchPlace(activity, {
                openNow: true,
                minRating: 4.0
              });
              
              // Use the primary venue from the result
              const suggestedPlace = venueResult.primary;

              if (suggestedPlace && !scheduledPlaces.has(suggestedPlace.place_id)) {
                // Explicitly define the activity time
                const activityTime: Date = new Date(current.time.getTime() + 90 * 60 * 1000);

                const newPlace = await storage.createPlace({
                  placeId: suggestedPlace.place_id,
                  name: suggestedPlace.name,
                  address: suggestedPlace.formatted_address,
                  location: suggestedPlace.geometry.location,
                  details: suggestedPlace,
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

  return httpServer;
}