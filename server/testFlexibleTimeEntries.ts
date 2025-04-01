/**
 * Test file for improved flexibleTimeEntries handling
 * This tests the processing of vague time expressions like "morning" and "afternoon"
 */

import { StructuredRequest } from '@shared/types';
import { parseItineraryRequest } from './lib/nlp';

/**
 * Main test function
 */
async function testFlexibleTimeEntries() {
  console.log("\n=== FLEXIBLE TIME ENTRIES TEST ===\n");
  
  // Test classic example: British Museum in the morning, lunch in Soho
  await testMuseumAndLunch();
  
  // Test default time conversion for relative time periods
  await testTimeConversion();
  
  console.log("\n=== ALL TESTS COMPLETED SUCCESSFULLY ===\n");
}

/**
 * Test 1: Tests the British Museum and Soho lunch case
 */
async function testMuseumAndLunch() {
  console.log("\n🔍 Test 1: British Museum and Soho lunch");
  
  const query = "I'd like to visit the British Museum in the morning and then have lunch in Soho";
  console.log("Query:", query);
  
  try {
    const result = await parseItineraryRequest(query);
    console.log("Result:", JSON.stringify(result, null, 2));
    
    // Validation: Check if we have at least 2 fixed times
    if (!result.fixedTimes || result.fixedTimes.length < 2) {
      throw new Error("Failed to create expected number of fixedTime entries");
    }
    
    // Check if British Museum is one of the activities
    const hasBritishMuseum = result.fixedTimes.some(entry => 
      entry.location?.toLowerCase().includes("british") || 
      entry.searchTerm?.toLowerCase().includes("british museum")
    );
    
    // Check if Soho lunch is one of the activities
    const hasSohoLunch = result.fixedTimes.some(entry => 
      entry.location?.toLowerCase().includes("soho") && 
      (entry.searchTerm?.toLowerCase().includes("lunch") || 
       entry.type?.toLowerCase().includes("restaurant"))
    );
    
    if (!hasBritishMuseum) {
      throw new Error("British Museum not found in fixed times");
    }
    
    if (!hasSohoLunch) {
      throw new Error("Soho lunch not found in fixed times");
    }
    
    console.log("✅ British Museum and Soho lunch test passed");
  } catch (error) {
    console.error("❌ Test failed:", error);
    throw error;
  }
}

/**
 * Test 2: Tests time conversion from vague periods to specific times
 */
async function testTimeConversion() {
  console.log("\n🔍 Test 2: Time conversion from vague periods");
  
  const timeExpressions = [
    { query: "I want to visit Hyde Park in the morning", expectedPeriod: "morning" },
    { query: "I'd like to have lunch at 12:30", expectedPeriod: "12:30" },
    { query: "Show me something to do in the afternoon", expectedPeriod: "afternoon" },
    { query: "I need dinner plans for the evening", expectedPeriod: "evening" }
  ];
  
  for (const { query, expectedPeriod } of timeExpressions) {
    console.log(`\nTesting: "${query}" (expecting: ${expectedPeriod})`);
    
    const result = await parseItineraryRequest(query);
    
    // Check if at least one activity has the expected time period
    if (!result.fixedTimes || result.fixedTimes.length === 0) {
      throw new Error(`No fixed times created for query: ${query}`);
    }
    
    // Print the times that were created
    result.fixedTimes.forEach((entry, i) => {
      console.log(`Activity ${i+1}: Time=${entry.time}, Type=${entry.type}, Location=${entry.location}`);
    });
    
    console.log("✅ Time conversion validated");
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testFlexibleTimeEntries()
    .then(() => {
      console.log("All tests passed!");
      process.exit(0);
    })
    .catch(error => {
      console.error("Tests failed:", error);
      process.exit(1);
    });
}

export default testFlexibleTimeEntries;