/**
 * Test file for enhanced search parameters
 * This tests the passing of additional search parameters from FixedTimeEntry in NLP parsing
 */

import { parseItineraryRequest } from "./lib/nlp";
// We won't mock searchPlace as we're only testing the NLP parsing

/**
 * Main test function that runs all tests
 */
async function testEnhancedSearchParams() {
  console.log("==== Testing Enhanced Search Parameters ====");
  
  try {
    await testRichSearchParameters();
    await testFixedTimeSearchParameters();
    console.log("\n✅ All enhanced search parameter tests passed!");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
  }
}

/**
 * Test 1: Tests rich search parameters from Gemini's response
 */
async function testRichSearchParameters() {
  console.log("\n----- Test 1: Rich Search Parameters from Gemini -----");
  
  // This query should generate rich search parameters
  const query = "I want to find a good Italian restaurant in Covent Garden that serves authentic focaccia sandwiches";
  
  try {
    console.log(`Processing query: "${query}"`);
    
    const result = await parseItineraryRequest(query);
    console.log("Parsed activities:", JSON.stringify(result.activities, null, 2));
    
    // Verification
    if (!result.activities || result.activities.length === 0) {
      throw new Error("No activities parsed from request");
    }
    
    const activity = result.activities[0];
    
    // Check for complete search parameters
    if (!activity.searchParameters) {
      throw new Error("No search parameters found in activity");
    }
    
    if (!activity.searchParameters.searchTerm) {
      throw new Error("Missing searchTerm in search parameters");
    }
    
    if (!Array.isArray(activity.searchParameters.keywords) || activity.searchParameters.keywords.length === 0) {
      throw new Error("Missing or empty keywords array in search parameters");
    }
    
    console.log("✅ Successfully parsed rich search parameters");
    
    // Check if the parameters were properly transferred to fixedTimes
    if (!result.fixedTimes || result.fixedTimes.length === 0) {
      throw new Error("No fixed times generated from activity");
    }
    
    const fixedTime = result.fixedTimes[0];
    
    if (!fixedTime.searchTerm) {
      throw new Error("searchTerm not transferred to fixedTime");
    }
    
    if (!Array.isArray(fixedTime.keywords) || fixedTime.keywords.length === 0) {
      throw new Error("keywords not transferred to fixedTime");
    }
    
    console.log("✅ Successfully transferred parameters to fixedTimes");
    
    return true;
  } catch (error) {
    console.error("Test 1 failed:", error);
    throw error;
  }
}

/**
 * Test 2: Tests that fixed time entries include search parameters
 */
async function testFixedTimeSearchParameters() {
  console.log("\n----- Test 2: Fixed Time Search Parameters -----");
  
  const query = "I want to have a high-quality coffee with pastries at a nice cafe in Shoreditch at 10am";
  
  try {
    console.log(`Processing query: "${query}"`);
    
    const result = await parseItineraryRequest(query);
    console.log("Fixed times:", JSON.stringify(result.fixedTimes, null, 2));
    
    // Check that we have fixed times
    if (!result.fixedTimes || result.fixedTimes.length === 0) {
      throw new Error("No fixed times parsed from request");
    }
    
    const fixedTime = result.fixedTimes[0];
    
    // Verify time parsing
    if (!fixedTime.time || !fixedTime.time.includes("10:00")) {
      throw new Error(`Time not correctly parsed: ${fixedTime.time}`);
    }
    
    // Verify location
    if (fixedTime.location !== "Shoreditch") {
      throw new Error(`Location not correctly parsed: ${fixedTime.location}`);
    }
    
    // Verify search parameters
    if (!fixedTime.searchTerm || !fixedTime.searchTerm.toLowerCase().includes("coffee")) {
      throw new Error(`searchTerm not correctly set: ${fixedTime.searchTerm}`);
    }
    
    if (!Array.isArray(fixedTime.keywords) || fixedTime.keywords.length === 0) {
      throw new Error("keywords not correctly set");
    }
    
    // Check if keywords include pastry-related terms
    const hasPastryKeyword = fixedTime.keywords.some(
      k => k.toLowerCase().includes("pastry") || k.toLowerCase().includes("cafe")
    );
    
    if (!hasPastryKeyword) {
      throw new Error("Keywords don't include relevant terms from query");
    }
    
    console.log("✅ Successfully parsed search parameters in fixed time entry");
    
    return true;
  } catch (error) {
    console.error("Test 2 failed:", error);
    throw error;
  }
}

// Run all tests
testEnhancedSearchParams();