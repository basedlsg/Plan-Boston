import type { PlaceDetails, VenueSearchResult } from "@shared/schema";
import { normalizeLocationName, verifyPlaceMatch, suggestSimilarLocations } from "./locationNormalizer";
import { londonAreas, findAreasByCharacteristics } from "../data/london-areas";

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const PLACES_API_BASE = "https://maps.googleapis.com/maps/api/place";
const MAX_ALTERNATIVES = 3; // Maximum number of alternative venues to return

interface SearchOptions {
  type?: string;
  openNow?: boolean;
  minRating?: number;
}

// Helper function to calculate distance between two points using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const distance = R * c; // Distance in km
  return Math.round(distance * 1000) / 1000; // Round to 3 decimal places
}

// Helper function to fetch place details
async function fetchPlaceDetails(placeId: string): Promise<any> {
  const detailsUrl = `${PLACES_API_BASE}/details/json?place_id=${placeId}&fields=name,formatted_address,geometry,opening_hours,business_status,rating,price_level,types&key=${GOOGLE_PLACES_API_KEY}`;
  const detailsRes = await fetch(detailsUrl);
  const detailsData = await detailsRes.json();
  
  if (detailsData.status !== "OK") {
    throw new Error(`Error fetching details for place ${placeId}.`);
  }
  
  return detailsData.result;
}

export async function searchPlace(
  query: string, 
  options: SearchOptions = {}
): Promise<VenueSearchResult> {
  try {
    // First check if this matches any of our known areas
    const matchingArea = londonAreas.find(area => 
      area.name.toLowerCase() === query.toLowerCase() ||
      area.neighbors.some(n => n.toLowerCase() === query.toLowerCase())
    );

    // Normalize the location name
    const normalizedLocation = normalizeLocationName(query);
    console.log(`Normalized location: ${query} -> ${normalizedLocation}`);

    // Build search query with appropriate context
    let searchQuery = normalizedLocation;
    if (!normalizedLocation.toLowerCase().includes('london')) {
      // Add more specific context for stations and streets
      if (normalizedLocation.toLowerCase().includes('station')) {
        searchQuery = `${normalizedLocation}, Underground Station, London`;
      } else if (matchingArea) {
        searchQuery = `${normalizedLocation}, ${matchingArea.borough || 'London'}, UK`;
      } else {
        searchQuery = `${normalizedLocation}, London`;
      }
    }

    // When searching for an activity type near a landmark, use a two-step approach
    if (options.type && options.type !== "landmark") {
      console.log(`Searching for ${options.type} near ${searchQuery}`);

      // First find the landmark
      const landmarkParams = new URLSearchParams({
        query: searchQuery,
        region: "uk",
        key: GOOGLE_PLACES_API_KEY || "",
        language: "en",
        radius: "5000"
      });

      const landmarkUrl = `${PLACES_API_BASE}/textsearch/json?${landmarkParams.toString()}`;
      const landmarkRes = await fetch(landmarkUrl);
      const landmarkData = await landmarkRes.json();

      if (landmarkData.status !== "OK" || !landmarkData.results?.length) {
        const suggestions = suggestSimilarLocations(query);
        throw new Error(
          `Could not find "${query}"${suggestions.length ? `. Did you mean: ${suggestions.join(", ")}?` : ""}. ` +
          "Try being more specific or using the full name."
        );
      }

      // Get the landmark's location
      const landmark = landmarkData.results[0];
      const { lat, lng } = landmark.geometry.location;

      // Now search for the activity type near this landmark
      const nearbyParams = new URLSearchParams({
        location: `${lat},${lng}`,
        radius: "2000", // 2km radius
        type: options.type,
        key: GOOGLE_PLACES_API_KEY || "",
        language: "en"
      });

      if (options.openNow) {
        nearbyParams.append("opennow", "true");
      }
      if (options.minRating) {
        nearbyParams.append("minRating", options.minRating.toString());
      }

      const nearbyUrl = `${PLACES_API_BASE}/nearbysearch/json?${nearbyParams.toString()}`;
      const nearbyRes = await fetch(nearbyUrl);
      const nearbyData = await nearbyRes.json();

      if (nearbyData.status !== "OK" || !nearbyData.results?.length) {
        throw new Error(`No ${options.type} found near ${normalizedLocation}. Try a different location or activity type.`);
      }

      // Filter results by rating if specified
      let results = [...nearbyData.results];
      if (options.minRating !== undefined) {
        const minRating = options.minRating; // Store in a constant to avoid the "possibly undefined" error
        const qualifiedResults = results.filter(
          (r: any) => r.rating >= minRating
        );
        if (qualifiedResults.length > 0) {
          results = qualifiedResults;
        }
      }
      
      // Limit to maximum results (1 primary + MAX_ALTERNATIVES)
      results = results.slice(0, 1 + MAX_ALTERNATIVES);
      
      if (results.length === 0) {
        throw new Error(`No ${options.type} found near ${normalizedLocation}. Try a different location or activity type.`);
      }
      
      // Get primary result
      const primaryResult = results[0];
      const primaryLat = primaryResult.geometry.location.lat;
      const primaryLng = primaryResult.geometry.location.lng;
      
      // Get details for all venues
      const primaryDetails = await fetchPlaceDetails(primaryResult.place_id);
      
      // Mark as primary and add area info
      const primary: PlaceDetails = {
        ...primaryDetails,
        place_id: primaryResult.place_id,
        is_primary: true,
        distance_from_primary: 0,
        area_info: matchingArea
      };
      
      // Get alternative venues
      const alternativePromises = results.slice(1).map(async (result) => {
        const details = await fetchPlaceDetails(result.place_id);
        
        // Calculate distance from primary result
        const distance = calculateDistance(
          primaryLat, 
          primaryLng,
          result.geometry.location.lat, 
          result.geometry.location.lng
        );
        
        return {
          ...details,
          place_id: result.place_id,
          is_primary: false,
          distance_from_primary: distance,
          area_info: matchingArea
        };
      });
      
      const alternatives = await Promise.all(alternativePromises);
      
      console.log(`Found ${results.length} ${options.type} venues near ${normalizedLocation}:`, {
        primary: primary.name,
        alternatives: alternatives.map(a => a.name)
      });
      
      return {
        primary,
        alternatives
      };

    } else {
      // Regular landmark search
      const params = new URLSearchParams({
        query: searchQuery,
        region: "uk",
        key: GOOGLE_PLACES_API_KEY || "",
        language: "en",
        radius: "50000" // 50km radius from London center
      });

      const searchUrl = `${PLACES_API_BASE}/textsearch/json?${params.toString()}`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();

      if (searchData.status !== "OK" || !searchData.results?.length) {
        const suggestions = suggestSimilarLocations(query);
        throw new Error(
          `Could not find "${query}"${suggestions.length ? `. Did you mean: ${suggestions.join(", ")}?` : ""}. ` +
          "Try being more specific or using the full name."
        );
      }

      // Get up to MAX_ALTERNATIVES + 1 results, but handle cases where there are few or no similar alternatives
      const results = searchData.results.slice(0, 1 + MAX_ALTERNATIVES);
      // There should always be at least one result if we reach here
      const primaryResult = results[0];
      
      // Verify the primary result matches what was requested
      if (!verifyPlaceMatch(query, primaryResult.name, primaryResult.types)) {
        console.warn(`Place match verification warning for "${query}". Got "${primaryResult.name}" instead.`);
      }
      
      // Get primary landmark details
      const primaryDetails = await fetchPlaceDetails(primaryResult.place_id);
      const primaryLat = primaryResult.geometry.location.lat;
      const primaryLng = primaryResult.geometry.location.lng;
      
      // Create primary result object
      const primary: PlaceDetails = {
        ...primaryDetails,
        place_id: primaryResult.place_id,
        is_primary: true,
        distance_from_primary: 0,
        area_info: matchingArea
      };
      
      // Get alternative landmarks
      const alternativePromises = results.slice(1).map(async (result: any) => {
        const details = await fetchPlaceDetails(result.place_id);
        
        // Calculate distance from primary result
        const distance = calculateDistance(
          primaryLat, 
          primaryLng,
          result.geometry.location.lat, 
          result.geometry.location.lng
        );
        
        return {
          ...details,
          place_id: result.place_id,
          is_primary: false,
          distance_from_primary: distance,
          area_info: matchingArea
        };
      });
      
      const alternatives = await Promise.all(alternativePromises);
      
      console.log(`Found landmark "${primary.name}" with ${alternatives.length} alternatives`);
      
      return {
        primary,
        alternatives
      };
    }
  } catch (error) {
    console.error(`Error searching place "${query}":`, error);
    throw error;
  }
}