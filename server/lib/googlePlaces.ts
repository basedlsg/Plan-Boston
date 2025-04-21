import type { PlaceDetails, VenueSearchResult, SearchParameters } from "@shared/schema";
import { normalizeLocationName, verifyPlaceMatch, suggestSimilarLocations } from "./locationNormalizer";
import { nycAreas, findAreasByCharacteristics } from "../data/new-york-areas";

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const PLACES_API_BASE = "https://maps.googleapis.com/maps/api/place";
const MAX_ALTERNATIVES = 3; // Maximum number of alternative venues to return

interface SearchOptions {
  type?: string;
  openNow?: boolean;
  minRating?: number;
  searchTerm?: string;
  keywords?: string[];
  requireOpenNow?: boolean;
  checkReviewsForKeywords?: boolean; // Whether to perform the more intensive review check
  searchPreference?: string; // Specific venue preference (e.g., "hipster coffee shop", "authentic Jewish deli")
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
async function fetchPlaceDetails(placeId: string, includeReviews: boolean = false): Promise<any> {
  // Add reviews field if requested
  const fields = includeReviews 
    ? "name,formatted_address,geometry,opening_hours,business_status,rating,price_level,types,reviews" 
    : "name,formatted_address,geometry,opening_hours,business_status,rating,price_level,types";
  
  const detailsUrl = `${PLACES_API_BASE}/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_PLACES_API_KEY}`;
  const detailsRes = await fetch(detailsUrl);
  const detailsData = await detailsRes.json();
  
  if (detailsData.status !== "OK") {
    throw new Error(`Error fetching details for place ${placeId}.`);
  }
  
  return detailsData.result;
}

/**
 * Check if any of the place's reviews mention specific keywords
 * Useful for food-specific searches like "focaccia sandwich"
 * 
 * @param placeId Google Places ID
 * @param keywords List of keywords to look for in reviews
 * @returns Boolean indicating if any keywords were found in reviews
 */
async function checkPlaceReviewsForKeywords(placeId: string, keywords: string[]): Promise<boolean> {
  try {
    // Get detailed place information including reviews
    const details = await fetchPlaceDetails(placeId, true);
    
    if (!details?.reviews || !Array.isArray(details.reviews)) {
      return false;
    }
    
    // Check if any keywords appear in review text
    return details.reviews.some((review: any) => {
      if (!review.text) return false;
      const reviewText = review.text.toLowerCase();
      return keywords.some(keyword => reviewText.includes(keyword.toLowerCase()));
    });
  } catch (error) {
    console.error("Error checking reviews:", error);
    return false;
  }
}

export async function searchPlace(
  query: string, 
  options: SearchOptions = {}
): Promise<VenueSearchResult> {
  try {
    console.log(`Search request for query: "${query}" with options:`, options);
    
    // Add better search term extraction from complex activity types
    let searchType = options.type;
    let searchKeyword = '';
    let keywordsList: string[] = [];
    
    // Use search preference as the highest priority if available
    if (options.searchPreference) {
      console.log(`Using specific venue preference as primary search term: "${options.searchPreference}"`);
      searchKeyword = options.searchPreference;
    } 
    // Otherwise use regular searchTerm if available
    else if (options.searchTerm) {
      searchKeyword = options.searchTerm;
    } else {
      // Ensure we have at least a basic search term for all searches
      searchKeyword = query;
    }
    
    if (options.keywords && Array.isArray(options.keywords)) {
      keywordsList = options.keywords;
    }
    
    // If we have a searchPreference, add it to the keywords list as well for maximum effect
    if (options.searchPreference && (!keywordsList.includes(options.searchPreference))) {
      if (!keywordsList) keywordsList = [];
      keywordsList.push(options.searchPreference);
    }

    // Extract better search terms from complex activity types
    if (typeof options.type === 'string') {
      // Map complex activity types to better search terms
      if (options.type.includes('coffee shop') || options.type.includes('cafe')) {
        searchType = 'cafe';
        searchKeyword = 'coffee shop';
      } else if (options.type.includes('dinner') || options.type.includes('restaurant')) {
        searchType = 'restaurant';
        searchKeyword = options.type;
      } else if (options.type.includes('library')) {
        searchType = 'library';
      } else if (options.type.includes('bar') || options.type.includes('pub')) {
        searchType = 'bar';
      }
    }
    
    // First check if this matches any of our known areas
    const matchingArea = nycAreas.find(area => 
      area.name.toLowerCase() === query.toLowerCase() ||
      area.neighbors.some(n => n.toLowerCase() === query.toLowerCase())
    );

    // Normalize the location name
    const normalizedLocation = normalizeLocationName(query);
    console.log(`Normalized location: ${query} -> ${normalizedLocation}`);

    // Build search query with appropriate context
    let searchQuery = normalizedLocation;
    if (!normalizedLocation.toLowerCase().includes('new york')) {
      // Add more specific context for stations and streets
      if (normalizedLocation.toLowerCase().includes('station')) {
        searchQuery = `${normalizedLocation}, Subway Station, New York`;
      } else if (matchingArea) {
        searchQuery = `${normalizedLocation}, ${matchingArea.borough || 'New York'}, NY`;
      } else {
        searchQuery = `${normalizedLocation}, New York`;
      }
    }

    // When searching for an activity type near a landmark, use a two-step approach
    if (options.type && options.type !== "landmark") {
      console.log(`Searching for ${options.type} near ${searchQuery} (using searchType: ${searchType}, searchKeyword: ${searchKeyword})`);

      // First find the landmark
      const landmarkParams = new URLSearchParams({
        query: searchQuery,
        region: "us",
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
        key: GOOGLE_PLACES_API_KEY || "",
        language: "en"
      });

      // Add proper search parameters
      if (searchType && searchType !== "landmark") {
        nearbyParams.append("type", searchType);
      } else if (options.type && options.type !== "landmark") {
        // Fallback to original type if no improved searchType was extracted
        nearbyParams.append("type", options.type);
      }
      
      // Add keyword for better results
      if (searchKeyword) {
        nearbyParams.append("keyword", searchKeyword);
      }
      
      // Use the enhanced keywords list if available
      if (keywordsList.length > 0) {
        const combinedKeywords = keywordsList.join(' ');
        // If we already have a keyword, add the additional keywords with a space
        if (searchKeyword) {
          nearbyParams.set("keyword", `${searchKeyword} ${combinedKeywords}`);
        } else {
          nearbyParams.append("keyword", combinedKeywords);
        }
      }

      // Handle OpenNow parameter - prefer the enhanced requireOpenNow if available
      if (options.requireOpenNow || options.openNow) {
        nearbyParams.append("opennow", "true");
      }
      
      // Use the enhanced minRating parameter if available
      if (options.minRating) {
        nearbyParams.append("minRating", options.minRating.toString());
      }

      const nearbyUrl = `${PLACES_API_BASE}/nearbysearch/json?${nearbyParams.toString()}`;
      const nearbyRes = await fetch(nearbyUrl);
      const nearbyData = await nearbyRes.json();

      if (nearbyData.status !== "OK" || !nearbyData.results?.length) {
        console.log(`No results found for ${options.type} near ${normalizedLocation}. Trying a more generic search...`);
        
        // Try a more generic search without the type restriction
        const fallbackParams = new URLSearchParams({
          location: `${lat},${lng}`,
          radius: "2000", // 2km radius
          keyword: searchKeyword || query,
          key: GOOGLE_PLACES_API_KEY || "",
          language: "en"
        });
        
        const fallbackUrl = `${PLACES_API_BASE}/nearbysearch/json?${fallbackParams.toString()}`;
        const fallbackRes = await fetch(fallbackUrl);
        const fallbackData = await fallbackRes.json();
        
        if (fallbackData.status === "OK" && fallbackData.results?.length > 0) {
          console.log(`Fallback search successful, found ${fallbackData.results.length} results`);
          nearbyData.results = fallbackData.results;
        } else {
          // If we still couldn't find anything, throw an error
          throw new Error(`No ${options.type || 'venues'} found near ${normalizedLocation}. Try a different location or activity type.`);
        }
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
      
      // Check reviews for specific food items or keywords if requested
      if (options.checkReviewsForKeywords && keywordsList.length > 0) {
        try {
          console.log(`Checking reviews for specific keywords: ${keywordsList.join(', ')}`);
          
          // Look through the top 10 results for keyword matches in reviews
          const reviewPromises = results.slice(0, 10).map(async (result) => {
            const hasKeywords = await checkPlaceReviewsForKeywords(result.place_id, keywordsList);
            return { result, hasKeywords };
          });
          
          const reviewResults = await Promise.all(reviewPromises);
          const matchingResults = reviewResults.filter(item => item.hasKeywords).map(item => item.result);
          
          // If we found venues with matching reviews, prioritize these results
          if (matchingResults.length > 0) {
            console.log(`Found ${matchingResults.length} venues with reviews mentioning keywords`);
            
            // Preserve other results but put the matching ones first
            const nonMatchingResults = results.filter(result => 
              !matchingResults.some(match => match.place_id === result.place_id)
            );
            
            results = [...matchingResults, ...nonMatchingResults];
          }
        } catch (error) {
          console.error("Error during review checking:", error);
          // Continue with regular search if review checking fails
        }
      }
      
      // Enhanced type filtering to exclude inappropriate venues
      if (options.type) {
        if (options.type === 'cafe' || options.type === 'coffee') {
          // For cafes/coffee, exclude inappropriate places and prioritize dedicated cafes
          const filteredResults = results.filter(place => 
            // Exclude inappropriate venues
            !place.types.includes('gas_station') && 
            !place.types.includes('lodging') &&
            !place.types.includes('hospital') &&
            !place.types.includes('car_dealer') &&
            !place.types.includes('car_rental') &&
            // Prioritize venues that are actually cafes or restaurants
            (place.types.includes('cafe') || 
             place.types.includes('restaurant') || 
             place.types.includes('bakery') ||
             place.types.includes('food'))
          );
          
          // Only use filtered results if we didn't filter everything out
          if (filteredResults.length > 0) {
            results = filteredResults;
          }
        } else if (options.type === 'restaurant' || options.type === 'lunch' || options.type === 'dinner' || options.type === 'breakfast') {
          // For food activities, exclude inappropriate venues and prioritize restaurants
          const filteredResults = results.filter(place => 
            // Exclude inappropriate venues
            !place.types.includes('gas_station') && 
            !place.types.includes('lodging') &&
            !place.types.includes('hospital') &&
            !place.types.includes('car_dealer') &&
            !place.types.includes('car_rental') &&
            // At least one of these types should be present
            (place.types.includes('restaurant') || 
             place.types.includes('meal_takeaway') || 
             place.types.includes('meal_delivery') ||
             place.types.includes('food'))
          );
          
          if (filteredResults.length > 0) {
            results = filteredResults;
          }
          
          // Further sort by prioritizing dedicated restaurants
          results = results.sort((a, b) => {
            // Calculate relevance score based on venue types
            const scoreTypes = (types: string[]) => {
              let score = 0;
              if (types.includes('restaurant')) score += 5;
              if (types.includes('food')) score += 3;
              if (types.includes('meal_takeaway')) score += 2;
              if (types.includes('cafe')) score += 1;
              return score;
            };
            
            return scoreTypes(b.types) - scoreTypes(a.types);
          });
        } else if (options.type === 'bar' || options.type === 'drinks' || options.type === 'night_club' || options.type === 'nightlife') {
          // For nightlife venues, prioritize bars and clubs
          const filteredResults = results.filter(place => 
            !place.types.includes('gas_station') && 
            !place.types.includes('hospital') &&
            (place.types.includes('bar') || 
             place.types.includes('night_club') ||
             place.types.includes('restaurant'))
          );
          
          if (filteredResults.length > 0) {
            results = filteredResults;
          }
        }
        
        // If we still don't have good results, try a more generic search
        if (results.length === 0) {
          // First try with our enhanced keywords if available
          if (searchKeyword || keywordsList.length > 0) {
            let finalKeyword = searchKeyword;
            
            // If we have additional keywords, use them too
            if (keywordsList.length > 0) {
              const combinedKeywords = keywordsList.join(' ');
              finalKeyword = searchKeyword ? `${searchKeyword} ${combinedKeywords}` : combinedKeywords;
            }
            
            console.log(`All results filtered out, trying generic search with keyword: ${finalKeyword}`);
            const keywordParams = new URLSearchParams({
              location: `${lat},${lng}`,
              radius: "2000",
              keyword: finalKeyword,
              key: GOOGLE_PLACES_API_KEY || "",
              language: "en"
            });
            
            const keywordUrl = `${PLACES_API_BASE}/nearbysearch/json?${keywordParams.toString()}`;
            const keywordRes = await fetch(keywordUrl);
            const keywordData = await keywordRes.json();
            
            if (keywordData.status === "OK" && keywordData.results?.length > 0) {
              results = keywordData.results;
              
              // Apply some basic filtering to these results too
              results = results.filter(place => 
                !place.types.includes('gas_station') && 
                !place.types.includes('lawyer') &&
                !place.types.includes('finance')
              );
            }
          }
          
          // If still no results or no keyword was available, try with original type
          if (results.length === 0) {
            console.log(`No ${options.type} found with strict filtering, using more generic search`);
            const genericParams = new URLSearchParams({
              location: `${lat},${lng}`,
              radius: "2000",
              keyword: options.type,
              key: GOOGLE_PLACES_API_KEY || "",
              language: "en"
            });
            
            const genericUrl = `${PLACES_API_BASE}/nearbysearch/json?${genericParams.toString()}`;
            const genericRes = await fetch(genericUrl);
            const genericData = await genericRes.json();
            
            if (genericData.status === "OK" && genericData.results?.length > 0) {
              results = genericData.results;
            }
          }
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
        region: "us",
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