import type { PlaceDetails } from "@shared/schema";

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const PLACES_API_BASE = "https://maps.googleapis.com/maps/api/place";

export async function searchPlace(query: string): Promise<PlaceDetails | null> {
  try {
    // First search for the place
    const searchUrl = `${PLACES_API_BASE}/textsearch/json?query=${encodeURIComponent(
      query + " London"
    )}&key=${GOOGLE_PLACES_API_KEY}`;

    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    if (!searchData.results?.[0]) {
      return null;
    }

    const placeId = searchData.results[0].place_id;

    // Then get detailed information
    const detailsUrl = `${PLACES_API_BASE}/details/json?place_id=${placeId}&fields=name,formatted_address,geometry,opening_hours&key=${GOOGLE_PLACES_API_KEY}`;

    const detailsRes = await fetch(detailsUrl);
    const detailsData = await detailsRes.json();

    if (detailsData.status !== "OK") {
      return null;
    }

    return detailsData.result as PlaceDetails;
  } catch (error) {
    console.error("Error searching place:", error);
    return null;
  }
}
