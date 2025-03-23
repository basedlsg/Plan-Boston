import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { searchPlace } from "./lib/googlePlaces";
import { calculateTravelTime } from "./lib/itinerary";
import { parseItineraryRequest } from "./lib/nlp";
import { insertPlaceSchema, insertItinerarySchema } from "@shared/schema";
import { z } from "zod";
import { format } from 'date-fns';

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

function findInterestingActivities(location: string, duration: number, timeOfDay: string): string[] {
  // Activities categorized by time of day and duration
  const activities = {
    morning: [
      'artisan bakery',
      'farmers market',
      'yoga studio',
      'morning walking tour',
      'specialty coffee roaster',
      'local breakfast spot'
    ],
    midday: [
      'art gallery',
      'museum',
      'historic site',
      'garden',
      'park',
      'cultural center',
      'exhibition space',
      'lunch spot',
      'food market',
      'bistro'
    ],
    afternoon: [
      'boutique shopping',
      'craft workshop',
      'tea room',
      'bookstore',
      'local market',
      'riverside walk',
      'antique shop',
      'chocolate shop',
      'design gallery'
    ],
    evening: [
      'wine bar',
      'jazz club',
      'theater',
      'comedy club',
      'rooftop bar',
      'live music venue',
      'cocktail bar',
      'art cinema'
    ]
  };

  // Select appropriate activities based on time of day
  let timeSlot: 'morning' | 'midday' | 'afternoon' | 'evening' = 'midday';
  const hour = parseInt(timeOfDay.split(':')[0]);

  if (hour < 12) {
    timeSlot = 'morning';
  } else if (hour < 14) {
    timeSlot = 'midday';
  } else if (hour < 17) {
    timeSlot = 'afternoon';
  } else {
    timeSlot = 'evening';
  }

  // For longer durations (>3 hours), suggest multiple varied activities
  const activityCount = Math.min(Math.ceil(duration / 2), 3); // Max 3 activities, minimum 1 per 2 hours
  const selectedActivities = [];

  // If it's around lunchtime (12-2pm), prioritize food options
  if (hour >= 12 && hour <= 14 && !selectedActivities.includes('lunch spot')) {
    selectedActivities.push('lunch spot');
  }

  // Get main activities for the time slot
  const currentTimeSlotActivities = activities[timeSlot].filter(a => !selectedActivities.includes(a));
  const mainActivity = currentTimeSlotActivities[Math.floor(Math.random() * currentTimeSlotActivities.length)];
  selectedActivities.push(mainActivity);

  // If we need more activities, get them from appropriate time slots
  if (activityCount > 1) {
    const nextTimeSlot = timeSlot === 'morning' ? 'midday' : 
                        timeSlot === 'midday' ? 'afternoon' : 
                        timeSlot === 'afternoon' ? 'evening' : 'evening';

    const nextSlotActivities = activities[nextTimeSlot].filter(a => !selectedActivities.includes(a));
    const nextActivity = nextSlotActivities[Math.floor(Math.random() * nextSlotActivities.length)];
    selectedActivities.push(nextActivity);

    // For very long gaps, add a third activity
    if (activityCount > 2) {
      const remainingActivities = [...activities[timeSlot], ...activities[nextTimeSlot]]
        .filter(a => !selectedActivities.includes(a));
      const extraActivity = remainingActivities[Math.floor(Math.random() * remainingActivities.length)];
      selectedActivities.push(extraActivity);
    }
  }

  // Add specific location context to each activity
  return selectedActivities.map(activity => {
    // If the activity is lunch-related, specify "restaurant" or "casual dining"
    if (activity === 'lunch spot') {
      return `casual dining restaurant near ${location}`;
    }
    return `${activity} near ${location}`;
  });
}

export async function registerRoutes(app: Express) {
  const httpServer = createServer(app);

  // Add endpoint to get current server time
  app.get("/api/time", (_req, res) => {
    const now = new Date();
    res.json({ 
      currentTime: now.toISOString(),
      timestamp: now.getTime(),
      timezone: {
        offset: -now.getTimezoneOffset(),
        name: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    });
  });

  app.post("/api/plan", async (req, res) => {
    try {
      const requestSchema = z.object({ 
        query: z.string(),
        date: z.string().optional(), // Allow custom date
        startTime: z.string().optional() // Allow custom start time
      });

      const { query, date, startTime } = requestSchema.parse(req.body);

      // Parse the request using Claude
      const parsed = await parseItineraryRequest(query);
      console.log("Parsed request:", parsed);

      // Initialize base date from request or use current date
      const baseDate = date ? new Date(date) : new Date();

      // Initialize start time
      let currentTime: Date;
      if (startTime) {
        currentTime = parseTimeString(startTime, baseDate);
      } else {
        currentTime = new Date(baseDate);
        currentTime.setHours(9, 0, 0, 0); // Default to 9 AM
      }

      const scheduledPlaces = [];

      // First handle fixed-time appointments
      for (const timeSlot of parsed.fixedTimes) {
        const place = await searchPlace(timeSlot.location);
        if (!place) {
          throw new Error(`Could not find location: ${timeSlot.location}`);
        }

        try {
          const appointmentTime = parseTimeString(timeSlot.time, baseDate);

          const newPlace = await storage.createPlace({
            placeId: timeSlot.location,
            name: place.name,
            address: place.formatted_address,
            location: place.geometry.location,
            details: place,
            scheduledTime: appointmentTime.toISOString(),
          });

          scheduledPlaces.push({
            place: newPlace,
            time: appointmentTime,
            isFixed: true
          });
        } catch (error: any) {
          throw new Error(`Error scheduling ${timeSlot.location}: ${error.message}`);
        }
      }

      // Sort fixed appointments to find gaps
      scheduledPlaces.sort((a, b) => a.time.getTime() - b.time.getTime());

      // If we have preferences (like coffee shop), schedule it first
      if (parsed.preferences?.type) {
        const preferenceQuery = `${parsed.preferences.type} ${parsed.preferences.requirements?.join(' ')} near ${parsed.startLocation}`;
        const suggestedPlace = await searchPlace(preferenceQuery);

        if (suggestedPlace) {
          const newPlace = await storage.createPlace({
            placeId: `preference-${Date.now()}`,
            name: suggestedPlace.name,
            address: suggestedPlace.formatted_address,
            location: suggestedPlace.geometry.location,
            details: suggestedPlace,
            scheduledTime: currentTime.toISOString(),
          });

          scheduledPlaces.push({
            place: newPlace,
            time: new Date(currentTime),
            isFixed: false
          });

          // Move current time forward
          currentTime.setMinutes(currentTime.getMinutes() + 90);
        }
      }

      // Find and fill time gaps with interesting activities
      const filledSchedule = [...scheduledPlaces].sort((a, b) => a.time.getTime() - b.time.getTime());

      for (let i = 0; i < filledSchedule.length - 1; i++) {
        const current = filledSchedule[i];
        const next = filledSchedule[i + 1];

        // Calculate gap between activities
        const gap = next.time.getTime() - (current.time.getTime() + 90 * 60 * 1000); // 90 min for current activity

        // If we have more than 1.5 hours between activities, add something interesting
        if (gap > 1.5 * 60 * 60 * 1000) {
          const activityTime = new Date(current.time.getTime() + 90 * 60 * 1000);
          const timeStr = format(activityTime, 'HH:mm');

          const activityQueries = findInterestingActivities(
            current.place.name,
            gap / (60 * 60 * 1000),
            timeStr
          );

          for (const query of activityQueries) {
            const suggestedActivity = await searchPlace(query);
            if (suggestedActivity) {
              const newPlace = await storage.createPlace({
                placeId: `activity-${Date.now()}-${i}`,
                name: suggestedActivity.name,
                address: suggestedActivity.formatted_address,
                location: suggestedActivity.geometry.location,
                details: suggestedActivity,
                scheduledTime: activityTime.toISOString(),
              });

              filledSchedule.push({
                place: newPlace,
                time: new Date(activityTime),
                isFixed: false
              });

              // Move time forward for next activity if multiple activities
              activityTime.setMinutes(activityTime.getMinutes() + 90);
            }
          }
        }
      }

      // Final sort of all activities
      filledSchedule.sort((a, b) => a.time.getTime() - b.time.getTime());

      // Calculate travel times between places
      const travelTimes = [];
      const startPlace = await searchPlace(parsed.startLocation);
      if (!startPlace) {
        throw new Error(`Could not find start location: ${parsed.startLocation}`);
      }

      let lastPlace = startPlace;
      for (const scheduledPlace of filledSchedule) {
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

      const itinerary = await storage.createItinerary({
        query,
        places: filledSchedule.map(sp => sp.place),
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