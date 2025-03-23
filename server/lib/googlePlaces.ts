import type { PlaceDetails } from "@shared/schema";

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
    // Add London context and venue type if not present
    let searchQuery = query.toLowerCase().includes('london') 
      ? query 
      : `${query}, London, UK`;

    // Add type specific context
    if (options.type) {
      searchQuery = `${options.type} in ${searchQuery}`; //Improved phrasing
    }

    // Build search URL with parameters
    const params = new URLSearchParams({
      query: searchQuery,
      region: 'uk',
      key: GOOGLE_PLACES_API_KEY || '',
      type: options.type || '', // Explicitly include type parameter
      rankby: 'distance' //Added to prioritize nearby results
    });

    if (options.openNow) {
      params.append('opennow', 'true');
    }

    const searchUrl = `${PLACES_API_BASE}/textsearch/json?${params.toString()}`;

    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    if (searchData.status !== "OK") {
      console.error(`Google Places API Error for query "${query}":`, {
        status: searchData.status,
        error_message: searchData.error_message,
        results: searchData.results
      });
      return null;
    }

    if (!searchData.results?.length) {
      console.warn(`No results found for "${query}". Full response:`, searchData); // Changed to warn
      return null;
    }

    // Filter results by rating if specified
    let bestResult = searchData.results[0];
    if (options.minRating) {
      const qualifiedResults = searchData.results.filter(
        (r: any) => r.rating >= options.minRating
      );
      if (qualifiedResults.length > 0) {
        bestResult = qualifiedResults[0];
      }
    }

    // Get more details including opening hours
    const detailsUrl = `${PLACES_API_BASE}/details/json?place_id=${bestResult.place_id}&fields=name,formatted_address,geometry,opening_hours,business_status,rating,price_level,types&key=${GOOGLE_PLACES_API_KEY}`;

    const detailsRes = await fetch(detailsUrl);
    const detailsData = await detailsRes.json();

    if (detailsData.status !== "OK") {
      console.error(`Error fetching place details for "${query}":`, {
        status: detailsData.status,
        error_message: detailsData.error_message
      });
      return null;
    }

    // Some venues might not have a business_status
    if (detailsData.result.business_status && 
        detailsData.result.business_status !== "OPERATIONAL") {
      console.warn(`Place not operational: "${query}"`, detailsData.result); // Changed to warn
      return null;
    }

    return {
      ...detailsData.result,
      place_id: bestResult.place_id
    };
  } catch (error) {
    console.error(`Error searching place "${query}":`, error);
    return null;
  }
}