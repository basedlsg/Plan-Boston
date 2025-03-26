/**
 * Test file for Gemini 1.5 Pro NLP integration
 * This tests the parseItineraryRequest function with Gemini model
 */

import { parseItineraryRequest } from './lib/nlp';

/**
 * Main test function that runs all tests
 */
async function testGeminiIntegration() {
  console.log("===== Testing Gemini 1.5 Pro NLP Integration =====");
  
  try {
    // Test 1: Basic itinerary request
    await testBasicRequest();
    
    // Test 2: Complex itinerary with multiple activities
    await testComplexRequest();
    
    // Test 3: Vague request with minimal details
    await testVagueRequest();
    
    console.log("✅ All tests completed successfully");
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

/**
 * Test 1: Tests basic itinerary parsing
 */
async function testBasicRequest() {
  console.log("\n🔍 Test 1: Basic itinerary request");
  
  const query = "I want to have coffee in Covent Garden at 10am and then lunch in South Bank around 1pm";
  console.log("Query:", query);
  
  const result = await parseItineraryRequest(query);
  console.log("Result:", JSON.stringify(result, null, 2));
  
  // Validate results
  const hasCoventGarden = result.fixedTimes.some(ft => 
    ft.location.includes("Covent Garden") && ft.time === "10:00" && ft.type?.includes("coffee")
  );
  
  // Note: "South Bank" may be mapped to "Westminster" or other areas by our location normalizer
  const hasSouthBank = result.fixedTimes.some(ft => 
    (ft.location.includes("South Bank") || ft.location.includes("Westminster")) && 
    ft.time === "13:00" && 
    ft.type?.includes("lunch")
  );
  
  if (!hasCoventGarden) {
    throw new Error("Failed to extract coffee in Covent Garden at 10:00");
  }
  
  if (!hasSouthBank) {
    throw new Error("Failed to extract lunch in South Bank at 13:00");
  }
  
  console.log("✅ Basic request test passed");
}

/**
 * Test 2: Tests complex itinerary parsing with multiple activities
 */
async function testComplexRequest() {
  console.log("\n🔍 Test 2: Complex itinerary request");
  
  const query = "I'm arriving at King's Cross at 9am, then I'd like to visit the British Museum in the morning, have lunch near Piccadilly Circus around 1pm, go shopping in Oxford Street in the afternoon, and finally have dinner in Soho at 7pm before catching a show in the West End at 8:30pm";
  console.log("Query:", query);
  
  const result = await parseItineraryRequest(query);
  console.log("Result:", JSON.stringify(result, null, 2));
  
  // Count the number of activities extracted
  console.log(`Number of activities extracted: ${result.fixedTimes.length}`);
  
  // Check for at least 5 distinct activities
  if (result.fixedTimes.length < 5) {
    throw new Error(`Expected at least 5 activities, but got ${result.fixedTimes.length}`);
  }
  
  console.log("✅ Complex request test passed");
}

/**
 * Test 3: Tests vague request parsing with minimal details
 */
async function testVagueRequest() {
  console.log("\n🔍 Test 3: Vague request with minimal details");
  
  const query = "I want to explore London with my family tomorrow";
  console.log("Query:", query);
  
  const result = await parseItineraryRequest(query);
  console.log("Result:", JSON.stringify(result, null, 2));
  
  // Since this is a vague request, we're just checking that it returns something valid
  // rather than throwing an error
  if (!result || !result.preferences) {
    throw new Error("Failed to parse vague request");
  }
  
  console.log("✅ Vague request test passed");
}

// Run the tests
testGeminiIntegration().catch(console.error);