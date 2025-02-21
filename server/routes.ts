import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { searchPlace } from "./lib/googlePlaces";
import { calculateTravelTime } from "./lib/itinerary";
import { parseItineraryRequest } from "./lib/nlp";
import { insertPlaceSchema, insertItinerarySchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express) {
  const httpServer = createServer(app);

  app.post("/api/plan", async (req, res) => {
    try {
      const querySchema = z.object({ query: z.string() });
      const { query } = querySchema.parse(req.body);

      // Parse the request using Claude Haiku
      const parsed = await parseItineraryRequest(query);
      console.log("Parsed request:", parsed);

      const verifiedPlaces = [];
      const scheduledTimes = new Map(); // Track scheduled times for each place

      // Start time defaults to 9 AM if not specified
      let currentTime = new Date();
      currentTime.setHours(9, 0, 0, 0);

      // First handle fixed-time appointments to anchor the schedule
      for (const timeSlot of parsed.fixedTimes) {
        const place = await searchPlace(timeSlot.location);
        if (!place) {
          throw new Error(`Could not find location: ${timeSlot.location}`);
        }

        // Parse the time and set it
        const [hours, minutes] = timeSlot.time.split(':').map(Number);
        const appointmentTime = new Date(currentTime);
        appointmentTime.setHours(hours, minutes, 0, 0);

        scheduledTimes.set(timeSlot.location, appointmentTime);

        verifiedPlaces.push(await storage.createPlace({
          placeId: timeSlot.location,
          name: place.name,
          address: place.formatted_address,
          location: place.geometry.location,
          details: place,
        }));
      }

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
            }));
          }
        }
      }

      // Add other specified destinations
      for (const destination of parsed.destinations) {
        const place = await searchPlace(destination);
        if (place && !verifiedPlaces.some(p => p.name === place.name)) {
          verifiedPlaces.push(await storage.createPlace({
            placeId: destination,
            name: place.name,
            address: place.formatted_address,
            location: place.geometry.location,
            details: place,
          }));
        }
      }

      if (verifiedPlaces.length < 1) {
        throw new Error("Could not find enough valid locations. Please provide more specific places in London.");
      }

      // Calculate travel times and schedule remaining places
      const travelTimes = [];
      let lastPlace = await searchPlace(parsed.startLocation); // Start location for first travel time

      for (let i = 0; i < verifiedPlaces.length; i++) {
        const currentPlace = verifiedPlaces[i];

        // Calculate travel time from previous location
        if (lastPlace) {
          const time = calculateTravelTime(lastPlace, currentPlace.details as any);
          travelTimes.push({
            from: lastPlace.name,
            to: currentPlace.name,
            duration: time,
          });

          // Schedule time if not already set
          if (!scheduledTimes.has(currentPlace.placeId)) {
            const visitTime = new Date(currentTime);
            visitTime.setMinutes(visitTime.getMinutes() + time); // Add travel time
            scheduledTimes.set(currentPlace.placeId, visitTime);
          }

          // Update current time for next iteration
          currentTime = new Date(scheduledTimes.get(currentPlace.placeId)!);
          currentTime.setMinutes(currentTime.getMinutes() + 90); // Default 90 min for each visit
        }

        lastPlace = currentPlace.details as any;
      }

      const itinerary = await storage.createItinerary({
        query,
        places: verifiedPlaces.map(place => ({
          ...place,
          scheduledTime: scheduledTimes.get(place.placeId)?.toISOString(),
        })),
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