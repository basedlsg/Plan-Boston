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
    
    // Verify we maintain original station names, but preserve case for other location types
    if (loc.trim().toLowerCase() === "liverpool street") {
      // For stations, check if Station was added
      if (normalized !== `${loc.trim()} Station` && normalized !== `${loc.trim()}`) {
        console.error(`❌ Error: "${loc}" was incorrectly normalized to "${normalized}"`);
        locationTestPassed = false;
      }
    } else if (normalized !== loc.trim()) {
      // For non-stations, we expect the name to be preserved with only whitespace trimmed
      console.error(`❌ Error: "${loc}" was incorrectly normalized to "${normalized}"`);
      locationTestPassed = false;
    }
  }
  
  if (locationTestPassed) {
    console.log("✅ Location normalization works correctly!");
  }
  
  // Test 3: Activity Type Classification
  console.log("\nTEST 3: Activity Type Classification");
  const nonVenueActivities = ["meeting", "arrive", "explore", "walk", "rest"];
  const venueActivities = ["lunch", "dinner", "coffee", "drinks", "shopping"];
  
  let activityTestPassed = true;
  
  // Check non-venue activities map to undefined (not null)
  for (const activity of nonVenueActivities) {
    const venueType = activity in ACTIVITY_TYPE_MAPPINGS ? 
      ACTIVITY_TYPE_MAPPINGS[activity as keyof typeof ACTIVITY_TYPE_MAPPINGS] : 
      "not found";
    console.log(`"${activity}" → ${venueType === undefined ? "undefined ✅" : `"${venueType}" ❌`}`);
    
    if (venueType !== undefined) activityTestPassed = false;
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
    
    // Verify locations were preserved (may be normalized)
    const hasAllLocations = 
      (result.destinations.some(d => d.toLowerCase().includes("soho")) || 
       result.startLocation?.toLowerCase().includes("soho")) &&
      (result.destinations.some(d => d.toLowerCase().includes("mayfair")) || 
       result.startLocation?.toLowerCase().includes("mayfair")) &&
      (result.destinations.some(d => d.toLowerCase().includes("green park")) || 
       result.startLocation?.toLowerCase().includes("green park"));
    
    if (hasAllLocations) {
      console.log("✅ Locations preserved correctly!");
    } else {
      console.log("❌ Locations not preserved correctly!");
      console.log("Expected: Soho, Mayfair, and Green Park");
      console.log("Found: startLocation:", result.startLocation, "destinations:", result.destinations.join(", "));
    }
    
    // Verify fixed times were parsed
    const hasLunch = result.fixedTimes.some(t => 
      t.time === "13:00" && 
      (t.type === "restaurant" || t.type === "lunch"));
    
    const hasMeeting = result.fixedTimes.some(t => 
      t.time === "15:00");
    
    if (hasLunch && hasMeeting) {
      console.log("✅ Times and activities parsed correctly!");
    } else {
      console.log("❌ Times or activities not parsed correctly!");
      console.log("Expected: Lunch at 13:00 and meeting at 15:00");
      console.log("Found:", JSON.stringify(result.fixedTimes, null, 2));
    }
    
  } catch (error) {
    console.error("❌ Complete request test failed with error:", error);
  }
  
  // Test 5: Enhanced Activity Parsing
  console.log("\nTEST 5: Enhanced Activity Parsing");
  const activityTests = [
    "meeting with colleagues for coffee",
    "explore museums in London",
    "walk through the park",
    "relax at a spa",
    "have dinner at a fancy restaurant"
  ];
  
  for (const activity of activityTests) {
    const parsed = parseActivity(activity);
    console.log(`\nActivity: "${activity}"`);
    console.log(`- Type: ${parsed.type}`);
    console.log(`- Venue Type: ${parsed.venueType || "none"}`);
    console.log(`- Requirements: ${parsed.requirements && parsed.requirements.length ? parsed.requirements.join(", ") : "none"}`);
  }
  
  console.log("\n=== TEST SUMMARY ===");
  console.log("Check the results above to verify all three fixes are working correctly.");
}

// Run all tests
testAllFixes().catch(console.error);