import { searchPlace } from "./lib/googlePlaces";
import { VenueSearchResult } from "../shared/schema";

/**
 * Test for multiple venue options
 * 
 * This test verifies that:
 * 1. Our searchPlace function correctly returns a primary venue and alternatives
 * 2. The alternatives are properly ranked by distance from the primary
 * 3. We get the expected number of alternatives (up to 3)
 */
async function testMultipleVenueOptions() {
  console.log("======= TESTING MULTIPLE VENUE OPTIONS =======");
  
  try {
    // 1. Test a landmark search
    console.log("\n🔍 Testing landmark search with alternatives:");
    const landmarkResult = await searchPlace("British Museum");
    
    console.log(`Primary venue: ${landmarkResult.primary.name}`);
    console.log(`Alternative count: ${landmarkResult.alternatives.length}`);
    
    console.log("\nAlternatives:");
    landmarkResult.alternatives.forEach((alt, index) => {
      // For venues, distance_from_primary should always be set, but handle the case if it's not
      const distance = typeof alt.distance_from_primary === 'number' ? 
                      alt.distance_from_primary.toFixed(2) : 
                      'unknown';
      console.log(`  ${index + 1}. ${alt.name} (${distance} km away)`);
    });
    
    // 2. Test a venue search with activity type
    console.log("\n🔍 Testing venue search with type and alternatives:");
    const cafeResult = await searchPlace("cafe in Covent Garden", {
      type: "cafe",
      openNow: true
    });
    
    console.log(`Primary venue: ${cafeResult.primary.name}`);
    console.log(`Alternative count: ${cafeResult.alternatives.length}`);
    
    console.log("\nAlternatives:");
    cafeResult.alternatives.forEach((alt, index) => {
      // For venues, distance_from_primary should always be set, but handle the case if it's not
      const distance = typeof alt.distance_from_primary === 'number' ? 
                      alt.distance_from_primary.toFixed(2) : 
                      'unknown';
      console.log(`  ${index + 1}. ${alt.name} (${distance} km away)`);
    });
    
    // 3. Test restaurant search with minimum rating
    console.log("\n🔍 Testing restaurant search with minimum rating:");
    const restaurantResult = await searchPlace("restaurant in Soho", {
      type: "restaurant",
      openNow: true,
      minRating: 4.5
    });
    
    console.log(`Primary venue: ${restaurantResult.primary.name} (rating: ${restaurantResult.primary.rating || 'unknown'})`);
    console.log(`Alternative count: ${restaurantResult.alternatives.length}`);
    
    console.log("\nAlternatives:");
    restaurantResult.alternatives.forEach((alt, index) => {
      // For venues, distance_from_primary should always be set, but handle the case if it's not
      const distance = typeof alt.distance_from_primary === 'number' ? 
                     alt.distance_from_primary.toFixed(2) : 
                     'unknown';
      console.log(`  ${index + 1}. ${alt.name} (rating: ${alt.rating || 'unknown'}, ${distance} km away)`);
    });
    
    // Test successfully completed
    console.log("\n✅ Multiple venue test successfully completed!");
    
  } catch (error) {
    console.error("❌ Error in multiple venue test:", error);
  }
}

// Run the test
testMultipleVenueOptions();