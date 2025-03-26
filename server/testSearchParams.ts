/**
 * Simplified test for search parameter transmission
 * Focuses specifically on verifying search parameters are passed from activities to fixedTimes
 */

import { parseItineraryRequest } from './lib/nlp';

async function testSearchParams() {
  console.log("\n=== TESTING SEARCH PARAMETER TRANSMISSION ===\n");
  
  const query = "I want to have a specialty coffee at a quiet cafe in Soho at 11am";
  
  try {
    console.log(`Query: "${query}"\n`);
    
    const result = await parseItineraryRequest(query);
    
    // Check if activities array was populated 
    if (result.activities && result.activities.length > 0) {
      const activity = result.activities[0];
      
      console.log("FROM ACTIVITIES ARRAY:");
      console.log("---------------------");
      console.log("searchTerm:", activity.searchParameters?.searchTerm);
      console.log("type:", activity.searchParameters?.type);
      console.log("keywords:", JSON.stringify(activity.searchParameters?.keywords));
      console.log("minRating:", activity.searchParameters?.minRating);
      console.log("requirements:", JSON.stringify(activity.requirements));
    } else {
      console.log("No activities array found.");
    }
    
    console.log("\n");
    
    // Check if fixedTimes array was populated
    if (result.fixedTimes && result.fixedTimes.length > 0) {
      const fixedTime = result.fixedTimes[0];
      
      console.log("TO FIXED TIMES ARRAY:");
      console.log("--------------------");
      console.log("searchTerm:", fixedTime.searchTerm);
      console.log("type:", fixedTime.type);
      console.log("keywords:", JSON.stringify(fixedTime.keywords));
      console.log("minRating:", fixedTime.minRating);
    } else {
      console.log("No fixedTimes array found.");
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

testSearchParams().catch(console.error);