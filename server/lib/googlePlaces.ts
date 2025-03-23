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
    // Handle landmarks vs amenities differently
    const isAmenitySearch = !!options.type;
    
    let searchQuery = query;
    if (!query.toLowerCase().includes('london')) {
      searchQuery = isAmenitySearch 
        ? `${query}, London, UK`  // Full context for amenities
        : `${query}, London`;     // Simpler context for landmarks
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
        rating: searchData.results[0].rating
      } : null
    });

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