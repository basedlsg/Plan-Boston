import type { PlaceDetails } from "@shared/schema";

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const PLACES_API_BASE = "https://maps.googleapis.com/maps/api/place";

export async function searchPlace(query: string): Promise<PlaceDetails | null> {
  try {
    // Add London context if not present
    const searchQuery = query.toLowerCase().includes('london') 
      ? query 
      : `${query} London`;

    const searchUrl = `${PLACES_API_BASE}/textsearch/json?query=${encodeURIComponent(
      searchQuery
    )}&key=${GOOGLE_PLACES_API_KEY}`;

    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    // Better error handling
    if (!searchData.results?.length) {
      console.log(`No results found for: ${query}`);
      return null;
    }

    // Get more details including opening hours
    const placeId = searchData.results[0].place_id;
    const detailsUrl = `${PLACES_API_BASE}/details/json?place_id=${placeId}&fields=name,formatted_address,geometry,opening_hours,business_status&key=${GOOGLE_PLACES_API_KEY}`;

    const detailsRes = await fetch(detailsUrl);
    const detailsData = await detailsRes.json();

    if (detailsData.status !== "OK" || detailsData.result.business_status !== "OPERATIONAL") {
      console.log(`Place not operational: ${query}`);
      return null;
    }

    return detailsData.result;
  } catch (error) {
    console.error("Error searching place:", error);
    return null;
  }
}