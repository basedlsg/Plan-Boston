import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const places = pgTable("places", {
  id: serial("id").primaryKey(),
  placeId: text("place_id").notNull().unique(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  location: jsonb("location").notNull(),
  details: jsonb("details").notNull(),
  alternatives: jsonb("alternatives"),  // Store alternative venues
  scheduledTime: text("scheduled_time"),
});

export const itineraries = pgTable("itineraries", {
  id: serial("id").primaryKey(),
  query: text("query").notNull(),
  places: jsonb("places").notNull(),
  travelTimes: jsonb("travel_times").notNull(),
  created: timestamp("created").notNull().defaultNow(),
});

export const insertPlaceSchema = createInsertSchema(places).omit({ id: true });
export const insertItinerarySchema = createInsertSchema(itineraries).omit({ id: true, created: true });

export type Place = typeof places.$inferSelect;
export type InsertPlace = z.infer<typeof insertPlaceSchema>;
export type Itinerary = typeof itineraries.$inferSelect;
export type InsertItinerary = z.infer<typeof insertItinerarySchema>;

export type PlaceDetails = {
  name: string;
  formatted_address: string;
  place_id: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  types?: string[];
  rating?: number;
  opening_hours?: {
    open_now?: boolean;
    periods?: Array<{
      open: { time: string; day: number };
      close: { time: string; day: number };
    }>;
  };
  is_primary?: boolean;
  distance_from_primary?: number;
  area_info?: any;
  // Additional fields for enhanced context
  activityDescription?: string;
  requirements?: string[];
  searchTermUsed?: string;
  // Weather-related information
  isOutdoorVenue?: boolean;
  weatherSuitable?: boolean;
  weatherAwareRecommendation?: boolean;
};

export type VenueSearchResult = {
  primary: PlaceDetails;
  alternatives: PlaceDetails[];
};

export type SearchParameters = {
  searchTerm: string;
  type: string;
  keywords: string[];
  minRating: number;
  requireOpenNow: boolean;
};

export type Activity = {
  description: string;
  location: string;
  time: string;
  searchParameters: SearchParameters;
  requirements: string[];
};

export type EnhancedRequest = {
  startLocation: string | null;
  destinations: string[];
  activities: Activity[];
  preferences: {
    venueQualities: string[];
    restrictions: string[];
  };
};