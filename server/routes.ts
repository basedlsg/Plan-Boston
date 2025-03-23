import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { searchPlace } from "./lib/googlePlaces";
import { calculateTravelTime } from "./lib/itinerary";
import { parseItineraryRequest } from "./lib/nlp";
import { insertPlaceSchema, insertItinerarySchema } from "@shared/schema";
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

  // If user wants non-crowded places, use the quiet areas helper
  if (preferences.requirements?.includes('non-crowded')) {
    const quietAreas = findQuietAreas(timeOfDay, isWeekend, location);
    if (quietAreas.length > 0) {
      return quietAreas.slice(0, 2).map(area => 
        `${preferences.type || 'activity'} in ${area.name}`
      );
    }
  }

  // Find areas matching other characteristics
  const matchingAreas = findAreasByCharacteristics(
    preferences.requirements || [],
    [location] // Exclude current location to prevent duplicates
  );

  if (matchingAreas.length > 0) {
    return matchingAreas.slice(0, 2).map(area => 
      `${preferences.type || 'interesting activity'} in ${area.name}`
    );
  }

  // Fallback to default activities if no specific matches
  const activities = {
    morning: [
      'artisan bakery',
      'farmers market',
      'specialty coffee roaster',
      'local breakfast spot'
    ],
    midday: [
      'art gallery',
      'museum',
      'historic site',
      'garden',
      'cultural center',
      'lunch spot'
    ],
    afternoon: [
      'boutique shopping',
      'tea room',
      'local market',
      'design gallery'
    ],
    evening: [
      'wine bar',
      'jazz club',
      'cocktail bar',
      'art cinema'
    ]
  };

  // Select appropriate activities based on time of day
  const hour = parseInt(timeOfDay.split(':')[0]);
  const timeSlot = hour < 12 ? 'morning' 
                : hour < 14 ? 'midday'
                : hour < 17 ? 'afternoon'
                : 'evening';

  const selectedActivities = [];

  // For longer durations, suggest multiple varied activities
  const activityCount = Math.min(Math.ceil(duration / 2), 3);

  // Get activities from current time slot
  const currentActivities = activities[timeSlot].filter(a => 
    !selectedActivities.includes(a)
  );

  selectedActivities.push(
    ...currentActivities
      .sort(() => Math.random() - 0.5)
      .slice(0, activityCount)
  );

  // Add location context to each activity
  return selectedActivities.map(activity => `${activity} near ${location}`);
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

      if (!parsed.startLocation) {
        throw new Error("Please specify a starting location in your request. For example: 'Starting from Green Park...'");
      }

      // Initialize base date and time
      const baseDate = date ? new Date(date) : new Date();
      let currentTime = startTime 
        ? parseTimeString(startTime, baseDate)
        : new Date(baseDate.setHours(9, 0, 0, 0));

      const scheduledPlaces = new Set(); // Track unique places
      const itineraryPlaces = [];

      // Handle fixed-time appointments first
      for (const timeSlot of parsed.fixedTimes) {
        try {
          const appointmentTime = parseTimeString(timeSlot.time, baseDate);
          const place = await searchPlace(timeSlot.location);

          if (!place) {
            throw new Error(`Could not find location: ${timeSlot.location}`);
          }

          if (scheduledPlaces.has(place.place_id)) {
            continue; // Skip duplicate locations
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
          throw new Error(`Error scheduling ${timeSlot.location}: ${error.message}`);
        }
      }

      // Sort fixed appointments chronologically
      itineraryPlaces.sort((a, b) => a.time.getTime() - b.time.getTime());

      // Fill gaps with interesting activities based on preferences
      if (parsed.preferences?.type || parsed.preferences?.requirements) {
        for (let i = 0; i < itineraryPlaces.length - 1; i++) {
          const current = itineraryPlaces[i];
          const next = itineraryPlaces[i + 1];

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
              const suggestedPlace = await searchPlace(activity);
              if (suggestedPlace && !scheduledPlaces.has(suggestedPlace.place_id)) {
                const activityTime = new Date(current.time.getTime() + 90 * 60 * 1000);

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
              }
            }
          }
        }
      }

      // Final chronological sort
      itineraryPlaces.sort((a, b) => a.time.getTime() - b.time.getTime());

      // Calculate travel times between places
      const travelTimes = [];
      let lastPlace = null;

      for (const scheduledPlace of itineraryPlaces) {
        if (lastPlace && scheduledPlace.place.details) {
          const travelTime = calculateTravelTime(lastPlace, scheduledPlace.place.details);
          travelTimes.push({
            from: lastPlace.name,
            to: scheduledPlace.place.name,
            duration: travelTime,
            arrivalTime: scheduledPlace.time.toISOString()
          });
        }
        lastPlace = scheduledPlace.place.details;
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