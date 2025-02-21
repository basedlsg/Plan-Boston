import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { searchPlace } from "./lib/googlePlaces";
import { calculateTravelTime } from "./lib/itinerary";
import { parseItineraryRequest } from "./lib/nlp";
import { insertPlaceSchema, insertItinerarySchema } from "@shared/schema";
import { z } from "zod";

function parseTimeString(timeStr: string): Date {
  const baseDate = new Date();
  baseDate.setHours(9, 0, 0, 0);  // Start day at 9 AM by default

  // Try 24-hour format first (HH:MM)
  const military = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (military) {
    const [_, hours, minutes] = military;
    const date = new Date(baseDate);
    date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    return date;
  }

  // Try 12-hour format (HH:MM AM/PM)
  const standard = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (standard) {
    let [_, hours, minutes, period] = standard;
    let hour = parseInt(hours);

    // Convert to 24-hour format
    if (period.toUpperCase() === 'PM' && hour !== 12) {
      hour += 12;
    } else if (period.toUpperCase() === 'AM' && hour === 12) {
      hour = 0;
    }

    const date = new Date(baseDate);
    date.setHours(hour, parseInt(minutes), 0, 0);
    return date;
  }

  throw new Error(`Invalid time format: ${timeStr}. Please use either "HH:MM" (24-hour) or "HH:MM AM/PM" (12-hour) format.`);
}

export async function registerRoutes(app: Express) {
  const httpServer = createServer(app);

  app.post("/api/plan", async (req, res) => {
    try {
      const querySchema = z.object({ query: z.string() });
      const { query } = querySchema.parse(req.body);

      // Parse the request using Claude
      const parsed = await parseItineraryRequest(query);
      console.log("Parsed request:", parsed);

      const verifiedPlaces = [];
      const scheduledTimes = new Map<string, Date>();

      // First handle fixed-time appointments
      for (const timeSlot of parsed.fixedTimes) {
        const place = await searchPlace(timeSlot.location);
        if (!place) {
          throw new Error(`Could not find location: ${timeSlot.location}`);
        }

        try {
          const appointmentTime = parseTimeString(timeSlot.time);
          scheduledTimes.set(timeSlot.location, appointmentTime);

          const newPlace = await storage.createPlace({
            placeId: timeSlot.location,
            name: place.name,
            address: place.formatted_address,
            location: place.geometry.location,
            details: place,
            scheduledTime: appointmentTime.toISOString(),
          });
          verifiedPlaces.push(newPlace);
        } catch (error: any) {
          throw new Error(`Error scheduling ${timeSlot.location}: ${error.message}`);
        }
      }

      // Initialize current time to 9 AM if no fixed appointments
      let currentTime = new Date();
      currentTime.setHours(9, 0, 0, 0);


      // Find and add places matching preferences
      if (parsed.preferences.type) {
        const searchQuery = `${parsed.preferences.type} near ${parsed.startLocation}`;
        const suggestedPlace = await searchPlace(searchQuery);
        if (suggestedPlace) {
          // Avoid duplicates
          if (!verifiedPlaces.some(p => p.name === suggestedPlace.name)) {
            verifiedPlaces.push(await storage.createPlace({
              placeId: searchQuery,
              name: suggestedPlace.name,
              address: suggestedPlace.formatted_address,
              location: suggestedPlace.geometry.location,
              details: suggestedPlace,
              scheduledTime: currentTime.toISOString(),
            }));

            // Update current time
            currentTime.setMinutes(currentTime.getMinutes() + 90); // Default 90 min visit
          }
        }
      }

      // Add remaining destinations
      for (const destination of parsed.destinations) {
        if (scheduledTimes.has(destination)) continue; // Skip if already scheduled

        const place = await searchPlace(destination);
        if (place && !verifiedPlaces.some(p => p.name === place.name)) {
          const placeTime = new Date(currentTime);
          verifiedPlaces.push(await storage.createPlace({
            placeId: destination,
            name: place.name,
            address: place.formatted_address,
            location: place.geometry.location,
            details: place,
            scheduledTime: placeTime.toISOString(),
          }));

          currentTime.setMinutes(currentTime.getMinutes() + 90); // Default 90 min visit
        }
      }

      if (verifiedPlaces.length < 1) {
        throw new Error("Could not find enough valid locations. Please provide more specific places in London.");
      }

      // Calculate travel times and update schedule
      const travelTimes = [];
      let lastPlace = await searchPlace(parsed.startLocation);

      for (let i = 0; i < verifiedPlaces.length; i++) {
        const currentPlace = verifiedPlaces[i];

        if (lastPlace && currentPlace.details) {
          const travelTime = calculateTravelTime(lastPlace, currentPlace.details);
          travelTimes.push({
            from: lastPlace.name,
            to: currentPlace.name,
            duration: travelTime
          });
        }

        lastPlace = currentPlace.details;
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