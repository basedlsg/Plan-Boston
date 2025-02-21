import type { PlaceDetails } from "@shared/schema";

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const PLACES_API_BASE = "https://maps.googleapis.com/maps/api/place";

export async function searchPlace(query: string): Promise<PlaceDetails | null> {
  try {
    // Add London context if not present
    const searchQuery = query.toLowerCase().includes('london') 
      ? query 
      : `${query}, London, UK`; // Changed to include UK and use comma

    const searchUrl = `${PLACES_API_BASE}/textsearch/json?query=${encodeURIComponent(
      searchQuery
    )}&region=uk&key=${GOOGLE_PLACES_API_KEY}`;

    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    // Detailed error logging
    if (searchData.status !== "OK") {
      console.error(`Google Places API Error for query "${query}":`, {
        status: searchData.status,
        error_message: searchData.error_message,
        results: searchData.results
      });
      return null;
    }

    // Better error handling
    if (!searchData.results?.length) {
      console.error(`No results found for "${query}". Full response:`, searchData);
      return null;
    }

    // Get more details including opening hours
    const placeId = searchData.results[0].place_id;
    const detailsUrl = `${PLACES_API_BASE}/details/json?place_id=${placeId}&fields=name,formatted_address,geometry,opening_hours,business_status&key=${GOOGLE_PLACES_API_KEY}`;

    const detailsRes = await fetch(detailsUrl);
    const detailsData = await detailsRes.json();

    if (detailsData.status !== "OK") {
      console.error(`Error fetching place details for "${query}":`, {
        status: detailsData.status,
        error_message: detailsData.error_message
      });
      return null;
    }

    // Some areas might not have a business_status, so we'll skip that check for them
    if (detailsData.result.business_status && detailsData.result.business_status !== "OPERATIONAL") {
      console.error(`Place not operational: "${query}"`, detailsData.result);
      return null;
    }

    return detailsData.result;
  } catch (error) {
    console.error(`Error searching place "${query}":`, error);
    return null;
  }
}