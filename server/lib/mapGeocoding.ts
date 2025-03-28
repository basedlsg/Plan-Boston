/**
 * Google Maps Geocoding API Integration
 * 
 * This module provides geocoding functions to validate and improve location data
 * by using the Google Maps Geocoding API.
 */

import { getApiKey, isFeatureEnabled } from "../config";

// Interface for address component
interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

// Interface for geocoding result
export interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  neighborhood?: string;
  locality?: string;  
  administrativeArea?: string;
  country?: string;
}

/**
 * Validates and normalizes a location name by geocoding it through Google Maps API
 * 
 * @param location Location name to validate (e.g., "Hackney", "Soho", etc.)
 * @returns Verified location name (neighborhood or locality) or original if verification fails
 */
export async function validateAndNormalizeLocation(location: string): Promise<string> {
  // Skip if the feature is disabled
  if (!isFeatureEnabled("PLACES_API")) {
    console.log("Places API is disabled, skipping location validation for:", location);
    return location;
  }

  try {
    const apiKey = getApiKey("GOOGLE_PLACES_API_KEY");
    
    // Ensure the location is specifically within London
    const searchQuery = `${location}, London, UK`;
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchQuery)}&key=${apiKey}`;
    
    console.log(`Validating location: "${location}" with Google Maps Geocoding API`);
    
    const response = await fetch(geocodeUrl);
    
    if (!response.ok) {
      throw new Error(`Geocoding API request failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      console.log(`No geocoding results found for "${location}"`);
      return location;
    }
    
    // Get the first (most relevant) result
    const result = data.results[0];
    
    // Extract the most specific address component
    // Prioritize: neighborhood > sublocality > locality > administrative_area
    const components = result.address_components || [];
    
    // First, try to find a neighborhood or sublocality
    const neighborhood = components.find(
      (component: AddressComponent) => 
        component.types.includes("neighborhood") || 
        component.types.includes("sublocality_level_1") ||
        component.types.includes("sublocality")
    );
    
    if (neighborhood) {
      console.log(`Validated "${location}" as neighborhood: "${neighborhood.long_name}"`);
      return neighborhood.long_name;
    }
    
    // Next, try to find a locality (city/town)
    const locality = components.find(
      (component: AddressComponent) => component.types.includes("locality")
    );
    
    if (locality && locality.long_name.toLowerCase() !== "london") {
      console.log(`Validated "${location}" as locality: "${locality.long_name}"`);
      return locality.long_name;
    }
    
    // Check for administrative area as last resort
    const adminArea = components.find(
      (component: AddressComponent) => component.types.includes("administrative_area_level_2")
    );
    
    if (adminArea && adminArea.long_name.toLowerCase() !== "greater london") {
      console.log(`Validated "${location}" as admin area: "${adminArea.long_name}"`);
      return adminArea.long_name;
    }
    
    // If we couldn't find a specific component, just return the original
    console.log(`Could not find specific component for "${location}", keeping original`);
    return location;
    
  } catch (error) {
    console.error(`Error in location validation for "${location}":`, error);
    return location;  // Return original on error
  }
}

/**
 * Get full geocoding details for a location
 * 
 * @param location Location name or address
 * @returns Detailed geocoding result or null if not found
 */
export async function getLocationDetails(location: string): Promise<GeocodingResult | null> {
  if (!isFeatureEnabled("PLACES_API")) {
    return null;
  }

  try {
    const apiKey = getApiKey("GOOGLE_PLACES_API_KEY");
    const searchQuery = `${location}, London, UK`;
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchQuery)}&key=${apiKey}`;
    
    const response = await fetch(geocodeUrl);
    
    if (!response.ok) {
      throw new Error(`Geocoding API request failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      return null;
    }
    
    const result = data.results[0];
    const components = result.address_components || [];
    
    const neighborhood = components.find((c: AddressComponent) => 
      c.types.includes("neighborhood") || 
      c.types.includes("sublocality_level_1") ||
      c.types.includes("sublocality")
    );
    
    const locality = components.find((c: AddressComponent) => 
      c.types.includes("locality")
    );
    
    const adminArea = components.find((c: AddressComponent) => 
      c.types.includes("administrative_area_level_2") || 
      c.types.includes("administrative_area_level_1")
    );
    
    const country = components.find((c: AddressComponent) => 
      c.types.includes("country")
    );
    
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formattedAddress: result.formatted_address,
      neighborhood: neighborhood?.long_name,
      locality: locality?.long_name,
      administrativeArea: adminArea?.long_name,
      country: country?.long_name
    };
    
  } catch (error) {
    console.error(`Error in getLocationDetails for "${location}":`, error);
    return null;
  }
}

/**
 * Process location information using a two-phase approach:
 * 1. Try to extract with AI (Gemini)
 * 2. Verify with Google Maps Geocoding
 * 
 * This provides the most accurate location information possible.
 */
export async function processLocationWithAIAndMaps(query: string, extractedLocation?: string): Promise<string> {
  let locationToProcess = extractedLocation || "London";
  
  try {
    // Verify with Google Maps
    const verifiedLocation = await validateAndNormalizeLocation(locationToProcess);
    
    if (verifiedLocation && verifiedLocation !== "London") {
      console.log(`Location processing result: "${locationToProcess}" -> "${verifiedLocation}"`);
      return verifiedLocation;
    }
    
    // If we couldn't verify with Maps or got a generic "London" result,
    // try to extract more specific location information from the query
    
    // Look for explicit location mentions with prepositions
    const locationMatch = query.match(/\b(?:in|at|near|around|by)\s+([A-Z][a-zA-Z\s]{2,})\b/i);
    if (locationMatch && locationMatch[1]) {
      locationToProcess = locationMatch[1].trim();
      console.log(`Found potential location in query: "${locationToProcess}"`);
      
      // Try to validate this extracted location
      const verifiedExplicitLocation = await validateAndNormalizeLocation(locationToProcess);
      if (verifiedExplicitLocation && verifiedExplicitLocation !== "London") {
        console.log(`Verified explicit location: "${verifiedExplicitLocation}"`);
        return verifiedExplicitLocation;
      }
    }
    
    // If we still don't have a specific location, return the original or "London"
    return locationToProcess;
    
  } catch (error) {
    console.error("Error in processLocationWithAIAndMaps:", error);
    return locationToProcess; // Return original on error
  }
}