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

      // Store all places with their times for sorting
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

      // If we have preferences, find and schedule a place that matches
      if (parsed.preferences?.type) {
        const preferenceQuery = `${parsed.preferences.type} ${parsed.preferences.requirements?.join(' ')} near ${parsed.startLocation}`;
        const suggestedPlace = await searchPlace(preferenceQuery);

        if (suggestedPlace) {
          // Schedule the suggested place for the current time
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

          // Move current time forward by 90 minutes for the coffee shop visit
          currentTime.setMinutes(currentTime.getMinutes() + 90);
        }
      }

      // Add remaining flexible destinations
      for (const destination of parsed.destinations) {
        // Skip if already scheduled as fixed time
        if (scheduledPlaces.some(p => p.place.placeId === destination)) continue;

        const place = await searchPlace(destination);
        if (place) {
          scheduledPlaces.push({
            place: await storage.createPlace({
              placeId: destination,
              name: place.name,
              address: place.formatted_address,
              location: place.geometry.location,
              details: place,
              scheduledTime: currentTime.toISOString(),
            }),
            time: new Date(currentTime),
            isFixed: false
          });

          // Increment time for next flexible destination
          currentTime.setMinutes(currentTime.getMinutes() + 90); // Default 90 min visit
        }
      }

      // Sort places by time
      scheduledPlaces.sort((a, b) => a.time.getTime() - b.time.getTime());

      // Extract the sorted places
      const verifiedPlaces = scheduledPlaces.map(sp => sp.place);

      // Calculate travel times between sorted places
      const travelTimes = [];
      const startPlace = await searchPlace(parsed.startLocation);
      if (!startPlace) {
        throw new Error(`Could not find start location: ${parsed.startLocation}`);
      }

      let lastPlace = startPlace;
      for (const scheduledPlace of scheduledPlaces) {
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
        places: verifiedPlaces,
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