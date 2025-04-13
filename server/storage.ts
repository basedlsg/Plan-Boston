import { 
  type Place, 
  type InsertPlace, 
  type Itinerary, 
  type InsertItinerary, 
  type User, 
  type UserItinerary, 
  type InsertLocalUser,
  type InsertGoogleUser
} from "@shared/schema";
import { db } from './db';
import { users, itineraries, places, userItineraries } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface IStorage {
  // Place operations
  getPlace(placeId: string): Promise<Place | undefined>;
  createPlace(place: InsertPlace): Promise<Place>;
  
  // Itinerary operations
  createItinerary(itinerary: InsertItinerary, userId?: string): Promise<Itinerary>;
  getItinerary(id: number): Promise<Itinerary | undefined>;
  getUserItineraries(userId: string): Promise<Itinerary[]>;
  
  // User operations
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  createLocalUser(userData: InsertLocalUser, passwordHash: string): Promise<User>;
  createGoogleUser(userData: InsertGoogleUser): Promise<User>;
}

// Database-backed storage implementation
export class DbStorage implements IStorage {
  async getPlace(placeId: string): Promise<Place | undefined> {
    const results = await db.select()
      .from(places)
      .where(eq(places.placeId, placeId))
      .limit(1);
    
    return results.length > 0 ? results[0] : undefined;
  }

  async createPlace(insertPlace: InsertPlace): Promise<Place> {
    const [place] = await db.insert(places)
      .values(insertPlace)
      .returning();
    
    return place;
  }

  async createItinerary(insertItinerary: InsertItinerary, userId?: string): Promise<Itinerary> {
    // Begin transaction for creating itinerary and user association
    return await db.transaction(async (tx) => {
      // Create the itinerary
      const [itinerary] = await tx.insert(itineraries)
        .values(insertItinerary)
        .returning();
      
      // If userId provided, associate with user
      if (userId) {
        await tx.insert(userItineraries)
          .values({
            userId,
            itineraryId: itinerary.id
          });
      }
      
      return itinerary;
    });
  }

  async getItinerary(id: number): Promise<Itinerary | undefined> {
    const results = await db.select()
      .from(itineraries)
      .where(eq(itineraries.id, id))
      .limit(1);
    
    return results.length > 0 ? results[0] : undefined;
  }
  
  async getUserItineraries(userId: string): Promise<Itinerary[]> {
    // Join userItineraries and itineraries to get all user's itineraries
    return await db.select({
      id: itineraries.id,
      query: itineraries.query,
      places: itineraries.places,
      travelTimes: itineraries.travelTimes,
      created: itineraries.created
    })
      .from(userItineraries)
      .innerJoin(itineraries, eq(userItineraries.itineraryId, itineraries.id))
      .where(eq(userItineraries.userId, userId))
      .orderBy(itineraries.created);
  }

  async getUserById(id: string): Promise<User | undefined> {
    const results = await db.select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    
    return results.length > 0 ? results[0] : undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const results = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    
    return results.length > 0 ? results[0] : undefined;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const results = await db.select()
      .from(users)
      .where(eq(users.google_id, googleId))
      .limit(1);
    
    return results.length > 0 ? results[0] : undefined;
  }

  async createLocalUser(userData: InsertLocalUser, passwordHash: string): Promise<User> {
    const [user] = await db.insert(users)
      .values({
        ...userData,
        password_hash: passwordHash,
        auth_provider: 'local'
      })
      .returning();
    
    return user;
  }

  async createGoogleUser(userData: InsertGoogleUser): Promise<User> {
    const [user] = await db.insert(users)
      .values({
        ...userData,
        auth_provider: 'google'
      })
      .returning();
    
    return user;
  }
}

// Memory-based storage implementation for compatibility
export class MemStorage implements IStorage {
  private places: Map<string, Place>;
  private itineraries: Map<number, Itinerary>;
  private users: Map<string, User>;
  private userItineraryMap: Map<string, number[]>;
  private currentPlaceId: number;
  private currentItineraryId: number;

  constructor() {
    this.places = new Map();
    this.itineraries = new Map();
    this.users = new Map();
    this.userItineraryMap = new Map();
    this.currentPlaceId = 1;
    this.currentItineraryId = 1;
  }

  async getPlace(placeId: string): Promise<Place | undefined> {
    return this.places.get(placeId);
  }

  async createPlace(insertPlace: InsertPlace): Promise<Place> {
    const id = this.currentPlaceId++;
    const place: Place = {
      ...insertPlace,
      id,
      scheduledTime: insertPlace.scheduledTime || null,
      alternatives: insertPlace.alternatives || null
    };
    this.places.set(insertPlace.placeId, place);
    return place;
  }

  async createItinerary(insertItinerary: InsertItinerary, userId?: string): Promise<Itinerary> {
    const id = this.currentItineraryId++;
    const itinerary: Itinerary = {
      ...insertItinerary,
      id,
      created: new Date(),
    };
    this.itineraries.set(id, itinerary);
    
    // If userId provided, associate with user
    if (userId) {
      const userItineraries = this.userItineraryMap.get(userId) || [];
      userItineraries.push(id);
      this.userItineraryMap.set(userId, userItineraries);
    }
    
    return itinerary;
  }

  async getItinerary(id: number): Promise<Itinerary | undefined> {
    return this.itineraries.get(id);
  }
  
  async getUserItineraries(userId: string): Promise<Itinerary[]> {
    const itineraryIds = this.userItineraryMap.get(userId) || [];
    return itineraryIds
      .map(id => this.itineraries.get(id))
      .filter((itinerary): itinerary is Itinerary => itinerary !== undefined)
      .sort((a, b) => b.created.getTime() - a.created.getTime());
  }
  
  async getUserById(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    // Find user by email (inefficient in a real app, but fine for memory storage)
    // Manual iteration to avoid Map.values() iterator issues
    let foundUser: User | undefined = undefined;
    this.users.forEach((user, _) => {
      if (user.email === email) {
        foundUser = user;
      }
    });
    return foundUser;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    // Find user by Google ID
    let foundUser: User | undefined = undefined;
    this.users.forEach((user, _) => {
      if (user.google_id === googleId) {
        foundUser = user;
      }
    });
    return foundUser;
  }

  async createLocalUser(userData: InsertLocalUser, passwordHash: string): Promise<User> {
    const id = crypto.randomUUID();
    const user: User = {
      id,
      email: userData.email,
      name: userData.name,
      password_hash: passwordHash,
      created_at: new Date(),
      auth_provider: 'local',
      google_id: null,
      avatar_url: null
    };
    this.users.set(id, user);
    return user;
  }

  async createGoogleUser(userData: InsertGoogleUser): Promise<User> {
    const id = crypto.randomUUID();
    const user: User = {
      id,
      email: userData.email,
      name: userData.name,
      password_hash: null,
      created_at: new Date(),
      auth_provider: 'google',
      google_id: userData.google_id,
      avatar_url: userData.avatar_url || null
    };
    this.users.set(id, user);
    return user;
  }
}

export const storage = new MemStorage();