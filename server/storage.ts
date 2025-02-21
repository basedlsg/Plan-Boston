import { type Place, type InsertPlace, type Itinerary, type InsertItinerary } from "@shared/schema";

export interface IStorage {
  getPlace(placeId: string): Promise<Place | undefined>;
  createPlace(place: InsertPlace): Promise<Place>;
  createItinerary(itinerary: InsertItinerary): Promise<Itinerary>;
  getItinerary(id: number): Promise<Itinerary | undefined>;
}

export class MemStorage implements IStorage {
  private places: Map<string, Place>;
  private itineraries: Map<number, Itinerary>;
  private currentPlaceId: number;
  private currentItineraryId: number;

  constructor() {
    this.places = new Map();
    this.itineraries = new Map();
    this.currentPlaceId = 1;
    this.currentItineraryId = 1;
  }

  async getPlace(placeId: string): Promise<Place | undefined> {
    return this.places.get(placeId);
  }

  async createPlace(insertPlace: InsertPlace): Promise<Place> {
    const id = this.currentPlaceId++;
    const place: Place = { ...insertPlace, id };
    this.places.set(insertPlace.placeId, place);
    return place;
  }

  async createItinerary(insertItinerary: InsertItinerary): Promise<Itinerary> {
    const id = this.currentItineraryId++;
    const itinerary: Itinerary = {
      ...insertItinerary,
      id,
      created: new Date(),
    };
    this.itineraries.set(id, itinerary);
    return itinerary;
  }

  async getItinerary(id: number): Promise<Itinerary | undefined> {
    return this.itineraries.get(id);
  }
}

export const storage = new MemStorage();
