import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { searchPlace } from "./lib/googlePlaces";
import { calculateTravelTime } from "./lib/itinerary";
import { parseItineraryRequest } from "./lib/nlp";
import { insertPlaceSchema, insertItinerarySchema } from "@shared/schema";
import { z } from "zod";

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

function findInterestingActivities(location: string, duration: number) {
  const activities = [
    'art gallery',
    'museum',
    'bookstore',
    'park',
    'local market',
    'historic site'
  ];

  // Randomly select an activity type based on available time
  const activityType = activities[Math.floor(Math.random() * activities.length)];
  return `${activityType} near ${location}`;
}

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

      // If we have preferences (like coffee shop), schedule it
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

        // If we have more than 2 hours between activities, add something interesting
        if (gap > 2 * 60 * 60 * 1000) {
          const activityTime = new Date(current.time.getTime() + 90 * 60 * 1000);
          const activityQuery = findInterestingActivities(current.place.name, gap / (60 * 60 * 1000));

          const suggestedActivity = await searchPlace(activityQuery);
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
              time: activityTime,
              isFixed: false
            });
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