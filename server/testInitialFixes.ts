import { parseItineraryRequest } from './lib/nlp';
import { normalizeLocationName, ACTIVITY_TYPE_MAPPINGS } from './lib/locationNormalizer';
import { parseActivity } from './lib/languageProcessing';

async function testAllFixes() {
  console.log("=== TESTING ALL INITIAL FIXES ===\n");
  
  // Test 1: NLP TypeError Fix
  console.log("TEST 1: NLP TypeError Fix");
  try {
    console.log("Testing NLP parsing with minimal query...");
    const result = await parseItineraryRequest("Explore Green Park");
    console.log("✅ NLP parsing successful!");
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("❌ NLP parsing failed with error:", error);
  }
  
  // Test 2: Location Normalization
  console.log("\nTEST 2: Location Normalization");
  const testLocations = [
    "Mayfair", 
    "Green Park",
    "Liverpool Street",
    "soho", // lowercase
    "  Camden  " // with spaces
  ];
  
  let locationTestPassed = true;
  for (const loc of testLocations) {
    const normalized = normalizeLocationName(loc);
    console.log(`"${loc}" → "${normalized}"`);
    
    // Verify we maintain original neighborhood names or properly format them
    if (loc.trim().toLowerCase() === "liverpool street") {
      // For known stations, verify "Station" is appended
      if (normalized !== "Liverpool Street Station") {
        console.error(`❌ Error: Station "${loc}" should be normalized to "Liverpool Street Station"`);
        locationTestPassed = false;
      }
    } else {
      // For other locations, check if they're properly title-cased from the original
      const properTitleCase = loc.trim().split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
      
      if (normalized !== properTitleCase) {
        console.error(`❌ Error: "${loc}" was incorrectly normalized to "${normalized}" instead of "${properTitleCase}"`);
        locationTestPassed = false;
      }
    }
  }
  
  if (locationTestPassed) {
    console.log("✅ Location normalization works correctly!");
  }
  
  // Test 3: Activity Type Classification
  console.log("\nTEST 3: Activity Type Classification");
  const nonVenueActivities = ["meeting", "arrive", "explore", "walk", "visit"];
  const venueActivities = ["lunch", "dinner", "coffee", "drinks", "shopping"];
  
  let activityTestPassed = true;
  
  // Check non-venue activities map to null
  for (const activity of nonVenueActivities) {
    const venueType = activity in ACTIVITY_TYPE_MAPPINGS ? 
      ACTIVITY_TYPE_MAPPINGS[activity as keyof typeof ACTIVITY_TYPE_MAPPINGS] : 
      "not found";
    console.log(`"${activity}" → ${venueType === null ? "null ✅" : `"${venueType}" ❌`}`);
    
    if (venueType !== null) activityTestPassed = false;
  }
  
  // Check venue activities map to valid types
  for (const activity of venueActivities) {
    const venueType = activity in ACTIVITY_TYPE_MAPPINGS ? 
      ACTIVITY_TYPE_MAPPINGS[activity as keyof typeof ACTIVITY_TYPE_MAPPINGS] : 
      "not found";
    console.log(`"${activity}" → ${venueType ? `"${venueType}" ✅` : "not found ❌"}`);
    
    if (!venueType) activityTestPassed = false;
  }
  
  if (activityTestPassed) {
    console.log("✅ Activity type classification works correctly!");
  }
  
  // Test 4: Complete request with different activities
  console.log("\nTEST 4: Complete Request Processing");
  try {
    const request = "I want to have lunch in Soho at 1pm, then attend a meeting in Mayfair at 3pm, and explore Green Park afterward";
    console.log(`Testing complete request: "${request}"`);
    
    const result = await parseItineraryRequest(request);
    console.log("✅ Request parsed successfully!");
    console.log("Results:", JSON.stringify(result, null, 2));
    
    // Verify locations were found (they may appear in destinations or as the startLocation)
    const allLocations = [result.startLocation, ...result.destinations].filter(Boolean);
    const hasAllLocations = ["Soho", "Mayfair", "Green Park"].every(loc => 
      allLocations.some(resultLoc => resultLoc && resultLoc.includes(loc))
    );
    
    if (hasAllLocations) {
      console.log("✅ Locations found correctly!");
    } else {
      console.log("❌ Locations not all found correctly!");
      console.log("Expected: Soho, Mayfair, Green Park");
      console.log("Found:", allLocations.join(", "));
    }
    
    // Verify fixed times were parsed
    const hasLunchTime = result.fixedTimes.some(t => 
      (t.time === "13:00" || t.time === "12:30") && 
      (t.type === "restaurant" || t.type === "lunch")
    );
    const hasMeetingTime = result.fixedTimes.some(t => 
      t.time === "15:00" && 
      (t.type === undefined || t.type === "meeting" || t.type === null)
    );
    
    if (hasLunchTime && hasMeetingTime) {
      console.log("✅ Times and activities parsed correctly!");
    } else {
      console.log("❌ Times or activities not parsed correctly!");
      console.log("Expected: Lunch at 13:00 and meeting at 15:00");
      console.log("Found:", JSON.stringify(result.fixedTimes));
    }
    
  } catch (error) {
    console.error("❌ Complete request test failed with error:", error);
  }
  
  console.log("\n=== TEST SUMMARY ===");
  console.log("Check the results above to verify all three fixes are working correctly.");
}

// Run all tests
testAllFixes().catch(console.error);