/**
 * Final verification test for enhanced search parameters
 */

import { parseItineraryRequest } from './lib/nlp';

async function testFinalVerification() {
  console.log("===== FINAL VERIFICATION OF SEARCH PARAMETER HANDLING =====\n");
  
  const query = "I want to have a specialty coffee at a quiet cafe in Soho at 10am, " +
                "then visit the British Museum at noon";
  
  try {
    console.log(`Testing query: "${query}"\n`);
    
    const result = await parseItineraryRequest(query);
    
    // Verify fixed times
    if (result.fixedTimes && result.fixedTimes.length > 0) {
      console.log(`Found ${result.fixedTimes.length} fixed times entries`);
      
      // Check the first entry for a cafe activity
      const cafeEntry = result.fixedTimes.find(ft => 
        ft.type === 'cafe' || 
        (ft.searchTerm && ft.searchTerm.toLowerCase().includes('coffee'))
      );
      
      if (cafeEntry) {
        console.log("\nCafe activity details:");
        console.log("Location:", cafeEntry.location);
        console.log("Time:", cafeEntry.time);
        console.log("Type:", cafeEntry.type);
        console.log("Search Term:", cafeEntry.searchTerm);
        console.log("Keywords:", JSON.stringify(cafeEntry.keywords));
        console.log("Min Rating:", cafeEntry.minRating);
      }
      
      // Check for museum activity
      const museumEntry = result.fixedTimes.find(ft => 
        ft.type === 'museum' || 
        (ft.searchTerm && ft.searchTerm.toLowerCase().includes('museum'))
      );
      
      if (museumEntry) {
        console.log("\nMuseum activity details:");
        console.log("Location:", museumEntry.location);
        console.log("Time:", museumEntry.time);
        console.log("Type:", museumEntry.type);
        console.log("Search Term:", museumEntry.searchTerm);
        console.log("Keywords:", JSON.stringify(museumEntry.keywords));
        console.log("Min Rating:", museumEntry.minRating);
      }
    } else {
      console.log("No fixed times entries found!");
    }
    
    console.log("\nTest completed.");
  } catch (error) {
    console.error("Error in final verification test:", error);
  }
}

testFinalVerification().catch(console.error);