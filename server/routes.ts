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
      console.log("Parsed request:", parsed); // Debug log

      // Verify all locations and find appropriate places
      const verifiedPlaces = [];

      // First verify the start location
      const startPlace = await searchPlace(parsed.startLocation);
      if (!startPlace) {
        throw new Error(`Could not find starting location: ${parsed.startLocation}`);
      }
      verifiedPlaces.push(await storage.createPlace({
        placeId: parsed.startLocation,
        name: startPlace.name,
        address: startPlace.formatted_address,
        location: startPlace.geometry.location,
        details: startPlace,
      }));

      // Handle fixed-time destinations
      for (const timeSlot of parsed.fixedTimes) {
        const place = await searchPlace(timeSlot.location);
        if (!place) {
          throw new Error(`Could not find location: ${timeSlot.location}`);
        }
        verifiedPlaces.push(await storage.createPlace({
          placeId: timeSlot.location,
          name: place.name,
          address: place.formatted_address,
          location: place.geometry.location,
          details: place,
        }));
      }

      // Find places matching preferences if specified
      if (parsed.preferences.type) {
        const searchQuery = `${parsed.preferences.type} near ${parsed.startLocation}`;
        const suggestedPlace = await searchPlace(searchQuery);
        if (suggestedPlace) {
          verifiedPlaces.push(await storage.createPlace({
            placeId: searchQuery,
            name: suggestedPlace.name,
            address: suggestedPlace.formatted_address,
            location: suggestedPlace.geometry.location,
            details: suggestedPlace,
          }));
        }
      }

      // Add other specified destinations
      for (const destination of parsed.destinations) {
        const place = await searchPlace(destination);
        if (place) {
          verifiedPlaces.push(await storage.createPlace({
            placeId: destination,
            name: place.name,
            address: place.formatted_address,
            location: place.geometry.location,
            details: place,
          }));
        }
      }

      if (verifiedPlaces.length < 2) {
        throw new Error("Could not find enough valid locations. Please provide more specific places in London.");
      }

      // Calculate travel times between consecutive places
      const travelTimes = [];
      for (let i = 0; i < verifiedPlaces.length - 1; i++) {
        const from = verifiedPlaces[i].details as any;
        const to = verifiedPlaces[i + 1].details as any;
        const time = calculateTravelTime(from, to);
        travelTimes.push({
          from: verifiedPlaces[i].placeId,
          to: verifiedPlaces[i + 1].placeId,
          duration: time,
        });
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