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

    // Handle landmarks vs amenities differently
    const isAmenitySearch = !!options.type;

    // Build search query with appropriate context
    let searchQuery = normalizedLocation;
    if (!normalizedLocation.toLowerCase().includes('london')) {
      // Add more specific context for stations and streets
      if (normalizedLocation.toLowerCase().includes('station')) {
        searchQuery = `${normalizedLocation}, Underground Station, London`;
      } else if (matchingArea) {
        searchQuery = `${normalizedLocation}, ${matchingArea.borough || 'London'}, UK`;
      } else {
        searchQuery = isAmenitySearch 
          ? `${normalizedLocation}, London, UK`  
          : `${normalizedLocation}, London`;
      }
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
      if (options.type) {
        params.append('type', options.type);
      }
      params.append('rankby', 'distance');
    } else {
      params.append('radius', '50000'); // 50km radius from London center
    }

    if (options.openNow) {
      params.append('opennow', 'true');
    }

    const searchUrl = `${PLACES_API_BASE}/textsearch/json?${params.toString()}`;

    console.log('Places API Request:', {
      url: searchUrl,
      query: searchQuery,
      params: Object.fromEntries(params)
    });

    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    if (searchData.status !== "OK" || !searchData.results?.length) {
      const suggestions = suggestSimilarLocations(query);
      const suggestionText = suggestions.length > 0 
        ? `Did you mean: ${suggestions.join(', ')}?` 
        : '';

      // Log the error with detailed context
      console.error(`Google Places API Error for "${query}":`, {
        status: searchData.status,
        error_message: searchData.error_message,
        originalQuery: query,
        normalizedQuery: normalizedLocation,
        searchQuery,
        matchingArea: matchingArea?.name,
        suggestions
      });

      throw new Error(
        `Could not find "${query}"${suggestionText ? `. ${suggestionText}` : ''}. ` +
        `Try being more specific${matchingArea ? ' or using the full name' : ''}.`
      );
    }

    // Filter and enhance results
    let bestResult = searchData.results[0];

    // Apply rating filter if specified
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
      console.warn(`Place match verification warning for "${query}". Got "${bestResult.name}" instead.`);
    }

    // Get additional place details
    const detailsUrl = `${PLACES_API_BASE}/details/json?place_id=${bestResult.place_id}&fields=name,formatted_address,geometry,opening_hours,business_status,rating,price_level,types&key=${GOOGLE_PLACES_API_KEY}`;

    const detailsRes = await fetch(detailsUrl);
    const detailsData = await detailsRes.json();

    if (detailsData.status !== "OK") {
      console.error(`Error fetching details for "${query}":`, {
        status: detailsData.status,
        error_message: detailsData.error_message
      });
      return null;
    }

    // Check if place is operational
    if (detailsData.result.business_status && 
        detailsData.result.business_status !== "OPERATIONAL") {
      console.warn(`Place not operational: "${query}"`, detailsData.result);
      return null;
    }

    // Combine Google Places data with our custom area data if available
    const placeDetails = {
      ...detailsData.result,
      place_id: bestResult.place_id,
      area_info: matchingArea || undefined
    };

    console.log(`Successfully found location "${query}":`, {
      name: placeDetails.name,
      address: placeDetails.formatted_address,
      types: placeDetails.types,
      area: matchingArea?.name
    });

    return placeDetails;
  } catch (error) {
    console.error(`Error searching place "${query}":`, error);
    throw error;
  }
}