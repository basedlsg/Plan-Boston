import { StructuredRequest } from '@shared/types';

/**
 * Adapter function to convert Gemini response format to the application's format
 */
export function convertGeminiToAppFormat(geminiResponse: any): StructuredRequest {
  console.log("Raw Gemini response:", JSON.stringify(geminiResponse, null, 2));
  
  // Initialize the result structure
  const result: StructuredRequest = {
    startLocation: geminiResponse.startLocation || "Central London", // Default to Central London
    destinations: [],
    fixedTimes: [],
    preferences: {
      type: undefined,
      requirements: []
    }
  };
  
  // Process fixed time entries
  if (geminiResponse.fixedTimeEntries && Array.isArray(geminiResponse.fixedTimeEntries)) {
    for (const entry of geminiResponse.fixedTimeEntries) {
      if (entry && typeof entry === 'object' && entry.location && entry.time) {
        result.fixedTimes.push({
          location: entry.location,
          time: entry.time,
          type: entry.activity || undefined
        });
      }
    }
  }
  
  // Process flexible time entries - THIS IS THE KEY FIX
  if (geminiResponse.flexibleTimeEntries && Array.isArray(geminiResponse.flexibleTimeEntries)) {
    for (const entry of geminiResponse.flexibleTimeEntries) {
      if (entry && typeof entry === 'object' && entry.location) {
        // Convert time formats
        let timeValue = entry.time;
        
        // Handle time periods (morning, afternoon, evening)
        if (timeValue === 'morning') {
          timeValue = '10:00';
        } else if (timeValue === 'afternoon') {
          timeValue = '14:00';
        } else if (timeValue === 'evening') {
          timeValue = '18:00';
        }
        
        // Add to fixed times
        result.fixedTimes.push({
          location: entry.location,
          time: timeValue,
          type: entry.activity || undefined
        });
      }
    }
  }
  
  // Process search parameters if available
  if (geminiResponse.searchParameters) {
    // Extract any specific preferences from search parameters
    if (geminiResponse.searchParameters.venueType) {
      result.preferences.type = geminiResponse.searchParameters.venueType;
    }
    
    if (geminiResponse.searchParameters.requirements && 
        Array.isArray(geminiResponse.searchParameters.requirements)) {
      result.preferences.requirements = geminiResponse.searchParameters.requirements;
    }
  }
  
  // Extract destinations - if we have locations but they're not in fixed times
  if (geminiResponse.locations && Array.isArray(geminiResponse.locations)) {
    const fixedLocations = new Set(result.fixedTimes.map((ft: {location: string}) => ft.location));
    
    for (const location of geminiResponse.locations) {
      if (typeof location === 'string' && !fixedLocations.has(location)) {
        result.destinations.push(location);
      }
    }
  }
  
  // Debug logging
  console.log("Converted app format:", JSON.stringify(result, null, 2));
  
  return result;
}