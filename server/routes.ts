import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { searchPlace } from "./lib/googlePlaces";
import { calculateTravelTime } from "./lib/itinerary";
import { insertPlaceSchema, insertItinerarySchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express) {
  const httpServer = createServer(app);

  app.post("/api/plan", async (req, res) => {
    try {
      const querySchema = z.object({ query: z.string() });
      const { query } = querySchema.parse(req.body);

      // Mock natural language processing
      const locations = query.match(/(?:in|at|from|to)\s+([^,\.]+)(?:[,\.]|\s+and\s+|$)/g)
        ?.map(match => match.replace(/^(?:in|at|from|to)\s+/, '').trim())
        ?? [];

      if (locations.length === 0) {
        throw new Error("No locations found in query");
      }

      // Verify places
      const verifiedPlaces = [];
      for (const location of locations) {
        const placeDetails = await searchPlace(location);
        if (!placeDetails) continue;

        const place = await storage.createPlace({
          placeId: location,
          name: placeDetails.name,
          address: placeDetails.formatted_address,
          location: placeDetails.geometry.location,
          details: placeDetails,
        });
        verifiedPlaces.push(place);
      }

      if (verifiedPlaces.length < 2) {
        throw new Error("Not enough valid locations found");
      }

      // Calculate travel times
      const travelTimes = [];
      for (let i = 0; i < verifiedPlaces.length - 1; i++) {
        const from = verifiedPlaces[i].details;
        const to = verifiedPlaces[i + 1].details;
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
