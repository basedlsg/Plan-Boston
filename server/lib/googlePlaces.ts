import type { PlaceDetails } from "@shared/schema";
import { normalizeLocationName, verifyPlaceMatch, suggestSimilarLocations } from "./locationNormalizer";

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
    // Normalize the location name first
    const normalizedLocation = normalizeLocationName(query);
    console.log(`Normalized location: ${query} -> ${normalizedLocation}`);

    // Handle landmarks vs amenities differently
    const isAmenitySearch = !!options.type;

    let searchQuery = normalizedLocation;
    if (!normalizedLocation.toLowerCase().includes('london')) {
      searchQuery = isAmenitySearch 
        ? `${normalizedLocation}, London, UK`  // Full context for amenities
        : `${normalizedLocation}, London`;     // Simpler context for landmarks
    }

    // Build search URL with parameters
    const params = new URLSearchParams({
      query: searchQuery,
      region: 'uk',
      key: GOOGLE_PLACES_API_KEY || '',
      language: 'en'
    });

    // Use different parameters for landmarks vs amenities
    if (isAmenitySearch) {
      params.append('type', options.type);
      params.append('rankby', 'distance');
    } else {
      params.append('radius', '50000'); // 50km radius from London center
    }

    if (options.openNow) {
      params.append('opennow', 'true');
    }

    const searchUrl = `${PLACES_API_BASE}/textsearch/json?${params.toString()}`;

    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    // Log complete request details
    console.log('Places API Request:', {
      url: searchUrl,
      query: searchQuery,
      params: Object.fromEntries(params)
    });

    console.log('Places API Response:', {
      status: searchData.status,
      resultsCount: searchData.results?.length,
      firstResult: searchData.results?.[0] ? {
        name: searchData.results[0].name,
        types: searchData.results[0].types,
        rating: searchData.results[0].rating,
        placeId: searchData.results[0].place_id,
        formattedAddress: searchData.results[0].formatted_address,
        geometry: searchData.results[0].geometry
      } : null
    });

    if (searchData.status !== "OK") {
      const suggestions = suggestSimilarLocations(query);
      const suggestionText = suggestions.length > 0 
        ? `Did you mean: ${suggestions.join(', ')}?` 
        : '';

      console.error(`Google Places API Error for query "${query}":`, {
        status: searchData.status,
        error_message: searchData.error_message,
        suggestions
      });
      throw new Error(`Could not find "${query}". ${suggestionText}`);
    }

    if (!searchData.results?.length) {
      const suggestions = suggestSimilarLocations(query);
      throw new Error(
        `No results found for "${query}". ` +
        (suggestions.length > 0 ? `Did you mean: ${suggestions.join(', ')}?` : '')
      );
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

    // Verify the result matches what was requested
    if (!verifyPlaceMatch(query, bestResult.name, bestResult.types)) {
      console.warn(`Place match verification failed for "${query}". Got "${bestResult.name}" instead.`);
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
      console.warn(`Place not operational: "${query}"`, detailsData.result);
      return null;
    }

    return {
      ...detailsData.result,
      place_id: bestResult.place_id
    };
  } catch (error) {
    console.error(`Error searching place "${query}":`, error);
    throw error; // Re-throw to handle suggestions in the calling code
  }
}