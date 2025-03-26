/**
 * Test file for enhanced Gemini integration with vague activity handling
 * This tests the ability to handle requests without fixed times
 */

import { parseItineraryRequest } from './lib/nlp';
import { searchPlace } from './lib/googlePlaces';
import type { EnhancedRequest, PlaceDetails } from '@shared/schema';

/**
 * Main test function that runs all tests
 */
async function testGeminiVagueRequests() {
  console.log("======== Testing Gemini's Handling of Vague Activity Requests ========");
  
  try {
    await testVagueRequestWithPreferences();
    await testVagueRequestWithoutTimes();
    await testVagueRequestWithLocation();
    
    console.log("\n✅ All vague request tests completed successfully!");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
  }
}

/**
 * Test 1: Vague request with activity preferences
 */
async function testVagueRequestWithPreferences() {
  console.log("\n----- Test 1: Vague Request with Activity Preferences -----");
  const query = "I'm looking for a nice coffee shop with a relaxed atmosphere in Shoreditch";
  
  try {
    console.log(`Processing query: "${query}"`);
    
    const result = await parseItineraryRequest(query);
    console.log("Parsed result:", JSON.stringify(result, null, 2));
    
    // Verification
    console.log("Checking result has preferences type:", result.preferences?.type);
    
    if (!result.preferences) {
      console.warn("Warning: No preferences found in the response");
    } else if (!result.preferences.type) {
      console.warn("Warning: No activity type preference found in the response");
    }
    
    if (!result.startLocation) {
      console.warn("Warning: No start location found in the response");
    } else if (!result.startLocation.includes("Shoreditch")) {
      console.warn(`Warning: Expected location to include "Shoreditch", but got "${result.startLocation}"`);
    }
    
    // Test search parameters generation
    console.log("Testing venue search with parsed data...");
    const searchOptions: any = {
      keywords: [],
      requireOpenNow: true,
      minRating: 4.0,
      searchTerm: 'coffee shop'
    };
    
    if (result.preferences.requirements && result.preferences.requirements.length > 0) {
      searchOptions.keywords = [...result.preferences.requirements];
    }
    
    // Check if startLocation is valid
    if (!result.startLocation) {
      throw new Error("No start location available for venue search");
    }
    
    const venueResult = await searchPlace(result.startLocation, searchOptions);
    
    if (!venueResult || !venueResult.primary) {
      throw new Error("Failed to find matching venue");
    }
    
    console.log(`✅ Found venue: ${venueResult.primary.name} with ${venueResult.alternatives.length} alternatives`);
    console.log("Test 1 passed!");
  } catch (error) {
    console.error("Test 1 failed:", error);
    throw error;
  }
}

/**
 * Test 2: Vague request without specific times
 */
async function testVagueRequestWithoutTimes() {
  console.log("\n----- Test 2: Vague Request Without Specific Times -----");
  const query = "I want to spend a day exploring museums and parks in London";
  
  try {
    console.log(`Processing query: "${query}"`);
    
    const result = await parseItineraryRequest(query);
    console.log("Parsed result:", JSON.stringify(result, null, 2));
    
    // Verification
    if (!result.preferences) {
      throw new Error("Failed to extract preferences");
    }
    
    if (result.fixedTimes.length === 0) {
      console.log("✅ Correctly identified as a request without fixed times");
    } else {
      console.log("⚠️ Note: Generated some fixed times from vague constraints");
    }
    
    // Check if we have destinations
    if (!result.destinations || result.destinations.length === 0) {
      throw new Error("Failed to extract any destinations");
    }
    
    console.log("Test 2 passed!");
  } catch (error) {
    console.error("Test 2 failed:", error);
    throw error;
  }
}

/**
 * Test 3: Vague request with location but no specific activity
 */
async function testVagueRequestWithLocation() {
  console.log("\n----- Test 3: Vague Request With Location but No Specific Activity -----");
  const query = "What should I do in Camden?";
  
  try {
    console.log(`Processing query: "${query}"`);
    
    const result = await parseItineraryRequest(query);
    console.log("Parsed result:", JSON.stringify(result, null, 2));
    
    // Verification
    if (!result.startLocation || !result.startLocation.includes("Camden")) {
      throw new Error("Failed to extract Camden as a location");
    }
    
    // Test search for a default activity in this area
    console.log("Testing venue search for a default activity in this area...");
    const searchOptions = {
      type: 'tourist_attraction',
      searchTerm: 'attraction',
      keywords: ['popular', 'sightseeing', 'landmark'],
      requireOpenNow: true
    };
    
    // We've already validated startLocation above, but let's be explicit for TypeScript
    const venueResult = await searchPlace(result.startLocation as string, searchOptions);
    
    if (!venueResult || !venueResult.primary) {
      throw new Error("Failed to find any venue in Camden");
    }
    
    console.log(`✅ Found venue: ${venueResult.primary.name} with ${venueResult.alternatives.length} alternatives`);
    console.log("Test 3 passed!");
  } catch (error) {
    console.error("Test 3 failed:", error);
    throw error;
  }
}

// Run the tests
testGeminiVagueRequests();