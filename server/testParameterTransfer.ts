/**
 * Test file for verifying parameter transmission from NLP to search
 * 
 * This tests that enhanced search parameters (searchTerm, keywords, minRating)
 * are correctly passed from Gemini API responses to the fixedTimes array
 * and ultimately used in venue searches.
 */

import { parseItineraryRequest } from './lib/nlp';

async function testParameterTransfer() {
  console.log("TESTING PARAMETER TRANSFER FROM NLP TO SEARCH");
  console.log("=============================================");
  
  await testRichSearchParameters();
  
  console.log("\nAll tests completed. Check logs for parameter transmission details.");
}

/**
 * Test rich search parameters from Gemini's response
 */
async function testRichSearchParameters() {
  console.log("\n1. Testing rich search parameters transmission");
  console.log("---------------------------------------------");
  
  const richQueryWithParameters = "I want to have a specialty coffee at a quiet cafe in Soho at 11am, then lunch at a restaurant with outdoor seating in Covent Garden at 1pm";
  
  try {
    console.log(`Test query: "${richQueryWithParameters}"`);
    
    const parsedRequest = await parseItineraryRequest(richQueryWithParameters);
    
    // Test the output using specific property checks rather than logging the whole object
    console.log("\nVerifying fixedTimes has searchTerm, keywords, and minRating...");
    
    // Verify that we have 2 activities as expected
    if (!parsedRequest.fixedTimes || parsedRequest.fixedTimes.length < 2) {
      console.error("ERROR: Expected at least 2 fixedTimes entries, but got:", 
                    parsedRequest.fixedTimes?.length || 0);
    } else {
      console.log(`Found ${parsedRequest.fixedTimes.length} fixedTimes entries`);
      
      // Extract and check the first fixedTime entry
      const firstActivity = parsedRequest.fixedTimes[0];
      console.log("First activity (fixedTime):");
      console.log("- Location:", firstActivity.location);
      console.log("- Time:", firstActivity.time);
      console.log("- Type:", firstActivity.type);
      console.log("- Search Term:", firstActivity.searchTerm);
      console.log("- Keywords:", firstActivity.keywords ? JSON.stringify(firstActivity.keywords) : 'undefined');
      console.log("- Min Rating:", firstActivity.minRating);
      
      // Extract and check the second fixedTime entry
      if (parsedRequest.fixedTimes.length > 1) {
        const secondActivity = parsedRequest.fixedTimes[1];
        console.log("\nSecond activity (fixedTime):");
        console.log("- Location:", secondActivity.location);
        console.log("- Time:", secondActivity.time);
        console.log("- Type:", secondActivity.type);
        console.log("- Search Term:", secondActivity.searchTerm);
        console.log("- Keywords:", secondActivity.keywords ? JSON.stringify(secondActivity.keywords) : 'undefined');
        console.log("- Min Rating:", secondActivity.minRating);
      }
      
      // Check if we also received the original activities array from Gemini
      if (parsedRequest.activities && parsedRequest.activities.length > 0) {
        console.log("\nVerifying original activities array from Gemini:");
        console.log(`Found ${parsedRequest.activities.length} activities in the original array`);
        
        // Extract and check the first activity
        const firstOrigActivity = parsedRequest.activities[0];
        console.log("\nFirst original activity:");
        console.log("- Description:", firstOrigActivity.description);
        console.log("- Location:", firstOrigActivity.location);
        console.log("- Time:", firstOrigActivity.time);
        console.log("- Search Parameters:");
        console.log("  - Search Term:", firstOrigActivity.searchParameters?.searchTerm);
        console.log("  - Type:", firstOrigActivity.searchParameters?.type);
        console.log("  - Keywords:", firstOrigActivity.searchParameters?.keywords ? 
                  JSON.stringify(firstOrigActivity.searchParameters.keywords) : 'undefined');
        console.log("  - Min Rating:", firstOrigActivity.searchParameters?.minRating);
        console.log("  - Require Open Now:", firstOrigActivity.searchParameters?.requireOpenNow);
        console.log("- Requirements:", firstOrigActivity.requirements ? 
                  JSON.stringify(firstOrigActivity.requirements) : 'undefined');
        
        // Extract and check the second activity if available
        if (parsedRequest.activities.length > 1) {
          const secondOrigActivity = parsedRequest.activities[1];
          console.log("\nSecond original activity:");
          console.log("- Description:", secondOrigActivity.description);
          console.log("- Location:", secondOrigActivity.location);
          console.log("- Time:", secondOrigActivity.time);
          console.log("- Search Parameters:");
          console.log("  - Search Term:", secondOrigActivity.searchParameters?.searchTerm);
          console.log("  - Type:", secondOrigActivity.searchParameters?.type);
          console.log("  - Keywords:", secondOrigActivity.searchParameters?.keywords ? 
                    JSON.stringify(secondOrigActivity.searchParameters.keywords) : 'undefined');
          console.log("  - Min Rating:", secondOrigActivity.searchParameters?.minRating);
          console.log("  - Require Open Now:", secondOrigActivity.searchParameters?.requireOpenNow);
          console.log("- Requirements:", secondOrigActivity.requirements ? 
                    JSON.stringify(secondOrigActivity.requirements) : 'undefined');
        }
      } else {
        console.log("\nNo original activities array found in Gemini response");
      }
    }
    
    // Check if we have a complete request structure
    console.log("\nFull request structure verification:");
    console.log("- Start Location:", parsedRequest.startLocation);
    console.log("- Destinations:", JSON.stringify(parsedRequest.destinations));
    console.log("- Number of fixed times:", parsedRequest.fixedTimes.length);
    console.log("- Number of activities:", parsedRequest.activities?.length || 0);
    console.log("- Preferences:", JSON.stringify(parsedRequest.preferences));
    
    console.log("\nParameter transmission test completed");
  } catch (error) {
    console.error("Error testing parameter transmission:", error);
  }
}

// Run the tests
testParameterTransfer().catch(console.error);