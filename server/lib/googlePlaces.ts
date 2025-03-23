import type { PlaceDetails } from "@shared/schema";
import { normalizeLocationName, verifyPlaceMatch, suggestSimilarLocations } from "./locationNormalizer";
import { londonAreas, findAreasByCharacteristics } from "../data/london-areas";

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const PLACES_API_BASE = "https://maps.googleapis.com/maps/api/place";

interface SearchOptions {
  type?: string;
  openNow?: boolean;
  minRating?: number;
}

export async function searchPlace(
  query: string, 
  options: SearchOptions = {}
): Promise<PlaceDetails | null> {
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

      // Filter by rating if specified
      let bestResult = nearbyData.results[0];
      if (options.minRating) {
        const qualifiedResults = nearbyData.results.filter(
          (r: any) => r.rating >= options.minRating
        );
        if (qualifiedResults.length > 0) {
          bestResult = qualifiedResults[0];
        }
      }

      // Get additional details about the selected venue
      const detailsUrl = `${PLACES_API_BASE}/details/json?place_id=${bestResult.place_id}&fields=name,formatted_address,geometry,opening_hours,business_status,rating,price_level,types&key=${GOOGLE_PLACES_API_KEY}`;
      const detailsRes = await fetch(detailsUrl);
      const detailsData = await detailsRes.json();

      if (detailsData.status !== "OK") {
        throw new Error(`Error fetching details for selected ${options.type}.`);
      }

      console.log(`Found ${options.type} near ${normalizedLocation}:`, {
        name: bestResult.name,
        address: bestResult.formatted_address,
        rating: bestResult.rating,
        distance: "Within 2km"
      });

      return {
        ...detailsData.result,
        place_id: bestResult.place_id,
        area_info: matchingArea
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

      const bestResult = searchData.results[0];

      // Verify the result matches what was requested
      if (!verifyPlaceMatch(query, bestResult.name, bestResult.types)) {
        console.warn(`Place match verification warning for "${query}". Got "${bestResult.name}" instead.`);
      }

      // Get additional place details
      const detailsUrl = `${PLACES_API_BASE}/details/json?place_id=${bestResult.place_id}&fields=name,formatted_address,geometry,opening_hours,business_status,rating,price_level,types&key=${GOOGLE_PLACES_API_KEY}`;
      const detailsRes = await fetch(detailsUrl);
      const detailsData = await detailsRes.json();

      if (detailsData.status !== "OK") {
        throw new Error(`Error fetching details for "${query}".`);
      }

      return {
        ...detailsData.result,
        place_id: bestResult.place_id,
        area_info: matchingArea
      };
    }
  } catch (error) {
    console.error(`Error searching place "${query}":`, error);
    throw error;
  }
}