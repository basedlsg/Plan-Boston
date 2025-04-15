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
import { eq, desc, or } from 'drizzle-orm';

// Configure in-memory fallback for development
const USE_IN_MEMORY_FALLBACK = process.env.NODE_ENV === 'development';
const inMemoryStorage = {
  places: new Map<string, Place>(),
  itineraries: new Map<number, Itinerary>(),
  users: new Map<string, User>(),
  userItineraries: new Map<string, number[]>(),
  nextPlaceId: 1,
  nextItineraryId: 1
};

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
    // Get all itinerary IDs associated with the user
    const userItineraryAssociations = await db.select({
      itineraryId: userItineraries.itineraryId
    })
    .from(userItineraries)
    .where(eq(userItineraries.userId, userId));
    
    // Extract the itinerary IDs
    const itineraryIds = userItineraryAssociations.map(assoc => assoc.itineraryId);
    
    if (itineraryIds.length === 0) {
      return [];
    }
    
    // Get all itineraries for those IDs in a separate query
    return await db.select({
      id: itineraries.id,
      query: itineraries.query,
      places: itineraries.places,
      travelTimes: itineraries.travelTimes,
      created: itineraries.created
    })
      .from(itineraries)
      .where(
        // Create a where condition for each ID: id = 1 OR id = 2 OR ...
        or(...itineraryIds.map(id => eq(itineraries.id, id)))
      )
      .orderBy(desc(itineraries.created)); // Sort newest first
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
      console.log(`MemStorage: Associating itinerary #${id} with user ${userId}`);
      const userItineraries = this.userItineraryMap.get(userId) || [];
      userItineraries.push(id);
      this.userItineraryMap.set(userId, userItineraries);
      console.log(`MemStorage: User ${userId} now has ${userItineraries.length} itineraries`);
    } else {
      console.log(`MemStorage: Created anonymous itinerary #${id} (no user association)`);
    }
    
    return itinerary;
  }

  async getItinerary(id: number): Promise<Itinerary | undefined> {
    return this.itineraries.get(id);
  }
  
  async getUserItineraries(userId: string): Promise<Itinerary[]> {
    console.log(`MemStorage: Getting itineraries for user ${userId}`);
    const itineraryIds = this.userItineraryMap.get(userId) || [];
    console.log(`MemStorage: Found ${itineraryIds.length} itinerary IDs for user ${userId}: ${JSON.stringify(itineraryIds)}`);
    
    // Debug all itineraries in memory
    console.log(`MemStorage: Total itineraries in memory: ${this.itineraries.size}`);
    
    // Get and filter the itineraries
    const userItineraries = itineraryIds
      .map(id => this.itineraries.get(id))
      .filter((itinerary): itinerary is Itinerary => itinerary !== undefined)
      .sort((a, b) => b.created.getTime() - a.created.getTime());
    
    console.log(`MemStorage: Returning ${userItineraries.length} itineraries for user ${userId}`);
    return userItineraries;
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
    // Use definite type casting to handle potential undefined values
    const name: string | null = userData.name !== undefined ? userData.name : null;
    
    const user: User = {
      id,
      email: userData.email,
      name,
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
    // Use definite type casting to handle potential undefined values
    const name: string | null = userData.name !== undefined ? userData.name : null;
    const googleId: string | null = userData.google_id !== undefined ? userData.google_id : null;
    const avatarUrl: string | null = userData.avatar_url !== undefined ? userData.avatar_url : null;
    
    const user: User = {
      id,
      email: userData.email,
      name,
      password_hash: null,
      created_at: new Date(),
      auth_provider: 'google',
      google_id: googleId,
      avatar_url: avatarUrl
    };
    this.users.set(id, user);
    return user;
  }
}

// Add debug logging to the DbStorage implementation
// With fallback to in-memory storage when database operations fail in development
export class DbStorageWithLogging extends DbStorage {
  async createPlace(insertPlace: InsertPlace): Promise<Place> {
    try {
      const result = await super.createPlace(insertPlace);
      return result;
    } catch (error) {
      if (USE_IN_MEMORY_FALLBACK) {
        console.warn("Database error in createPlace, using in-memory fallback:", error.message);
        
        // Use in-memory storage as fallback
        const id = inMemoryStorage.nextPlaceId++;
        const place: Place = {
          ...insertPlace,
          id,
          scheduledTime: insertPlace.scheduledTime || null,
          alternatives: insertPlace.alternatives || null
        };
        inMemoryStorage.places.set(insertPlace.placeId, place);
        return place;
      }
      throw error;
    }
  }
  
  async getPlace(placeId: string): Promise<Place | undefined> {
    try {
      return await super.getPlace(placeId);
    } catch (error) {
      if (USE_IN_MEMORY_FALLBACK) {
        console.warn("Database error in getPlace, using in-memory fallback:", error.message);
        return inMemoryStorage.places.get(placeId);
      }
      throw error;
    }
  }

  async createItinerary(insertItinerary: InsertItinerary, userId?: string): Promise<Itinerary> {
    console.log(`DbStorage (with logging): Creating itinerary ${userId ? 'for user ' + userId : '(anonymous)'}`);
    try {
      const result = await super.createItinerary(insertItinerary, userId);
      console.log(`DbStorage (with logging): Created itinerary #${result.id} successfully`);
      return result;
    } catch (error) {
      console.error(`DbStorage (with logging): Error creating itinerary:`, error);
      
      if (USE_IN_MEMORY_FALLBACK) {
        console.warn("Using in-memory fallback for createItinerary due to database error");
        
        // Use in-memory storage as fallback
        const id = inMemoryStorage.nextItineraryId++;
        const itinerary: Itinerary = {
          ...insertItinerary,
          id,
          created: new Date()
        };
        inMemoryStorage.itineraries.set(id, itinerary);
        
        // If userId provided, associate with user
        if (userId) {
          const userItineraries = inMemoryStorage.userItineraries.get(userId) || [];
          userItineraries.push(id);
          inMemoryStorage.userItineraries.set(userId, userItineraries);
        }
        
        return itinerary;
      }
      
      throw error;
    }
  }

  async getItinerary(id: number): Promise<Itinerary | undefined> {
    try {
      return await super.getItinerary(id);
    } catch (error) {
      if (USE_IN_MEMORY_FALLBACK) {
        console.warn("Database error in getItinerary, using in-memory fallback:", error.message);
        return inMemoryStorage.itineraries.get(id);
      }
      throw error;
    }
  }

  async getUserItineraries(userId: string): Promise<Itinerary[]> {
    console.log(`DbStorage (with logging): Getting itineraries for user ${userId}`);
    try {
      const result = await super.getUserItineraries(userId);
      console.log(`DbStorage (with logging): Found ${result.length} itineraries for user ${userId}`);
      return result;
    } catch (error) {
      console.error(`DbStorage (with logging): Error getting user itineraries:`, error);
      
      if (USE_IN_MEMORY_FALLBACK) {
        console.warn("Using in-memory fallback for getUserItineraries due to database error");
        
        const itineraryIds = inMemoryStorage.userItineraries.get(userId) || [];
        
        // Get and filter the itineraries
        const userItineraries = itineraryIds
          .map(id => inMemoryStorage.itineraries.get(id))
          .filter((itinerary): itinerary is Itinerary => itinerary !== undefined)
          .sort((a, b) => b.created.getTime() - a.created.getTime());
        
        return userItineraries;
      }
      
      throw error;
    }
  }
}

// Use the database storage implementation
export const storage = new DbStorageWithLogging();